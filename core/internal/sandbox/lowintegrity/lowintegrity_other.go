//go:build !windows

// GeoWork Go Core - Low-integrity token stub for non-Windows (doc/25 W2)
//
// Mandatory integrity levels are a Windows security mechanism with no
// direct Unix equivalent (the closest analogs — seccomp, namespaces,
// capability bounding sets — are out of scope for doc/25). This stub
// keeps the API uniform so spawn.go needs no build tags; write-scope
// isolation is honestly reported as unenforced on Unix.

package lowintegrity

import "os/exec"

// Token is a placeholder on non-Windows platforms.
type Token struct{}

// New returns (nil, nil) on non-Windows: there is no integrity-level
// token to create, and that is not an error — callers check for a nil
// token and simply skip the isolation. A non-nil error is reserved for
// the Windows path, where creation can genuinely fail and must degrade
// honestly (log + run without it).
func New() (*Token, error) {
	return nil, nil
}

// Apply is a no-op on non-Windows platforms.
func (t *Token) Apply(cmd *exec.Cmd) {}

// Close is a no-op on non-Windows platforms.
func (t *Token) Close() error { return nil }
