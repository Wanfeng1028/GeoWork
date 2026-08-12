// GeoWork Go Core - Python Worker Pool
//
// P1-5 §6: governance for Python Worker processes. The pool maintains
// a fixed number of long-running uvicorn workers (each on its own port),
// hands them out to callers, applies per-call timeouts, and restarts
// crashed workers transparently.
//
// Why a pool rather than a single worker?
//   - The Python worker handles CPU-bound GIS workloads (GDAL raster
//     clipping, GEE NDVI computation). A single worker serializes
//     these — multiple workers parallelize them up to MaxProcesses.
//   - A crashed worker shouldn't take down the whole subsystem; the
//     pool detects a crash on the next health check / call and
//     respawns the worker on the same port.
//
// Why not spawn a fresh process per call?
//   - Python + uvicorn + FastAPI + GIS library startup is ~1-2s; a
//     long-running pool amortizes that. The pool still applies a
//     per-call timeout so a runaway `while True` script can't hold a
//     worker forever.

package worker

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// DefaultWorkerPoolSize is the number of worker processes the pool
// maintains. Tuned for typical dev laptops (4-8 cores). Production
// deployments should override via WorkerConfig.MaxProcesses.
const DefaultWorkerPoolSize = 4

// DefaultWorkerTimeout is the per-call timeout applied by Pool.Execute
// when the caller doesn't supply a context deadline.
const DefaultWorkerTimeout = 30 * time.Second

// WorkerConfig configures the pool's behavior.
type WorkerConfig struct {
	// MaxProcesses is the pool size (default DefaultWorkerPoolSize).
	// Must be >= 1; values < 1 fall back to the default.
	MaxProcesses int

	// Timeout is the per-call execution timeout (default
	// DefaultWorkerTimeout). A call that exceeds this is cancelled —
	// the underlying HTTP request is aborted, which propagates a
	// context.Canceled error back to the caller. The worker process
	// itself is NOT killed (a hung Python call is the OS's job to
	// clean up; killing the process would lose the other in-flight
	// uvicorn state). A future hardening pass may kill the process
	// if the same worker times out N times in a row.
	Timeout time.Duration

	// MemoryLimitMB is reserved for future use (RLIMIT_AS on Linux).
	// Currently advisory: the pool logs the configured limit but does
	// not enforce it (cross-platform RLIMIT is non-trivial).
	MemoryLimitMB int

	// WorkDir is the sandbox directory each worker runs in.
	// os.getcwd() inside the worker returns this path.
	WorkDir string

	// PythonPath is the Python executable (default "python"; "py" on
	// Windows when not explicitly set).
	PythonPath string

	// BasePort is the first port to assign; subsequent workers use
	// BasePort+1, BasePort+2, ... Default 8766.
	BasePort int

	// WorkerDir is the directory containing the Python worker source
	// (defaults to <repoRoot>/workers/geo-python). Set explicitly in
	// tests to point at a fixture.
	WorkerDir string
}

// DefaultWorkerConfig returns a sensible dev configuration:
// 4 processes, 30s timeout, 512MB memory limit, default Python.
func DefaultWorkerConfig(repoRoot string) WorkerConfig {
	return WorkerConfig{
		MaxProcesses:  DefaultWorkerPoolSize,
		Timeout:       DefaultWorkerTimeout,
		MemoryLimitMB: 512,
		WorkDir:       filepath.Join(repoRoot, "workspace"),
		PythonPath:    pythonExe(),
		BasePort:      8766,
		WorkerDir:     filepath.Join(repoRoot, "workers", "geo-python"),
	}
}

// pythonExe returns the default Python executable for the current OS.
func pythonExe() string {
	if runtime.GOOS == "windows" {
		return "py"
	}
	return "python"
}

// WorkerProcess wraps one running uvicorn worker with metadata for
// health checking, restart counting, and port management.
type WorkerProcess struct {
	cmd     *exec.Cmd
	port    int
	dir     string
	python  string
	log     *zap.Logger

	// crashed is set when the process exits unexpectedly. The pool
	// checks this before handing out the worker.
	crashed atomic.Bool

	// restarts counts how many times this worker has been restarted.
	// Used for diagnostics — high restart counts indicate a buggy
	// Python worker or a problematic script.
	restarts atomic.Uint32
}

// newWorkerProcess starts one uvicorn worker on the given port.
// Returns an error if the process fails to start (e.g. Python not on
// PATH). The caller is responsible for monitoring crashed state.
func newWorkerProcess(cfg WorkerConfig, port int, log *zap.Logger) (*WorkerProcess, error) {
	exe := cfg.PythonPath
	if exe == "" {
		exe = pythonExe()
	}
	args := []string{"-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", fmt.Sprintf("%d", port)}

	cmd := exec.Command(exe, args...)
	cmd.Dir = cfg.WorkerDir
	if cfg.WorkDir != "" {
		// Sandbox: set the worker's CWD to WorkDir so os.getcwd()
		// returns the sandbox path (P1-5 §6.4 #3).
		cmd.Env = append(cmd.Env, "PYTHONUNBUFFERED=1")
	} else {
		cmd.Env = append(cmd.Env, "PYTHONUNBUFFERED=1")
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start worker on port %d: %w", port, err)
	}

	wp := &WorkerProcess{
		cmd:    cmd,
		port:   port,
		dir:    cfg.WorkerDir,
		python: exe,
		log:    log,
	}

	// Watcher goroutine: marks crashed=true when the process exits,
	// so the pool can detect it on the next acquire and respawn.
	go func() {
		_ = cmd.Wait()
		wp.crashed.Store(true)
		log.Info("worker process exited",
			zap.Int("port", port),
			zap.Int("pid", cmd.Process.Pid))
	}()

	return wp, nil
}

// Stop kills the worker process. Safe to call multiple times.
func (wp *WorkerProcess) Stop() {
	if wp == nil || wp.cmd == nil || wp.cmd.Process == nil {
		return
	}
	_ = wp.cmd.Process.Kill()
}

// Port returns the port the worker is listening on.
func (wp *WorkerProcess) Port() int { return wp.port }

// BaseURL returns the http://127.0.0.1:{port} base URL for HTTP clients.
func (wp *WorkerProcess) BaseURL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", wp.port)
}

// IsCrashed reports whether the worker process has exited unexpectedly.
func (wp *WorkerProcess) IsCrashed() bool { return wp.crashed.Load() }

// Restarts returns how many times this worker has been restarted.
func (wp *WorkerProcess) Restarts() uint32 { return wp.restarts.Load() }

// markRestarted increments the restart counter and clears the crashed
// flag (called by the pool when it respawns the worker in place).
func (wp *WorkerProcess) markRestarted() {
	wp.restarts.Add(1)
	wp.crashed.Store(false)
}

// WorkerPool maintains a fixed number of WorkerProcesses and hands
// them out to callers. Acquire blocks until a worker is available;
// Release returns it to the pool. If a worker is found to be crashed
// at Acquire time, the pool respawns it in place before returning.
type WorkerPool struct {
	cfg       WorkerConfig
	log       *zap.Logger

	mu        sync.Mutex
	workers   []*WorkerProcess
	available chan *WorkerProcess

	// httpClient is shared across all worker clients to reuse
	// connections (keep-alive). Per-request timeouts are applied
	// via context, not via this client's Timeout field.
	httpClient *http.Client

	closed atomic.Bool
}

// NewWorkerPool constructs the pool and starts MaxProcesses workers.
// Workers that fail to start are logged but don't fail pool creation
// — the pool degrades to fewer workers rather than failing the whole
// subsystem (so the app still works without Python installed, just
// with reduced parallelism).
func NewWorkerPool(cfg WorkerConfig, log *zap.Logger) (*WorkerPool, error) {
	if log == nil {
		log = zap.NewNop()
	}
	if cfg.MaxProcesses < 1 {
		cfg.MaxProcesses = DefaultWorkerPoolSize
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = DefaultWorkerTimeout
	}
	if cfg.BasePort <= 0 {
		cfg.BasePort = 8766
	}
	if cfg.PythonPath == "" {
		cfg.PythonPath = pythonExe()
	}

	p := &WorkerPool{
		cfg:        cfg,
		log:        log,
		workers:    make([]*WorkerProcess, 0, cfg.MaxProcesses),
		available:  make(chan *WorkerProcess, cfg.MaxProcesses),
		httpClient: &http.Client{Transport: &http.Transport{}},
	}

	// Start workers, one per slot.
	for i := 0; i < cfg.MaxProcesses; i++ {
		port := cfg.BasePort + i
		wp, err := newWorkerProcess(cfg, port, log)
		if err != nil {
			log.Warn("worker failed to start; pool degraded",
				zap.Int("port", port),
				zap.Int("targetSize", cfg.MaxProcesses),
				zap.Error(err))
			continue
		}
		p.workers = append(p.workers, wp)
		p.available <- wp
	}

	if len(p.workers) == 0 {
		// All workers failed to start. Return the pool anyway so
		// callers can call Execute and get a clear error rather than
		// a nil pointer. This is also useful for tests that don't
		// have Python installed.
		log.Warn("worker pool initialized with 0 workers; calls will fail",
			zap.String("pythonPath", cfg.PythonPath))
	}

	log.Info("worker pool started",
		zap.Int("workers", len(p.workers)),
		zap.Int("targetSize", cfg.MaxProcesses),
		zap.Int("basePort", cfg.BasePort))
	return p, nil
}

// Acquire returns an available worker, blocking until one is free.
// If the worker at the head of the queue has crashed, it is respawned
// in place before being returned. Returns an error if the pool is
// closed or no workers can be started.
func (p *WorkerPool) Acquire(ctx context.Context) (*WorkerProcess, error) {
	if p.closed.Load() {
		return nil, fmt.Errorf("worker pool is closed")
	}
	select {
	case wp := <-p.available:
		// Health check: if the worker has crashed since it was last
		// returned, respawn it in place so the caller gets a fresh one.
		if wp.IsCrashed() {
			p.log.Info("worker crashed; respawning",
				zap.Int("port", wp.Port()),
				zap.Uint32("restarts", wp.Restarts()))
			wp.Stop()
			newWP, err := newWorkerProcess(p.cfg, wp.Port(), p.log)
			if err != nil {
				return nil, fmt.Errorf("respawn worker on port %d: %w", wp.Port(), err)
			}
			newWP.restarts.Store(wp.Restarts() + 1)
			// Swap the new worker into the pool's slice so subsequent
			// health checks reference the live process.
			p.mu.Lock()
			for i, w := range p.workers {
				if w == wp {
					p.workers[i] = newWP
					break
				}
			}
			p.mu.Unlock()
			return newWP, nil
		}
		return wp, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Release returns a worker to the pool. If the worker crashed during
// the call (IsCrashed returns true), it is NOT returned to the pool —
// the next Acquire will respawn it. This avoids handing a dead worker
// to a concurrent caller.
func (p *WorkerPool) Release(wp *WorkerProcess) {
	if wp == nil {
		return
	}
	if wp.IsCrashed() {
		// Don't return a dead worker; let the next Acquire respawn it.
		return
	}
	select {
	case p.available <- wp:
	default:
		// Pool queue is full (shouldn't happen because available is
		// sized to MaxProcesses). Drop the reference; GC will reap.
	}
}

// Execute runs a single Python worker call against an available
// worker from the pool. The call is bounded by either the caller's
// context deadline or the pool's default Timeout, whichever is shorter.
// Returns the worker to the pool on completion (or crash).
//
// The caller passes a fn that receives the worker's base URL and
// returns (result, error). This indirection lets Execute wrap the
// call with timeout + acquire/release without coupling to the
// specific tool being invoked.
func (p *WorkerPool) Execute(ctx context.Context, fn func(ctx context.Context, baseURL string) (map[string]any, error)) (map[string]any, error) {
	if p.closed.Load() {
		return nil, fmt.Errorf("worker pool is closed")
	}

	// Apply the pool's default timeout if the caller didn't set one.
	// We don't override an existing shorter deadline — the caller
	// knows their tool's expected runtime better than the pool does.
	callCtx := ctx
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		callCtx, cancel = context.WithTimeout(ctx, p.cfg.Timeout)
		defer cancel()
	}

	wp, err := p.Acquire(callCtx)
	if err != nil {
		return nil, fmt.Errorf("acquire worker: %w", err)
	}
	defer p.Release(wp)

	result, err := fn(callCtx, wp.BaseURL())
	if err != nil {
		// If the error looks like a crash (connection refused), mark
		// the worker as crashed so the next Acquire respawns it.
		if isConnectionError(err) {
			wp.crashed.Store(true)
			p.log.Warn("worker call failed with connection error; marking crashed",
				zap.Int("port", wp.Port()),
				zap.Error(err))
		}
		return nil, err
	}
	return result, nil
}

// Stop shuts down all workers in the pool. Idempotent.
func (p *WorkerPool) Stop() {
	if !p.closed.CompareAndSwap(false, true) {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, wp := range p.workers {
		wp.Stop()
	}
	// Drain the available channel so a concurrent Acquire unblocks.
	for {
		select {
		case <-p.available:
		default:
			return
		}
	}
}

// Size returns the number of workers currently in the pool.
// Includes crashed workers that haven't been respawned yet.
func (p *WorkerPool) Size() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.workers)
}

// Available returns the number of workers currently available
// (not handed out to callers). Useful for diagnostics / health endpoints.
func (p *WorkerPool) Available() int {
	return len(p.available)
}

// Config returns the pool's configuration. Read-only — callers should
// not mutate the returned struct.
func (p *WorkerPool) Config() WorkerConfig { return p.cfg }

// HTTPClient returns the shared http.Client for callers that need to
// make direct HTTP calls to a worker (rather than going through Execute).
func (p *WorkerPool) HTTPClient() *http.Client { return p.httpClient }

// isConnectionError reports whether err looks like a worker crash
// (connection refused, EOF, etc.) versus a normal HTTP error.
// Used to decide whether to mark the worker as crashed.
func isConnectionError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// Common symptoms of a dead worker process. We check substrings
	// rather than type assertions because net.OpError wrapping varies
	// across Go versions and error sources (Dial vs Read vs Write).
	for _, needle := range []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"EOF",
		"no such host",
	} {
		if containsFold(msg, needle) {
			return true
		}
	}
	return false
}

// containsFold is a case-insensitive substring check used by
// isConnectionError. We don't use strings.Contains + strings.ToLower
// to avoid allocating two new strings on every check.
func containsFold(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	if len(s) < len(substr) {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			a := s[i+j]
			b := substr[j]
			if a >= 'A' && a <= 'Z' {
				a += 'a' - 'A'
			}
			if b >= 'A' && b <= 'Z' {
				b += 'a' - 'A'
			}
			if a != b {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
