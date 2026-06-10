// GeoWork Go Core - Model Gateway Providers

package modelgateway

import (
	"fmt"
	"sync"
	"sync/atomic"

	"go.uber.org/zap"
)

// ModelProvider defines a model provider configuration.
type ModelProvider struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Kind            string `json:"kind"` // openai_compatible | ollama | lm_studio | custom
	BaseURL         string `json:"baseUrl"`
	APIKeyRef       string `json:"apiKeyRef,omitempty"`
	DefaultModel    string `json:"defaultModel"`
	Enabled         bool   `json:"enabled"`
	SpeedProfile    string `json:"speedProfile"` // 1x | 2x
	CreatedAt       int64  `json:"createdAt"`
	UpdatedAt       int64  `json:"updatedAt"`
}

// SpeedProfile defines rate/parallelism settings for a provider.
type SpeedProfile struct {
	ID              string `json:"id"`    // "1x" | "2x"
	MaxParallel     int    `json:"maxParallel"`
	TokenBudgetMul  float64 ` json:"tokenBudgetMul"`
	RateLimitMul    float64 ` json:"rateLimitMul"`
}

var speedProfiles = map[string]SpeedProfile{
	"1x": {ID: "1x", MaxParallel: 2, TokenBudgetMul: 1.0, RateLimitMul: 1.0},
	"2x": {ID: "2x", MaxParallel: 6, TokenBudgetMul: 2.0, RateLimitMul: 1.5},
}

// ProviderRegistry stores and manages model providers.
type ProviderRegistry struct {
	mu      sync.RWMutex
	providers map[string]*ModelProvider
	log     *zap.Logger
}

func NewProviderRegistry(log *zap.Logger) *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[string]*ModelProvider),
		log:       log,
	}
}

// Add registers a new provider. Returns existing provider if ID already exists.
func (r *ProviderRegistry) Add(p *ModelProvider) *ModelProvider {
	r.mu.Lock()
	defer r.mu.Unlock()
	if existing, ok := r.providers[p.ID]; ok {
		p.UpdatedAt = nowMs()
		existing.Name = p.Name
		existing.Kind = p.Kind
		existing.BaseURL = p.BaseURL
		existing.APIKeyRef = p.APIKeyRef
		existing.DefaultModel = p.DefaultModel
		existing.Enabled = p.Enabled
		existing.SpeedProfile = p.SpeedProfile
		existing.UpdatedAt = p.UpdatedAt
		return existing
	}
	p.CreatedAt = nowMs()
	p.UpdatedAt = p.CreatedAt
	r.providers[p.ID] = p
	r.log.Info("provider registered", zap.String("id", p.ID))
	return p
}

// Get returns a provider by ID.
func (r *ProviderRegistry) Get(id string) (*ModelProvider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[id]
	return p, ok
}

// List returns all providers.
func (r *ProviderRegistry) List() []ModelProvider {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ModelProvider, 0, len(r.providers))
	for _, p := range r.providers {
		out = append(out, *p)
	}
	return out
}

// Remove deletes a provider by ID.
func (r *ProviderRegistry) Remove(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.providers[id]; !ok {
		return fmt.Errorf("provider %s not found", id)
	}
	delete(r.providers, id)
	r.log.Info("provider removed", zap.String("id", id))
	return nil
}

// ListEnabled returns all enabled providers.
func (r *ProviderRegistry) ListEnabled() []ModelProvider {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ModelProvider, 0)
	for _, p := range r.providers {
		if p.Enabled {
			out = append(out, *p)
		}
	}
	return out
}

// GetSpeedProfile returns the speed profile config.
func GetSpeedProfile(kind string) SpeedProfile {
	if p, ok := speedProfiles[kind]; ok {
		return p
	}
	return speedProfiles["1x"]
}

var startTimeMs = atomic.Int64{}

func init() {
	startTimeMs.Store(nowMs())
}

func nowMs() int64 {
	return startTimeMs.Load()
}
