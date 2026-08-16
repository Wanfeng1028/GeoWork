// GeoWork Go Core - Diff recorder context
//
// doc/23 A4: write tools (write_file / create_artifact) capture the
// before/after content of each file mutation and report it through a
// DiffRecorder injected on the context by the orchestrator. The
// orchestrator turns each record into a diff.created event on the run's
// SSE stream, which the conversation bridge forwards to frontend
// subscribers (same routing as step_start/step_done).

package toolregistry

import "context"

// DiffRecord describes one file mutation captured by a write tool.
type DiffRecord struct {
	Path       string
	OldContent string
	NewContent string
	// ToolCallID is stamped by the orchestrator's recorder closure
	// (tools do not know their own tool-call id).
	ToolCallID string
}

// DiffRecorder receives file mutations as they happen.
type DiffRecorder func(DiffRecord)

type diffRecorderKey struct{}

// WithDiffRecorder attaches a recorder to the tool execution context.
// A nil recorder leaves the context unchanged.
func WithDiffRecorder(ctx context.Context, rec DiffRecorder) context.Context {
	if rec == nil {
		return ctx
	}
	return context.WithValue(ctx, diffRecorderKey{}, rec)
}

// ReportDiff forwards a captured mutation to the recorder on ctx. It is a
// no-op when no recorder was injected (e.g. registry.Execute called
// directly in tests or outside an orchestrator run).
func ReportDiff(ctx context.Context, rec DiffRecord) {
	if f, ok := ctx.Value(diffRecorderKey{}).(DiffRecorder); ok && f != nil {
		f(rec)
	}
}
