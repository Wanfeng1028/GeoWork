// GeoWork Go Core - Eval Scorer (P2-6)
//
// The Scorer reads a Run's Trajectory and computes a QualityScore —
// a single 0-100 number plus the underlying counts (turns, tool calls,
// errors, tokens, duration). This makes agent behavior comparable
// across runs and lets the eval harness detect regressions.
//
// Score formula (per main doc §7.4):
//   start at 100
//   - 40 if task failed
//   - 2 per turn over 10 (penalize long meandering runs)
//   - 30 * tool_error_rate (penalize flaky tool usage)
//   - 0.0001 per token over 50k (penalize token bloat)
//   clamp to [0, 100]
//
// The scorer is a pure function of the trajectory; it doesn't call the
// orchestrator or model. This keeps it deterministic and cheap enough
// to run on every completed Run.

package eval

import (
	"sync"
	"time"

	"geowork/core/internal/aiagent"
	"geowork/core/internal/modelgateway"
)

// QualityScore is the eval result for one Run.
type QualityScore struct {
	RunID       string        `json:"runId"`
	TaskSuccess bool          `json:"taskSuccess"`
	Turns       int           `json:"turns"`
	ToolCalls   int           `json:"toolCalls"`
	ToolErrors  int           `json:"toolErrors"`
	TokenUsage  int           `json:"tokenUsage"`
	Duration    time.Duration `json:"duration"`
	Score       float64       `json:"score"` // 0-100
}

// Scorer computes QualityScores from Trajectories.
type Scorer struct {
	mu    sync.Mutex
	cache map[string]*QualityScore // runID -> last score (idempotent re-score)
}

func NewScorer() *Scorer {
	return &Scorer{cache: make(map[string]*QualityScore)}
}

// Score computes the QualityScore for one trajectory. If the run has
// been scored before, the cached score is returned (trajectories are
// append-only in practice, so re-scoring yields the same result).
// Pass force=true to bypass the cache.
func (s *Scorer) Score(traj *aiagent.Trajectory, success bool) *QualityScore {
	if traj == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.cache[traj.RunID]; ok && existing != nil {
		return existing
	}

	q := &QualityScore{
		RunID:       traj.RunID,
		TaskSuccess: success,
		Duration:    traj.EndTime.Sub(traj.StartTime),
	}
	if q.Duration < 0 {
		q.Duration = 0
	}

	for _, turn := range traj.Turns {
		q.Turns++
		q.ToolCalls += len(turn.ToolCalls)
		for _, tc := range turn.ToolCalls {
			if tc.Error != "" {
				q.ToolErrors++
			}
		}
		if turn.TokenUsage != nil {
			q.TokenUsage += turn.TokenUsage.TotalTokens
		}
		if q.Duration == 0 && turn.Duration > 0 {
			q.Duration += turn.Duration
		}
	}

	q.Score = calculateScore(q)
	s.cache[traj.RunID] = q
	return q
}

// Get returns a previously-computed score, or nil if not scored yet.
func (s *Scorer) Get(runID string) *QualityScore {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cache[runID]
}

// AllScores returns every score computed so far.
func (s *Scorer) AllScores() []*QualityScore {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]*QualityScore, 0, len(s.cache))
	for _, q := range s.cache {
		out = append(out, q)
	}
	return out
}

// calculateScore implements the §7.4 formula. Kept as a free function
// so it can be unit-tested without a Scorer instance.
func calculateScore(q *QualityScore) float64 {
	score := 100.0
	if !q.TaskSuccess {
		score -= 40
	}
	if q.Turns > 10 {
		score -= float64(q.Turns-10) * 2
	}
	if q.ToolCalls > 0 {
		errRate := float64(q.ToolErrors) / float64(q.ToolCalls)
		score -= errRate * 30
	}
	if q.TokenUsage > 50000 {
		score -= float64(q.TokenUsage-50000) / 10000
	}
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}

// Metrics is the aggregate view across many runs. Returned by the
// /api/agent/eval/metrics endpoint.
type Metrics struct {
	TotalRuns        int     `json:"totalRuns"`
	TaskSuccessRate  float64 `json:"taskSuccessRate"`
	AvgTurns         float64 `json:"avgTurns"`
	AvgToolCalls     float64 `json:"avgToolCalls"`
	ToolErrorRate    float64 `json:"toolErrorRate"`
	AvgTokenUsage    float64 `json:"avgTokenUsage"`
	AvgDuration      float64 `json:"avgDurationMs"`
	UserApprovalRate float64 `json:"userApprovalRate"`
	AvgScore         float64 `json:"avgScore"`
}

// Aggregate computes Metrics over a slice of scores. nil/empty input
// returns a zero Metrics (no divide-by-zero).
func Aggregate(scores []*QualityScore) Metrics {
	m := Metrics{TotalRuns: len(scores)}
	if len(scores) == 0 {
		return m
	}
	success, turns, toolCalls, toolErrors, tokens, dur, scoreSum := 0, 0, 0, 0, 0, 0.0, 0.0
	for _, q := range scores {
		if q.TaskSuccess {
			success++
		}
		turns += q.Turns
		toolCalls += q.ToolCalls
		toolErrors += q.ToolErrors
		tokens += q.TokenUsage
		dur += q.Duration.Seconds() * 1000
		scoreSum += q.Score
	}
	n := float64(len(scores))
	m.TaskSuccessRate = float64(success) / n
	m.AvgTurns = float64(turns) / n
	m.AvgToolCalls = float64(toolCalls) / n
	if toolCalls > 0 {
		m.ToolErrorRate = float64(toolErrors) / float64(toolCalls)
	}
	m.AvgTokenUsage = float64(tokens) / n
	m.AvgDuration = dur / n
	m.AvgScore = scoreSum / n
	// userApprovalRate is computed elsewhere (from the governor's
	// pending/resolved stats) since the scorer doesn't see approvals.
	return m
}

// Compile-time check that we reference modelgateway so the import
// isn't dropped (TokenUsage type comes from there).
var _ *modelgateway.UsageInfo = nil
