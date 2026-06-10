// GeoWork Go Core - Sandbox Models

package sandbox

import (
	"context"
	"time"
)

// SandboxProcess represents a running sandbox process
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
	ctx        context.Context
	cancel     context.CancelFunc
}

// SandboxPolicy defines sandbox constraints
type SandboxPolicy struct {
	AllowedPaths  []string `json:"allowedPaths"`
	BlockedCmds   []string `json:"blockedCmds"`
	NetworkAccess bool     `json:"networkAccess"`
	Timeout       int      `json:"timeout"` // seconds
	MaxMemoryMB   int      `json:"maxMemoryMB"`
	EnvWhitelist  []string `json:"envWhitelist"`
}
