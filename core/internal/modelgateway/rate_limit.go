// GeoWork Go Core - Rate Limiter

package modelgateway

import (
	"sync"
	"sync/atomic"
	"time"
)

// RateLimiter enforces per-provider QPS and per-task concurrency limits.
type RateLimiter struct {
	mu        sync.Mutex
	providers map[string]*providerLimiter
	tasks     map[string]*taskLimiter
	maxTasks  int
}

type providerLimiter struct {
	mu         sync.Mutex
	tokens     int64
	maxTokens  int64
	refillRate int64
	lastRefill time.Time
}

type taskLimiter struct {
	active    atomic.Int32
	maxActive int
}

// NewRateLimiter creates a rate limiter.
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		providers: make(map[string]*providerLimiter),
		tasks:     make(map[string]*taskLimiter),
		maxTasks:  100,
	}
}

// ConfigureProvider sets up QPS limit for a provider.
func (rl *RateLimiter) ConfigureProvider(providerID string, qps int, profile SpeedProfile) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	tokens := int64(qps) * int64(profile.RateLimitMul)
	if tokens < 1 {
		tokens = 1
	}
	rl.providers[providerID] = &providerLimiter{
		maxTokens:  tokens,
		refillRate: tokens,
		lastRefill: time.Now(),
		tokens:     tokens,
	}
}

// AcquireProvider tries to acquire a token from the provider bucket.
func (rl *RateLimiter) AcquireProvider(providerID string) bool {
	rl.mu.Lock()
	pl, ok := rl.providers[providerID]
	rl.mu.Unlock()

	if !ok {
		return true // no limit configured
	}

	pl.mu.Lock()
	defer pl.mu.Unlock()

	// Refill tokens
	now := time.Now()
	elapsed := now.Sub(pl.lastRefill).Seconds()
	refill := int64(float64(pl.refillRate) * elapsed)
	pl.tokens += refill
	if pl.tokens > pl.maxTokens {
		pl.tokens = pl.maxTokens
	}
	pl.lastRefill = now

	if pl.tokens < 1 {
		return false
	}
	pl.tokens--
	return true
}

// ConfigureTask sets concurrency limit for a task.
func (rl *RateLimiter) ConfigureTask(taskID string, maxActive int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.tasks[taskID] = &taskLimiter{maxActive: maxActive}
}

// AcquireTask tries to acquire a slot for the task.
func (rl *RateLimiter) AcquireTask(taskID string) bool {
	rl.mu.Lock()
	tl, ok := rl.tasks[taskID]
	rl.mu.Unlock()

	if !ok {
		return true // no limit configured
	}

	current := tl.active.Add(1)
	if current > int32(tl.maxActive) {
		tl.active.Add(-1)
		return false
	}
	return true
}

// ReleaseTask releases a task slot.
func (rl *RateLimiter) ReleaseTask(taskID string) {
	rl.mu.Lock()
	if tl, ok := rl.tasks[taskID]; ok {
		tl.active.Add(-1)
	}
	rl.mu.Unlock()
}

// Reset clears all limits.
func (rl *RateLimiter) Reset() {
	rl.mu.Lock()
	rl.providers = make(map[string]*providerLimiter)
	rl.tasks = make(map[string]*taskLimiter)
	rl.mu.Unlock()
}
