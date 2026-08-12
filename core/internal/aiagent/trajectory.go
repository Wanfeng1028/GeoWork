// GeoWork Go Core - Agent Trajectory Recorder
//
// P1-2 §3.3-3.4: Trajectory records the complete execution trace of a
// Run — every ReAct turn's input messages, model response, tool calls,
// token usage, and per-tool outcomes. This makes each Run reproducible
// and analyzable post-hoc, which is critical for:
//
//   - debugging "why did the agent do X?"
//   - usage / cost auditing (paired with UsageMeter)
//   - eval harness replay (P2-6 will replay trajectories against
//     golden expected outcomes)
//
// The TrajectoryStorage interface is split out so a future SQLite /
// object-store backend can replace the JSON file implementation without
// touching the orchestrator.

package aiagent

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"geowork/core/internal/modelgateway"

	"go.uber.org/zap"
)

// Trajectory records one Run's full execution trace.
type Trajectory struct {
	RunID     string        `json:"runId"`
	Mode      string        `json:"mode,omitempty"`
	Prompt    string        `json:"prompt,omitempty"`
	StartTime time.Time     `json:"startTime"`
	EndTime   time.Time     `json:"endTime,omitempty"`
	Turns     []TurnRecord  `json:"turns"`
}

// TurnRecord captures one ReAct loop iteration.
type TurnRecord struct {
	TurnIndex      int                       `json:"turnIndex"`
	Timestamp      time.Time                 `json:"timestamp"`
	InputMessages  []modelgateway.ChatMessage `json:"inputMessages,omitempty"`
	ModelResponse  string                     `json:"modelResponse"`
	ToolCalls      []ToolCallRecord          `json:"toolCalls,omitempty"`
	TokenUsage     *modelgateway.UsageInfo    `json:"tokenUsage,omitempty"`
	Duration       time.Duration             `json:"duration"`
}

// ToolCallRecord captures one tool invocation within a turn.
type ToolCallRecord struct {
	ToolName string         `json:"toolName"`
	Args     map[string]any `json:"args,omitempty"`
	Result   map[string]any `json:"result,omitempty"`
	Error    string         `json:"error,omitempty"`
	Duration time.Duration  `json:"duration"`
	// Approved indicates whether the call went through the interactive
	// approval flow (P1-1). False for non-critical tools or for
	// deterministic (workflow) calls.
	Approved bool `json:"approved,omitempty"`
}

// TrajectoryStorage is the persistence interface for Trajectory.
// Implementations may use JSON files (default), SQLite, or object
// storage. All methods must be safe for concurrent use.
type TrajectoryStorage interface {
	// Save persists a Trajectory. Implementations may upsert by RunID.
	Save(traj *Trajectory) error
	// Load retrieves a Trajectory by run ID.
	Load(runID string) (*Trajectory, error)
	// List returns up to limit Trajectories, ordered by StartTime desc.
	// limit <= 0 means a sensible default (100).
	List(limit int) ([]*Trajectory, error)
}

// TrajectoryRecorder is the entry point used by the orchestrator.
// It buffers turns in memory and flushes to storage at Run end (and
// optionally every N turns — see FlushEvery).
type TrajectoryRecorder struct {
	mu      sync.Mutex
	storage TrajectoryStorage
	log     *zap.Logger

	// active trajectories keyed by runID; flushed on Run end.
	active map[string]*Trajectory
}

// NewTrajectoryRecorder constructs a recorder backed by the given storage.
// storage may be nil — in that case the recorder is a no-op (useful for
// tests that don't care about persistence).
func NewTrajectoryRecorder(storage TrajectoryStorage, log *zap.Logger) *TrajectoryRecorder {
	if log == nil {
		log = zap.NewNop()
	}
	return &TrajectoryRecorder{
		storage: storage,
		log:     log,
		active:  make(map[string]*Trajectory),
	}
}

// StartRun initializes an in-memory Trajectory for runID. Called by the
// orchestrator at Run start. If a Trajectory already exists for runID
// (e.g. resume from checkpoint), it is preserved.
func (r *TrajectoryRecorder) StartRun(runID, mode, prompt string) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.active[runID]; exists {
		return
	}
	r.active[runID] = &Trajectory{
		RunID:     runID,
		Mode:      mode,
		Prompt:    prompt,
		StartTime: time.Now(),
		Turns:     make([]TurnRecord, 0),
	}
}

// Record appends a TurnRecord to the run's Trajectory. Safe to call
// concurrently from different runs; not safe to call concurrently for
// the same run (the orchestrator runs one ReAct loop per run).
func (r *TrajectoryRecorder) Record(runID string, turn TurnRecord) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	traj, ok := r.active[runID]
	if !ok {
		// Late start: create on first Record so callers that forgot
		// StartRun still get a Trajectory.
		traj = &Trajectory{
			RunID:     runID,
			StartTime: time.Now(),
			Turns:     make([]TurnRecord, 0),
		}
		r.active[runID] = traj
	}
	traj.Turns = append(traj.Turns, turn)
}

// FinishRun marks the run as complete, sets EndTime, and flushes to storage.
// Called by the orchestrator's deferred cleanup. Safe to call multiple
// times — only the first call flushes; subsequent calls are no-ops.
func (r *TrajectoryRecorder) FinishRun(runID string) {
	if r == nil {
		return
	}
	r.mu.Lock()
	traj, ok := r.active[runID]
	if !ok {
		r.mu.Unlock()
		return
	}
	delete(r.active, runID)
	r.mu.Unlock()

	traj.EndTime = time.Now()
	if r.storage != nil {
		if err := r.storage.Save(traj); err != nil {
			r.log.Warn("failed to save trajectory",
				zap.String("runId", runID),
				zap.Error(err),
			)
		}
	}
}

// Load retrieves a persisted Trajectory by run ID (delegates to storage).
func (r *TrajectoryRecorder) Load(runID string) (*Trajectory, error) {
	if r == nil || r.storage == nil {
		return nil, fmt.Errorf("trajectory storage not configured")
	}
	return r.storage.Load(runID)
}

// List returns recent trajectories from storage.
func (r *TrajectoryRecorder) List(limit int) ([]*Trajectory, error) {
	if r == nil || r.storage == nil {
		return []*Trajectory{}, nil
	}
	return r.storage.List(limit)
}

// ---- FileTrajectoryStorage: JSON file per Run ----

// FileTrajectoryStorage persists each Trajectory as a JSON file under
// dataDir/{runID}.json. The directory is created on first Save.
type FileTrajectoryStorage struct {
	dataDir string
	log     *zap.Logger
	mu      sync.Mutex
}

// NewFileTrajectoryStorage constructs a file-based storage at dataDir.
func NewFileTrajectoryStorage(dataDir string, log *zap.Logger) *FileTrajectoryStorage {
	if log == nil {
		log = zap.NewNop()
	}
	if dataDir == "" {
		dataDir = filepath.Join(os.TempDir(), "geowork", "trajectories")
	}
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Warn("failed to create trajectory data dir", zap.String("dir", dataDir), zap.Error(err))
	}
	return &FileTrajectoryStorage{dataDir: dataDir, log: log}
}

func (s *FileTrajectoryStorage) path(runID string) string {
	return filepath.Join(s.dataDir, runID+".json")
}

// Save writes traj to <dataDir>/<runID>.json, overwriting any existing
// file. Marshalling errors are returned; disk write errors are logged
// and returned.
func (s *FileTrajectoryStorage) Save(traj *Trajectory) error {
	if traj == nil || traj.RunID == "" {
		return fmt.Errorf("trajectory missing runID")
	}
	data, err := json.MarshalIndent(traj, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal trajectory: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.WriteFile(s.path(traj.RunID), data, 0644); err != nil {
		s.log.Warn("failed to write trajectory file",
			zap.String("runId", traj.RunID),
			zap.Error(err),
		)
		return err
	}
	return nil
}

// Load reads a Trajectory from <dataDir>/<runID>.json.
func (s *FileTrajectoryStorage) Load(runID string) (*Trajectory, error) {
	data, err := os.ReadFile(s.path(runID))
	if err != nil {
		return nil, fmt.Errorf("load trajectory %s: %w", runID, err)
	}
	var traj Trajectory
	if err := json.Unmarshal(data, &traj); err != nil {
		return nil, fmt.Errorf("unmarshal trajectory %s: %w", runID, err)
	}
	return &traj, nil
}

// List scans dataDir for *.json files and returns up to limit
// Trajectories ordered by StartTime descending. limit <= 0 means 100.
func (s *FileTrajectoryStorage) List(limit int) ([]*Trajectory, error) {
	if limit <= 0 {
		limit = 100
	}
	entries, err := os.ReadDir(s.dataDir)
	if err != nil {
		return []*Trajectory{}, nil // missing dir → empty list
	}
	out := make([]*Trajectory, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		runID := strings.TrimSuffix(e.Name(), ".json")
		traj, err := s.Load(runID)
		if err != nil {
			continue
		}
		out = append(out, traj)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].StartTime.After(out[j].StartTime)
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
