//go:build windows

// GeoWork Go Core - Low-integrity token (doc/25 W2)
//
// Token wraps a Windows primary token whose mandatory integrity level has
// been lowered to Low. A child started with this token can only write to
// Low-integrity locations (e.g. %LOCALAPPDATA%\Low) and to objects
// explicitly labeled to accept Low writes — it cannot scribble over the
// user's normal files or most of the registry.
//
// This is best-effort isolation, not a hard boundary:
//   - Lowering a token's integrity normally succeeds for a standard
//     desktop user lowering its OWN token; locked-down or policy-
//     restricted environments may fail, in which case New returns an
//     error and the caller degrades honestly (log + run without it).
//   - It does not restrict network, CPU, or reads. Those are out of
//     scope for doc/25 (honestly documented as unenforced).
//
// Lifecycle: New() → Apply(cmd) before cmd.Start() → Close() once the
// child is spawned (the OS hands the child its own copy of the token).

package lowintegrity

import (
	"fmt"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// tokenMandatoryLabel mirrors the Win32 TOKEN_MANDATORY_LABEL. x/sys
// does not export it, so it is defined here.
type tokenMandatoryLabel struct {
	Label windows.SIDAndAttributes
}

// lowIntegritySID is the well-known mandatory label for Low integrity.
// Mandatory label SIDs are S-1-16-<RID>; the Low RID is 0x1000 (4096).
const lowIntegritySID = "S-1-16-4096"

// Token is a Low-integrity primary token the caller owns.
type Token struct {
	handle windows.Token
}

// New duplicates the current process token and lowers its integrity
// level to Low. Returns an error if the token cannot be created or
// lowered — callers must treat that as "isolation unavailable" and
// degrade honestly, never silently pretending to be isolated.
func New() (*Token, error) {
	var procToken windows.Token
	err := windows.OpenProcessToken(
		windows.CurrentProcess(),
		windows.TOKEN_DUPLICATE|windows.TOKEN_ASSIGN_PRIMARY|windows.TOKEN_QUERY,
		&procToken,
	)
	if err != nil {
		return nil, fmt.Errorf("open process token: %w", err)
	}
	defer procToken.Close()

	var newToken windows.Token
	err = windows.DuplicateTokenEx(
		procToken,
		windows.TOKEN_ALL_ACCESS,
		nil,
		windows.SecurityImpersonation,
		windows.TokenPrimary,
		&newToken,
	)
	if err != nil {
		return nil, fmt.Errorf("duplicate token: %w", err)
	}

	// StringToSid returns a Go-heap copy of the SID and frees the native
	// buffer itself — do NOT LocalFree the returned pointer (that would
	// free Go memory and corrupt the heap). The copy is garbage-collected.
	sid, err := windows.StringToSid(lowIntegritySID)
	if err != nil {
		newToken.Close()
		return nil, fmt.Errorf("build low-integrity SID: %w", err)
	}

	label := tokenMandatoryLabel{
		Label: windows.SIDAndAttributes{
			Sid:        sid,
			Attributes: windows.SE_GROUP_INTEGRITY,
		},
	}
	err = windows.SetTokenInformation(
		newToken,
		windows.TokenIntegrityLevel,
		(*byte)(unsafe.Pointer(&label)),
		uint32(unsafe.Sizeof(label)),
	)
	if err != nil {
		newToken.Close()
		return nil, fmt.Errorf("set token integrity level: %w", err)
	}

	return &Token{handle: newToken}, nil
}

// Apply sets the token on cmd so the child process runs with it. Must be
// called after SysProcAttr is initialized and before cmd.Start().
func (t *Token) Apply(cmd *exec.Cmd) {
	if t == nil || cmd == nil {
		return
	}
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	// windows.Token and syscall.Token are both uintptr handles; convert
	// through uintptr to bridge the two named types.
	cmd.SysProcAttr.Token = syscall.Token(uintptr(t.handle))
}

// Close releases the token handle. Safe to call multiple times. Call it
// after cmd.Start() — the child holds its own copy by then.
func (t *Token) Close() error {
	if t == nil || t.handle == 0 {
		return nil
	}
	err := t.handle.Close()
	t.handle = 0
	return err
}
