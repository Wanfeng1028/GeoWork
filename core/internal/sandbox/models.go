// GeoWork Go Core - Sandbox Models

package sandbox

import (
	"context"
	"sync"
	"time"
)

// SandboxProcess represents a running sandbox process.
//
// The mutable fields (Status, Stdout, Stderr, ExitCode, FinishedAt) are
// written by the monitor goroutine and by StopProcess concurrently with HTTP
// handlers that serialize the process to JSON. They are guarded by mu. Callers
// outside the monitor must read a consistent view via Snapshot.
type SandboxProcess struct {
	ID         string    `json:"id"`
	TaskID     string    `json:"taskId"`
	Type       string    `json:"type"` // command, python, tool
	Command    string    `json:"command"`
	Workspace  string    `json:"workspace"`
	Status     string    `json:"status"` // running, completed, stopped, failed
	Stdout     string    `json:"stdout,omitempty"`
	Stderr     string    `json:"stderr,omitempty"`
	ExitCode   *int      `json:"exitCode,omitempty"`
	StartedAt  time.Time `json:"startedAt"`
	FinishedAt time.Time `json:"finishedAt,omitempty"`

	// IsolationNote records which sandbox isolation degraded and is NOT in
	// effect (doc/25 W2 honest degrade). Empty when full isolation applies.
	// Surfaced in the API so callers never assume protection they lack.
	IsolationNote string `json:"isolationNote,omitempty"`

	// mu guards the mutable fields above. It is a pointer so Snapshot can copy
	// the struct without tripping the copylocks vet check.
	mu     *sync.Mutex
	ctx    context.Context
	cancel context.CancelFunc

	// cleanup kills the process tree and releases the job object (doc/25
	// W1). Set by Spawn; invoked by the monitor after Wait returns.
	cleanup func()
}

// Snapshot returns a point-in-time copy of the process state that is safe to
// read and JSON-encode without holding any locks. The returned value shares no
// mutable state with the live process.
func (p *SandboxProcess) Snapshot() SandboxProcess {
	p.mu.Lock()
	defer p.mu.Unlock()
	snap := *p
	snap.mu = &sync.Mutex{}
	return snap
}

// SandboxPolicy defines sandbox constraints
type SandboxPolicy struct {
	AllowedPaths     []string `json:"allowedPaths"`
	BlockedCmds      []string `json:"blockedCmds"`
	AllowedCmds      []string `json:"allowed_cmds"`
	AllowAllCommands bool     `json:"allow_all_commands"` // dev mode bypass
	NetworkAccess    bool     `json:"networkAccess"`
	Timeout          int      `json:"timeout"` // seconds
	MaxMemoryMB      int      `json:"maxMemoryMB"`
	EnvWhitelist     []string `json:"envWhitelist"`

	// LowIntegrity starts sandboxed children with a Windows Low-integrity
	// token (doc/25 W2), restricting their writes to Low-IL locations.
	//
	// Default OFF, deliberately: a Low-IL child cannot write to the
	// workspace (an unlabeled/Medium-IL directory), which would break the
	// agent's core file-producing work. Enable only if the workspace is
	// relabeled to Low IL or the sandbox is meant for write-free compute.
	// Degrades honestly (warn log + note) if the token cannot be created.
	LowIntegrity bool `json:"lowIntegrity"`
}
