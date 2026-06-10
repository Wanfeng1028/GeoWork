// GeoWork Go Core - Usage Meter

package modelgateway

import (
	"sync"
	"time"

	"go.uber.org/zap"
)

// UsageRecord tracks token usage per provider/task.
type UsageRecord struct {
	ProviderID string    `json:"providerId"`
	TaskID     string    `json:"taskId"`
	Model      string    `json:"model"`
	PromptTok  int       `json:"promptTokens"`
	Completion int       `json:"completionTokens"`
	TotalTok   int       `json:"totalTokens"`
	At         time.Time `json:"at"`
}

// UsageMeter tracks and reports usage per provider and task.
type UsageMeter struct {
	mu          sync.Mutex
	records     []UsageRecord
	providerMap map[string]int // providerID -> total tokens
	taskMap     map[string]int // taskID -> total tokens
	log         *zap.Logger
}

func NewUsageMeter(log *zap.Logger) *UsageMeter {
	return &UsageMeter{
		records:     make([]UsageRecord, 0),
		providerMap: make(map[string]int),
		taskMap:     make(map[string]int),
		log:         log,
	}
}

// Record adds a usage record.
func (um *UsageMeter) Record(providerID, taskID, model string, promptTok, completionTok int) {
	um.mu.Lock()
	defer um.mu.Unlock()

	record := UsageRecord{
		ProviderID: providerID,
		TaskID:     taskID,
		Model:      model,
		PromptTok:  promptTok,
		Completion: completionTok,
		TotalTok:   promptTok + completionTok,
		At:         time.Now(),
	}
	um.records = append(um.records, record)
	um.providerMap[providerID] += record.TotalTok
	um.taskMap[taskID] += record.TotalTok

	um.log.Info("usage recorded",
		zap.String("provider", providerID),
		zap.String("task", taskID),
		zap.Int("total", record.TotalTok),
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

	total := 0
	for _, r := range um.records {
		total += r.TotalTok
	}

	return map[string]any{
		"totalTokens":   total,
		"totalRecords":  len(um.records),
		"providerUsage": providerTotals,
		"taskUsage":     taskTotals,
	}
}
