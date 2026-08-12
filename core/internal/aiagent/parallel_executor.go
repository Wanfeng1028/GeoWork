// GeoWork Go Core - Parallel Tool Executor (P3-3 §4.3)
//
// ParallelExecutor batches independent tool calls for parallel
// execution. Same-type consecutive calls (e.g. 3× read_file) run
// concurrently; different types run serially to preserve ordering
// safety for stateful tools.
//
// The orchestrator's ReAct loop uses SpeculativeExecutor (stream-level
// parallelism) as the primary optimization for read-only tools.
// ParallelExecutor is exposed as a utility for callers that execute
// tool batches outside the streaming path (e.g. workflow engine,
// sub-agent fan-out).

package aiagent

import (
	"context"
	"sync"
	"time"

	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// ParallelResult holds one tool call's execution outcome.
type ParallelResult struct {
	Index    int
	ToolName string
	Args     map[string]any
	Result   map[string]any
	Error    error
	Duration time.Duration
}

// ParallelExecutor runs batches of tool calls with bounded parallelism.
type ParallelExecutor struct {
	registry     *toolregistry.Registry
	log          *zap.Logger
	maxParallel  int
}

// NewParallelExecutor builds an executor with the given parallelism cap.
func NewParallelExecutor(registry *toolregistry.Registry, log *zap.Logger, maxParallel int) *ParallelExecutor {
	if maxParallel <= 0 {
		maxParallel = 3
	}
	return &ParallelExecutor{
		registry:    registry,
		log:         log,
		maxParallel: maxParallel,
	}
}

// ExecuteBatch runs a group of tool calls in parallel. Results are
// returned in the same order as the input calls (not completion order).
func (e *ParallelExecutor) ExecuteBatch(ctx context.Context, calls []ParallelCall) []ParallelResult {
	results := make([]ParallelResult, len(calls))
	if len(calls) == 0 {
		return results
	}

	sem := make(chan struct{}, e.maxParallel)
	var wg sync.WaitGroup

	for i, call := range calls {
		wg.Add(1)
		go func(idx int, c ParallelCall) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			start := time.Now()
			toolCtx := toolregistry.WithRunID(ctx, c.RunID)
			res, err := e.registry.Execute(toolCtx, c.ToolName, c.Args, toolregistry.ModeAutonomous)
			results[idx] = ParallelResult{
				Index:    idx,
				ToolName: c.ToolName,
				Args:     c.Args,
				Result:   res,
				Error:    err,
				Duration: time.Since(start),
			}
		}(i, call)
	}
	wg.Wait()
	return results
}

// ParallelCall describes one call in a parallel batch.
type ParallelCall struct {
	ToolName string
	Args     map[string]any
	RunID    string
}

// GroupByType splits a list of tool calls into consecutive same-type
// groups. This is the simple dependency strategy from §4.3: calls of
// the same tool name within a run are assumed independent (safe to
// parallelize); transitions to a different tool name start a new group.
func GroupByType(calls []ParallelCall) [][]ParallelCall {
	if len(calls) == 0 {
		return nil
	}
	var groups [][]ParallelCall
	var current []ParallelCall
	lastTool := ""

	for _, call := range calls {
		if call.ToolName != lastTool && len(current) > 0 {
			groups = append(groups, current)
			current = nil
		}
		current = append(current, call)
		lastTool = call.ToolName
	}
	if len(current) > 0 {
		groups = append(groups, current)
	}
	return groups
}

// ExecuteGrouped runs calls grouped by type: each group runs in
// parallel, groups run serially. Returns results in input order.
func (e *ParallelExecutor) ExecuteGrouped(ctx context.Context, calls []ParallelCall) []ParallelResult {
	groups := GroupByType(calls)
	results := make([]ParallelResult, 0, len(calls))
	for _, group := range groups {
		if len(group) == 1 {
			// Single call — no need for goroutine overhead.
			start := time.Now()
			toolCtx := toolregistry.WithRunID(ctx, group[0].RunID)
			res, err := e.registry.Execute(toolCtx, group[0].ToolName, group[0].Args, toolregistry.ModeAutonomous)
			results = append(results, ParallelResult{
				Index:    len(results),
				ToolName: group[0].ToolName,
				Args:     group[0].Args,
				Result:   res,
				Error:    err,
				Duration: time.Since(start),
			})
		} else {
			groupResults := e.ExecuteBatch(ctx, group)
			results = append(results, groupResults...)
		}
	}
	return results
}
