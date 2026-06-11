package modelgateway

import (
	"fmt"
	"sync"
)

// SpeedProfileConfig defines concurrency and resource limits for model requests.
type SpeedProfileConfig struct {
	ID                    string  `json:"id"`
	Name                  string  `json:"name"`
	MaxParallelRequests   int     `json:"maxParallelRequests"`
	TokenBudgetMultiplier float64 `json:"tokenBudgetMultiplier"`
	RateLimitMultiplier   float64 `json:"rateLimitMultiplier"`
	Description           string  `json:"description"`
}

// Validate checks that the profile config has required fields and valid ranges.
func (p *SpeedProfileConfig) Validate() error {
	if p.ID == "" {
		return fmt.Errorf("speed profile config ID must not be empty")
	}
	if p.Name == "" {
		return fmt.Errorf("speed profile config name must not be empty for %s", p.ID)
	}
	if p.MaxParallelRequests <= 0 || p.MaxParallelRequests > 50 {
		return fmt.Errorf("speed profile config %s: maxParallelRequests must be between 1 and 50, got %d", p.ID, p.MaxParallelRequests)
	}
	if p.TokenBudgetMultiplier <= 0 || p.TokenBudgetMultiplier > 5.0 {
		return fmt.Errorf("speed profile config %s: tokenBudgetMultiplier must be between 0 and 5.0, got %f", p.ID, p.TokenBudgetMultiplier)
	}
	if p.RateLimitMultiplier <= 0 || p.RateLimitMultiplier > 5.0 {
		return fmt.Errorf("speed profile config %s: rateLimitMultiplier must be between 0 and 5.0, got %f", p.ID, p.RateLimitMultiplier)
	}
	return nil
}

// DefaultProfiles are the built-in speed profile configs shipped with GeoWork.
var DefaultProfiles = []*SpeedProfileConfig{
	{
		ID:                    "1x",
		Name:                  "标准 (1x)",
		MaxParallelRequests:   2,
		TokenBudgetMultiplier: 1.0,
		RateLimitMultiplier:   1.0,
		Description:           "标准速度，最低成本和延迟",
	},
	{
		ID:                    "2x",
		Name:                  "加速 (2x)",
		MaxParallelRequests:   5,
		TokenBudgetMultiplier: 1.5,
		RateLimitMultiplier:   1.5,
		Description:           "加速模式，更高并发和成本",
	},
	{
		ID:                    "turbo",
		Name:                  "极速 (Turbo)",
		MaxParallelRequests:   10,
		TokenBudgetMultiplier: 2.0,
		RateLimitMultiplier:   2.0,
		Description:           "极速模式，最大并发和最高成本",
	},
}

// SpeedProfileManager manages speed profile configs for the model gateway.
type SpeedProfileManager struct {
	mu        sync.RWMutex
	profiles  map[string]*SpeedProfileConfig
	defaultID string
}

// NewSpeedProfileManager creates a SpeedProfileManager with the given default profile ID.
func NewSpeedProfileManager(defaultID string) *SpeedProfileManager {
	return &SpeedProfileManager{
		profiles:  make(map[string]*SpeedProfileConfig),
		defaultID: defaultID,
	}
}

// Register adds a custom profile config to the manager.
func (m *SpeedProfileManager) Register(profile *SpeedProfileConfig) error {
	if err := profile.Validate(); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.profiles[profile.ID] = profile
	return nil
}

// Get returns the profile config with the given ID, or an error if not found.
func (m *SpeedProfileManager) Get(id string) (*SpeedProfileConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.profiles[id]
	if !ok {
		return nil, fmt.Errorf("speed profile config %q not found", id)
	}
	return p, nil
}

// GetDefault returns the currently configured default profile config.
func (m *SpeedProfileManager) GetDefault() *SpeedProfileConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.profiles[m.defaultID]
}

// List returns all registered profile configs.
func (m *SpeedProfileManager) List() []*SpeedProfileConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*SpeedProfileConfig, 0, len(m.profiles))
	for _, p := range m.profiles {
		result = append(result, p)
	}
	return result
}

// SetDefault sets the default profile config by ID.
func (m *SpeedProfileManager) SetDefault(id string) error {
	m.mu.RLock()
	if _, ok := m.profiles[id]; !ok {
		m.mu.RUnlock()
		return fmt.Errorf("speed profile config %q not found, cannot set as default", id)
	}
	m.mu.RUnlock()

	m.mu.Lock()
	defer m.mu.Unlock()
	m.defaultID = id
	return nil
}

// Delete removes a custom profile config by ID.
func (m *SpeedProfileManager) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.profiles[id]; !ok {
		return fmt.Errorf("speed profile config %q not found", id)
	}
	delete(m.profiles, id)
	if m.defaultID == id {
		m.defaultID = ""
	}
	return nil
}

// LoadDefaults loads the built-in DefaultProfiles into the manager.
func (m *SpeedProfileManager) LoadDefaults() error {
	for _, profile := range DefaultProfiles {
		if err := m.Register(profile); err != nil {
			return fmt.Errorf("failed to register default profile config %s: %w", profile.ID, err)
		}
	}
	return nil
}

// GetEffectiveLimits computes the effective concurrency and rate limits
// based on the given base QPS and the active speed profile config.
func (m *SpeedProfileManager) GetEffectiveLimits(baseQPS int) (maxRequests int, rateLimit float64, tokenMultiplier float64) {
	profile := m.GetDefault()
	if profile == nil {
		return baseQPS, float64(baseQPS), 1.0
	}
	return profile.MaxParallelRequests, float64(baseQPS) * profile.RateLimitMultiplier, profile.TokenBudgetMultiplier
}
