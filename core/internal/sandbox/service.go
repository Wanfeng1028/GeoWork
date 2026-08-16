// GeoWork Go Core - Sandbox Service

package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	mu     sync.Mutex
	procs  map[string]*SandboxProcess
	policy *SandboxPolicy
}

func NewService() *Service {
	return &Service{
		procs: make(map[string]*SandboxProcess),
		policy: &SandboxPolicy{
			AllowedPaths:     []string{}, // empty = allow all paths in dev
			BlockedCmds:      []string{"rm", "sudo", "mkfs", "fdisk"},
			AllowedCmds:      []string{"ls", "dir", "cat", "type", "echo", "pwd", "whoami", "date", "python", "pip", "git", "node", "npm", "go"},
			AllowAllCommands: true, // dev mode: backward compatible
			NetworkAccess:    false,
			Timeout:          300,
			MaxMemoryMB:      512,
			EnvWhitelist:     []string{"PATH", "HOME", "LANG"},
		},
	}
}

func (s *Service) SetPolicy(policy *SandboxPolicy) {
	s.policy = policy
}

func (s *Service) RunCommand(taskID, workspace, command string) (*SandboxProcess, error) {
	// Step 1: hard deny — always block dangerous commands
	if s.isBlocked(command) {
		return nil, fmt.Errorf("command blocked by sandbox policy: %s", command)
	}

	// Step 2: whitelist check
	if !s.isAllowed(command) {
		return nil, fmt.Errorf("command not in sandbox whitelist: %s", command)
	}

	if !s.isPathAllowed(workspace) {
		return nil, fmt.Errorf("workspace path not allowed by sandbox policy")
	}

	proc := &SandboxProcess{
		ID:        uuid.New().String(),
		TaskID:    taskID,
		Type:      "command",
		Command:   command,
		Workspace: workspace,
		Status:    "running",
		StartedAt: time.Now(),
		mu:        &sync.Mutex{},
	}
	proc.ctx, proc.cancel = context.WithTimeout(context.Background(), time.Duration(s.policy.Timeout)*time.Second)

	s.mu.Lock()
	s.procs[proc.ID] = proc
	s.mu.Unlock()

	// Select shell based on platform
	var shell string
	var args []string
	if runtime.GOOS == "windows" {
		if _, err := exec.LookPath("pwsh"); err == nil {
			shell = "pwsh"
			args = []string{"-NoProfile", "-Command", command}
		} else {
			shell = "cmd"
			args = []string{"/C", command}
		}
	} else {
		shell = "bash"
		args = []string{"-c", command}
	}
	cmd := exec.CommandContext(proc.ctx, shell, args...)
	cmd.Dir = workspace
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	setSysProcAttr(cmd)

	if err := cmd.Start(); err != nil {
		proc.mu.Lock()
		proc.Status = "failed"
		proc.Stderr = err.Error()
		proc.mu.Unlock()
		return proc, err
	}

	go s.monitorProcess(proc, cmd, &stdout, &stderr)
	return proc, nil
}

func (s *Service) RunPythonScript(taskID, workspace, scriptPath string, env map[string]string, timeout int) (*SandboxProcess, error) {
	if timeout <= 0 {
		timeout = s.policy.Timeout
	}

	proc := &SandboxProcess{
		ID:        uuid.New().String(),
		TaskID:    taskID,
		Type:      "python",
		Command:   fmt.Sprintf("python %s", scriptPath),
		Workspace: workspace,
		Status:    "running",
		StartedAt: time.Now(),
		mu:        &sync.Mutex{},
	}
	proc.ctx, proc.cancel = context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)

	s.mu.Lock()
	s.procs[proc.ID] = proc
	s.mu.Unlock()

	cmd := exec.CommandContext(proc.ctx, "python", scriptPath)
	cmd.Dir = workspace

	for _, k := range s.policy.EnvWhitelist {
		if v, ok := env[k]; ok {
			cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
		}
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	setSysProcAttr(cmd)

	if err := cmd.Start(); err != nil {
		proc.mu.Lock()
		proc.Status = "failed"
		proc.Stderr = err.Error()
		proc.mu.Unlock()
		return proc, err
	}

	go s.monitorProcess(proc, cmd, &stdout, &stderr)
	return proc, nil
}

func (s *Service) monitorProcess(proc *SandboxProcess, cmd *exec.Cmd, stdout, stderr *bytes.Buffer) {
	err := cmd.Wait()

	proc.mu.Lock()
	proc.Stdout = stdout.String()
	proc.Stderr = stderr.String()
	proc.FinishedAt = time.Now()

	// Only transition if still running: StopProcess may have already moved
	// the process to "stopped", and a user-initiated stop must not be
	// overwritten by the monitor's view of the kill's exit error.
	if proc.Status == "running" {
		if err != nil {
			if exitError, ok := err.(*exec.ExitError); ok {
				code := exitError.ExitCode()
				proc.ExitCode = &code
				proc.Status = "failed"
			} else {
				proc.Status = "stopped"
			}
		} else {
			code := 0
			proc.ExitCode = &code
			proc.Status = "completed"
		}
	}
	proc.mu.Unlock()

	// Cancel after the final status is written so waiters on ctx.Done()
	// always observe the terminal state.
	if proc.cancel != nil {
		proc.cancel()
	}
}

func (s *Service) StopProcess(id string) error {
	s.mu.Lock()
	proc, ok := s.procs[id]
	s.mu.Unlock()

	if !ok {
		return fmt.Errorf("process not found: %s", id)
	}

	if proc.cancel != nil {
		proc.cancel()
	}

	proc.mu.Lock()
	// Only transition running processes; a process that already reached a
	// terminal state keeps its real outcome.
	if proc.Status == "running" {
		proc.Status = "stopped"
		proc.FinishedAt = time.Now()
	}
	proc.mu.Unlock()
	return nil
}

func (s *Service) ListProcesses(taskID string) []*SandboxProcess {
	s.mu.Lock()
	defer s.mu.Unlock()

	var result []*SandboxProcess
	for _, proc := range s.procs {
		if proc.TaskID == taskID {
			// Hand out snapshots: callers JSON-encode these while the monitor
			// goroutine may still be mutating the live process.
			snap := proc.Snapshot()
			result = append(result, &snap)
		}
	}
	return result
}

func (s *Service) isBlocked(command string) bool {
	for _, blocked := range s.policy.BlockedCmds {
		pattern := fmt.Sprintf(`(^|\s)%s(\s|$)`, regexp.QuoteMeta(blocked))
		matched, _ := regexp.MatchString(pattern, command)
		if matched {
			return true
		}
	}
	// Also block absolute-path variants of blocked commands, e.g. /bin/rm
	for _, blocked := range s.policy.BlockedCmds {
		if strings.Contains(command, "/"+blocked) || strings.Contains(command, "\\"+blocked) {
			return true
		}
	}
	return false
}

// isAllowed checks whether the command passes the whitelist.
// If AllowAllCommands is true (dev mode), every non-blocked command is allowed.
// Otherwise the command's base executable must appear in AllowedCmds.
func (s *Service) isAllowed(command string) bool {
	if s.policy.AllowAllCommands {
		return true
	}

	// Extract the base command name (first token, then basename)
	tokens := strings.Fields(command)
	if len(tokens) == 0 {
		return false
	}
	baseCmd := filepath.Base(tokens[0])
	// Strip .exe suffix on Windows
	baseCmd = strings.TrimSuffix(baseCmd, ".exe")

	// Check whitelist
	for _, allowed := range s.policy.AllowedCmds {
		if strings.EqualFold(baseCmd, allowed) {
			return true
		}
	}

	// Also verify via LookPath to resolve the real path and prevent bypass
	resolved, err := exec.LookPath(tokens[0])
	if err != nil {
		return false // command not found on PATH
	}
	resolvedBase := strings.TrimSuffix(filepath.Base(resolved), ".exe")
	for _, allowed := range s.policy.AllowedCmds {
		if strings.EqualFold(resolvedBase, allowed) {
			return true
		}
	}

	return false
}

func (s *Service) isPathAllowed(path string) bool {
	if len(s.policy.AllowedPaths) == 0 {
		return true // dev mode: allow caller-provided workspace
	}

	// Clean and resolve the path
	cleanPath := filepath.Clean(path)

	for _, allowed := range s.policy.AllowedPaths {
		// Clean the allowed path too
		cleanAllowed := filepath.Clean(allowed)

		// Exact match after cleaning
		if cleanPath == cleanAllowed {
			return true
		}

		// Use filepath.Rel to safely check if path is under allowed directory
		rel, err := filepath.Rel(cleanAllowed, cleanPath)
		if err != nil {
			continue // paths on different drives on Windows
		}

		// rel must not start with ".." (meaning path is under allowed dir)
		// and must not be "." (which would mean they're the same, already handled above)
		if !strings.HasPrefix(rel, "..") && rel != "." {
			return true
		}
	}
	return false
}
