// GeoWork Go Core - Usage Meter
//
// P1-2 §3.5: token usage auditing. The UsageMeter captures per-call
// token counts (including prompt-cache hits via CachedTokens) and
// aggregates them by run / provider / task for the audit API:
//
//	GET /api/agent/usage/{runId}     — per-run totals
//	GET /api/agent/usage/summary     — global totals + breakdowns

package modelgateway

import (
	"sync"
	"time"

	"go.uber.org/zap"
)

// UsageRecord tracks token usage for a single model call.
type UsageRecord struct {
	RunID            string    `json:"runId,omitempty"`
	ProviderID       string    `json:"providerId"`
	TaskID           string    `json:"taskId,omitempty"`
	Model            string    `json:"model"`
	PromptTokens     int       `json:"promptTokens"`
	CompletionTokens int       `json:"completionTokens"`
	// CachedTokens is the number of prompt tokens served from the
	// provider's prompt cache (P1-2 §3.5 v0.2). 0 when not reported.
	CachedTokens int `json:"cachedTokens,omitempty"`
	TotalTokens  int `json:"totalTokens"`
	// EstimatedCost is the dollar cost of this call, computed by the
	// caller from provider pricing tables. 0 when pricing is unknown.
	EstimatedCost float64   `json:"estimatedCost,omitempty"`
	At            time.Time `json:"at"`
}

// UsageMeter tracks and reports usage per run / provider / task.
// Thread-safe; safe for concurrent Record / Get* / Summary calls.
type UsageMeter struct {
	mu          sync.Mutex
	records     []UsageRecord
	providerMap map[string]int // providerID -> total tokens
	taskMap     map[string]int // taskID -> total tokens
	runMap      map[string]int // runID -> total tokens
	log         *zap.Logger
}

// NewUsageMeter constructs an empty UsageMeter.
func NewUsageMeter(log *zap.Logger) *UsageMeter {
	if log == nil {
		log = zap.NewNop()
	}
	return &UsageMeter{
		records:     make([]UsageRecord, 0),
		providerMap: make(map[string]int),
		taskMap:     make(map[string]int),
		runMap:      make(map[string]int),
		log:         log,
	}
}

// Record adds a usage record. The usage pointer may be nil — in that
// case a zero-token record is still appended so callers can attribute
// a (failed) call to a run. cost is the caller-computed dollar cost.
func (um *UsageMeter) Record(runID, providerID, taskID, model string, usage *UsageInfo, cost float64) {
	um.mu.Lock()
	defer um.mu.Unlock()

	promptTok := 0
	completionTok := 0
	cachedTok := 0
	totalTok := 0
	if usage != nil {
		promptTok = usage.PromptTokens
		completionTok = usage.CompletionTokens
		cachedTok = usage.CachedTokens
		if usage.TotalTokens > 0 {
			totalTok = usage.TotalTokens
		} else {
			totalTok = promptTok + completionTok
		}
	}

	record := UsageRecord{
		RunID:            runID,
		ProviderID:       providerID,
		TaskID:           taskID,
		Model:            model,
		PromptTokens:     promptTok,
		CompletionTokens: completionTok,
		CachedTokens:     cachedTok,
		TotalTokens:      totalTok,
		EstimatedCost:    cost,
		At:               time.Now(),
	}
	um.records = append(um.records, record)
	if providerID != "" {
		um.providerMap[providerID] += totalTok
	}
	if taskID != "" {
		um.taskMap[taskID] += totalTok
	}
	if runID != "" {
		um.runMap[runID] += totalTok
	}

	um.log.Info("usage recorded",
		zap.String("run", runID),
		zap.String("provider", providerID),
		zap.String("task", taskID),
		zap.Int("prompt", promptTok),
		zap.Int("completion", completionTok),
		zap.Int("cached", cachedTok),
		zap.Int("total", totalTok),
		zap.Float64("cost", cost),
	)
}

// GetProviderUsage returns total tokens for a provider.
func (um *UsageMeter) GetProviderUsage(providerID string) int {
	um.mu.Lock()
	defer um.mu.Unlock()
	return um.providerMap[providerID]
}

// GetTaskUsage returns total tokens for a task.
func (um *UsageMeter) GetTaskUsage(taskID string) int {
	um.mu.Lock()
	defer um.mu.Unlock()
	return um.taskMap[taskID]
}

// GetRunUsage returns total tokens for an agent run (P1-2 §3.6).
func (um *UsageMeter) GetRunUsage(runID string) int {
	um.mu.Lock()
	defer um.mu.Unlock()
	return um.runMap[runID]
}

// GetRunRecords returns all usage records attributed to runID.
// Used by GET /api/agent/usage/{runId} to itemize per-call token counts.
func (um *UsageMeter) GetRunRecords(runID string) []UsageRecord {
	um.mu.Lock()
	defer um.mu.Unlock()
	out := make([]UsageRecord, 0)
	for _, r := range um.records {
		if r.RunID == runID {
			out = append(out, r)
		}
	}
	return out
}

// GetAllRecords returns all usage records.
func (um *UsageMeter) GetAllRecords() []UsageRecord {
	um.mu.Lock()
	defer um.mu.Unlock()
	out := make([]UsageRecord, len(um.records))
	copy(out, um.records)
	return out
}

// Summary returns aggregated usage stats.
func (um *UsageMeter) Summary() map[string]any {
	um.mu.Lock()
	defer um.mu.Unlock()

	providerTotals := make(map[string]int)
	for k, v := range um.providerMap {
		providerTotals[k] = v
	}
	taskTotals := make(map[string]int)
	for k, v := range um.taskMap {
		taskTotals[k] = v
	}
	runTotals := make(map[string]int)
	for k, v := range um.runMap {
		runTotals[k] = v
	}

	total := 0
	cached := 0
	cost := 0.0
	for _, r := range um.records {
		total += r.TotalTokens
		cached += r.CachedTokens
		cost += r.EstimatedCost
	}

	return map[string]any{
		"totalTokens":   total,
		"cachedTokens":  cached,
		"totalCost":     cost,
		"totalRecords":  len(um.records),
		"providerUsage": providerTotals,
		"taskUsage":     taskTotals,
		"runUsage":      runTotals,
	}
}
