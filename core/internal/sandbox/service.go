// GeoWork Go Core - Sandbox Service

package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
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
			AllowedPaths:  []string{}, // empty = allow all paths in dev
			BlockedCmds:   []string{"rm", "sudo", "mkfs", "fdisk"},
			NetworkAccess: false,
			Timeout:       300,
			MaxMemoryMB:   512,
			EnvWhitelist:  []string{"PATH", "HOME", "LANG"},
		},
	}
}

func (s *Service) SetPolicy(policy *SandboxPolicy) {
	s.policy = policy
}

func (s *Service) RunCommand(taskID, workspace, command string) (*SandboxProcess, error) {
	if s.isBlocked(command) {
		return nil, fmt.Errorf("command blocked by sandbox policy: %s", command)
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
		proc.Status = "failed"
		proc.Stderr = err.Error()
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
		proc.Status = "failed"
		proc.Stderr = err.Error()
		return proc, err
	}

	go s.monitorProcess(proc, cmd, &stdout, &stderr)
	return proc, nil
}

func (s *Service) monitorProcess(proc *SandboxProcess, cmd *exec.Cmd, stdout, stderr *bytes.Buffer) {
	err := cmd.Wait()
	proc.Stdout = stdout.String()
	proc.Stderr = stderr.String()
	proc.FinishedAt = time.Now()

	if proc.cancel != nil {
		proc.cancel()
	}

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

	proc.Status = "stopped"
	proc.FinishedAt = time.Now()
	return nil
}

func (s *Service) ListProcesses(taskID string) []*SandboxProcess {
	s.mu.Lock()
	defer s.mu.Unlock()

	var result []*SandboxProcess
	for _, proc := range s.procs {
		if proc.TaskID == taskID {
			result = append(result, proc)
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
	return false
}

func (s *Service) isPathAllowed(path string) bool {
	if len(s.policy.AllowedPaths) == 0 {
		return true // dev mode: allow caller-provided workspace
	}

	for _, allowed := range s.policy.AllowedPaths {
		if path == allowed {
			return true
		}
		// support both / and \ as path separators
		prefix := allowed + "/"
		prefixWin := allowed + "\\"
		if strings.HasPrefix(path, prefix) || strings.HasPrefix(path, prefixWin) {
			return true
		}
	}
	return false
}
