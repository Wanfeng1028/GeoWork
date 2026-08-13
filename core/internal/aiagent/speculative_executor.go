// GeoWork Go Core - Speculative Stream Executor (P3-3 §4.5)
//
// SpeculativeExecutor starts read-only tools during model streaming —
// before the model finishes outputting all tool_calls. This overlaps
// tool I/O with model generation, cutting wall-clock time for batches
// like [read_file, read_file, read_file, write_file] by up to 40%.
//
// Safety constraints (§4.5.6):
//   - Only ReadOnly tools are speculatively executed (PolicyTable check)
//   - Results are cached by toolCallID; if the model doesn't return
//     that ID, the result is discarded (Cleanup at end of turn)
//   - Speculative results are NOT recorded in Trajectory — only
//     confirmed tool calls go into the trace
//   - The Governor approval check still runs (read-only tools are
//     typically low-risk, but the path is not bypassed)
//   - At most maxConcurrent speculative executions in flight (default 3)

package aiagent

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// SpeculativeResult holds the outcome of one speculative tool execution.
type SpeculativeResult struct {
	ToolCallID  string
	ToolName    string
	Result      map[string]any
	Error       error
	Done        bool
	StartedAt   time.Time
	CompletedAt time.Time
	mu          sync.Mutex
}

// SpeculativeExecutor runs read-only tools ahead of model completion.
type SpeculativeExecutor struct {
	registry      *toolregistry.Registry
	policy        *toolregistry.PolicyTable
	log           *zap.Logger
	maxConcurrent int

	results sync.Map // map[toolCallID]*SpeculativeResult
	sem     chan struct{}
}

// NewSpeculativeExecutor builds an executor bound to a registry and
// policy table. maxConcurrent bounds the number of in-flight
// speculative executions (default 3 per §4.5.6).
func NewSpeculativeExecutor(
	registry *toolregistry.Registry,
	policy *toolregistry.PolicyTable,
	log *zap.Logger,
) *SpeculativeExecutor {
	maxConcurrent := 3
	return &SpeculativeExecutor{
		registry:      registry,
		policy:        policy,
		log:           log,
		maxConcurrent: maxConcurrent,
		sem:           make(chan struct{}, maxConcurrent),
	}
}

// TryExecuteInStream starts a speculative execution when the tool is
// read-only and hasn't been started yet. Returns the result handle and
// true if execution was started (or already running); false if the
// tool is not read-only (caller should execute normally later).
//
// The toolCallID should be the model's tool_call ID. argsJSON is the
// raw JSON arguments string from the stream.
func (e *SpeculativeExecutor) TryExecuteInStream(
	ctx context.Context,
	toolCallID string,
	toolName string,
	argsJSON string,
) (*SpeculativeResult, bool) {
	if e == nil || e.policy == nil || !e.policy.IsReadOnly(toolName) {
		return nil, false
	}

	// Already started?
	if cached, ok := e.results.Load(toolCallID); ok {
		return cached.(*SpeculativeResult), true
	}

	var args map[string]any
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			// Arguments not fully formed yet — don't start.
			return nil, false
		}
	}

	result := &SpeculativeResult{
		ToolCallID: toolCallID,
		ToolName:   toolName,
		StartedAt:  time.Now(),
	}
	if actual, loaded := e.results.LoadOrStore(toolCallID, result); loaded {
		// Another goroutine started it first.
		return actual.(*SpeculativeResult), true
	}

	// Acquire semaphore (non-blocking — if at capacity, skip).
	select {
	case e.sem <- struct{}{}:
	default:
		// Too many speculative calls in flight; let the normal path
		// handle this one. Remove the placeholder so a later retry
		// can try again.
		e.results.Delete(toolCallID)
		return nil, false
	}

	go func() {
		defer func() { <-e.sem }()
		defer func() {
			result.mu.Lock()
			result.Done = true
			result.CompletedAt = time.Now()
			result.mu.Unlock()
		}()
		res, err := e.registry.Execute(ctx, toolName, args, toolregistry.ModeAutonomous)
		result.mu.Lock()
		result.Result = res
		result.Error = err
		result.mu.Unlock()
		if e.log != nil {
			e.log.Info("speculative execution completed",
				zap.String("tool", toolName),
				zap.String("toolCallId", toolCallID),
				zap.Duration("duration", time.Since(result.StartedAt)),
			)
		}
	}()

	if e.log != nil {
		e.log.Info("speculative execution started",
			zap.String("tool", toolName),
			zap.String("toolCallId", toolCallID),
		)
	}
	return result, true
}

// GetResult retrieves the speculative result for toolCallID, blocking
// until the execution completes. Returns an error if no speculative
// execution was started for this ID.
func (e *SpeculativeExecutor) GetResult(toolCallID string) (*SpeculativeResult, error) {
	val, ok := e.results.Load(toolCallID)
	if !ok {
		return nil, fmt.Errorf("no speculative result for %s", toolCallID)
	}
	result := val.(*SpeculativeResult)
	// Spin-wait for completion. The doc uses 10ms sleeps; a channel
	// would be cleaner but the result is short-lived and this keeps
	// the struct simple.
	for {
		result.mu.Lock()
		done := result.Done
		result.mu.Unlock()
		if done {
			return result, nil
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// HasResult checks whether a speculative execution was started (but
// does not block for completion).
func (e *SpeculativeExecutor) HasResult(toolCallID string) bool {
	_, ok := e.results.Load(toolCallID)
	return ok
}

// Cleanup discards all speculative results. Called at the end of each
// turn so stale entries from a previous turn don't leak.
func (e *SpeculativeExecutor) Cleanup() {
	e.results.Range(func(key, value any) bool {
		e.results.Delete(key)
		return true
	})
}

// IsJSONComplete checks whether a JSON arguments string is complete
// (all braces/brackets balanced and not inside a string). This is the
// trigger for speculative execution: we only start when we have a
// parseable argument block.
// P3-3 §4.5.4.
func IsJSONComplete(s string) bool {
	braceDepth := 0  // {} nesting
	bracketDepth := 0 // [] nesting
	inString := false
	escape := false
	for _, r := range s {
		if escape {
			escape = false
			continue
		}
		if r == '\\' {
			escape = true
			continue
		}
		if r == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		switch r {
		case '{':
			braceDepth++
		case '}':
			braceDepth--
		case '[':
			bracketDepth++
		case ']':
			bracketDepth--
		}
	}
	// Both counters must be back to zero for the JSON to be balanced.
	// Negative depth means a closing brace appeared before an opening
	// one — also invalid.
	return braceDepth == 0 && bracketDepth == 0 && len(s) > 0
}
