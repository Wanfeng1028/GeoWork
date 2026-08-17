//go:build !windows

// GeoWork Go Core - Job Object stub for non-Windows platforms (doc/25 W1)
//
// Job Objects are a Windows kernel primitive. On Unix the process-tree
// kill is provided by process groups (Setpgid + kill -PGID) in the
// spawn helper instead. This stub keeps the API uniform so callers
// don't need build tags; memory limits are honestly unenforced here.

package jobobject

import "os"

// Job is a no-op placeholder on non-Windows platforms.
type Job struct{}

// New returns a placeholder job. memLimitMB is accepted for API parity
// but not enforced — Unix enforcement would need cgroups/rlimits, which
// is out of scope for doc/25 (honestly documented as unenforced).
func New(memLimitMB int) (*Job, error) {
	return &Job{}, nil
}

// Assign is a no-op on non-Windows platforms.
func (j *Job) Assign(p *os.Process) error { return nil }

// Close is a no-op on non-Windows platforms.
func (j *Job) Close() error { return nil }
