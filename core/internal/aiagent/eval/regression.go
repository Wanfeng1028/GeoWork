// GeoWork Go Core - Eval Regression Suite (P2-6 §7.5)
//
// RegressionTest drives a Run through the orchestrator and checks the
// outcome against an ExpectedResult. RunRegressionTests runs a batch
// of tests sequentially and returns per-test results.
//
// The driver is intentionally synchronous (StartRun + WaitForRun) so
// results are deterministic; parallel execution would interleave token
// usage and skew metrics. Callers wanting parallelism should run
// multiple regression processes.

package eval

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"geowork/core/internal/aiagent"
)

// ExpectedResult defines what a passing regression run looks like.
type ExpectedResult struct {
	Success      bool     `json:"success"`
	MaxTurns     int      `json:"maxTurns"`      // 0 = no limit
	MustContain  string   `json:"mustContain"`   // substring the final reply must include
	MustCallTools []string `json:"mustCallTools"` // tool names that must have been called
}

// RegressionTest is one test case.
type RegressionTest struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Mode     string         `json:"mode"`
	Prompt   string         `json:"prompt"`
	Expected ExpectedResult `json:"expected"`
	Timeout  time.Duration  `json:"timeout,omitempty"` // 0 = default 5min
}

// TestResult is the outcome of one regression test.
type TestResult struct {
	TestID    string        `json:"testId"`
	Passed    bool         `json:"passed"`
	Reason    string        `json:"reason,omitempty"`
	RunID     string        `json:"runId,omitempty"`
	Turns     int           `json:"turns"`
	ToolCalls int           `json:"toolCalls"`
	Duration  time.Duration `json:"duration"`
	Score     float64       `json:"score"`
}

// Runner drives regression tests against an orchestrator.
type Runner struct {
	orch   *aiagent.Orchestrator
	scorer *Scorer
	log    func(format string, args ...any) // optional progress logger
	mu     sync.Mutex
	results []TestResult
}

func NewRunner(orch *aiagent.Orchestrator, scorer *Scorer) *Runner {
	return &Runner{orch: orch, scorer: scorer}
}

// SetLogger wires a progress logger (e.g. fmt.Printf). Optional.
func (r *Runner) SetLogger(fn func(format string, args ...any)) { r.log = fn }

// Run executes one test and returns its result. Does not store in r.results.
func (r *Runner) Run(ctx context.Context, t RegressionTest) TestResult {
	res := TestResult{TestID: t.ID, Turns: 0, ToolCalls: 0}
	if t.Timeout == 0 {
		t.Timeout = 5 * time.Minute
	}
	cctx, cancel := context.WithTimeout(ctx, t.Timeout)
	defer cancel()

	run, err := r.orch.StartRun(cctx, t.Mode, t.Prompt)
	if err != nil {
		res.Reason = "start run failed: " + err.Error()
		return res
	}
	res.RunID = run.ID

	// Wait for completion via the orchestrator's blocker.
	finishedRun, waitErr := r.orch.WaitForRun(cctx, run.ID)
	if waitErr != nil {
		res.Reason = "timeout after " + t.Timeout.String()
		return res
	}
	run = finishedRun

	// Load trajectory to inspect turns + tool calls.
	traj, _ := r.orch.Trajectory().Load(run.ID)
	if traj != nil {
		for _, turn := range traj.Turns {
			res.Turns++
			res.ToolCalls += len(turn.ToolCalls)
		}
		res.Duration = traj.EndTime.Sub(traj.StartTime)
	}

	// Score the run (success inferred from final state).
	success := run.Status == aiagent.StatusCompleted
	if traj != nil && r.scorer != nil {
		q := r.scorer.Score(traj, success)
		if q != nil {
			res.Score = q.Score
		}
	}

	// Validate expectations.
	if err := checkResult(run, traj, t.Expected); err != nil {
		res.Reason = err.Error()
		res.Passed = false
		return res
	}
	res.Passed = true
	return res
}

// RunAll runs a batch of tests sequentially and stores results. Returns
// the slice of results (also accessible via Results()).
func (r *Runner) RunAll(ctx context.Context, tests []RegressionTest) []TestResult {
	out := make([]TestResult, 0, len(tests))
	for _, t := range tests {
		if r.log != nil {
			r.log("running regression test %s (%s)\n", t.ID, t.Name)
		}
		res := r.Run(ctx, t)
		out = append(out, res)
		r.mu.Lock()
		r.results = append(r.results, res)
		r.mu.Unlock()
	}
	return out
}

// Results returns a copy of all results accumulated by RunAll.
func (r *Runner) Results() []TestResult {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]TestResult, len(r.results))
	copy(out, r.results)
	return out
}

// checkResult validates the run against ExpectedResult. Returns nil on pass.
func checkResult(run *aiagent.Run, traj *aiagent.Trajectory, exp ExpectedResult) error {
	if exp.Success && run.Status != aiagent.StatusCompleted {
		return fmt.Errorf("expected success, got status %s", run.Status)
	}
	if traj != nil {
		if exp.MaxTurns > 0 && len(traj.Turns) > exp.MaxTurns {
			return fmt.Errorf("turns %d exceed max %d", len(traj.Turns), exp.MaxTurns)
		}
		if exp.MustContain != "" {
			// Concatenate all model responses and check the substring.
			var sb strings.Builder
			for _, t := range traj.Turns {
				sb.WriteString(t.ModelResponse)
				sb.WriteString(" ")
			}
			if !strings.Contains(sb.String(), exp.MustContain) {
				return fmt.Errorf("response missing required substring %q", exp.MustContain)
			}
		}
		if len(exp.MustCallTools) > 0 {
			called := make(map[string]bool)
			if traj != nil {
				for _, t := range traj.Turns {
					for _, tc := range t.ToolCalls {
						called[tc.ToolName] = true
					}
				}
			}
			for _, name := range exp.MustCallTools {
				if !called[name] {
					return fmt.Errorf("expected tool %q to be called but it wasn't", name)
				}
			}
		}
	}
	return nil
}
