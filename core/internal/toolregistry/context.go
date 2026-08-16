// GeoWork Go Core - Tool execution context values
//
// doc/22 BP1: sandboxed execution tools (run_shell / run_python) need the
// run's workspace directory so they can pin cmd.Dir to it. The orchestrator
// injects it via WithWorkspacePath alongside the run ID and permission
// policy; tools read it back with WorkspacePathFromContext.

package toolregistry

import "context"

type workspaceKey struct{}

// WithWorkspacePath attaches the run's workspace directory to the context.
func WithWorkspacePath(ctx context.Context, dir string) context.Context {
	if dir == "" {
		return ctx
	}
	return context.WithValue(ctx, workspaceKey{}, dir)
}

// WorkspacePathFromContext returns the workspace directory pinned for this
// run, or "" when none was injected (tools then fall back to the process
// working directory).
func WorkspacePathFromContext(ctx context.Context) string {
	v, _ := ctx.Value(workspaceKey{}).(string)
	return v
}
