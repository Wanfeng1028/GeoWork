// GeoWork Go Core - Automation Engine

package automation

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Trigger defines what causes an automation rule to fire
type Trigger string

const (
	TriggerCron       Trigger = "cron"
	TriggerFileChange Trigger = "file_change"
	TriggerEvent      Trigger = "event"
	TriggerWebhook    Trigger = "webhook"
)

// Rule represents an automated action in GeoWork
type Rule struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Trigger     Trigger   `json:"trigger"`
	CronExpr    string    `json:"cronExpr,omitempty"` // cron expression for cron triggers
	Condition   string    `json:"condition,omitempty"` // JSON condition expression
	Action      string    `json:"action"`              // action to perform
	ActionParams string   `json:"actionParams,omitempty"` // JSON params for the action
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	LastRunAt   time.Time `json:"lastRunAt,omitempty"`
	NextRunAt   time.Time `json:"nextRunAt,omitempty"`
}

// Engine manages the lifecycle of automation rules
type Engine struct {
	mu       sync.RWMutex
	rules    map[string]*Rule
	handlers map[Trigger][]func(*Rule) error
	ticker   *time.Ticker
	stopCh   chan struct{}
}

func NewEngine() *Engine {
	return &Engine{
		rules:    make(map[string]*Rule),
		handlers: make(map[Trigger][]func(*Rule) error),
		stopCh:   make(chan struct{}),
	}
}

// RegisterHandler registers a handler for a specific trigger type
func (e *Engine) RegisterHandler(t Trigger, h func(*Rule) error) {
	e.handlers[t] = append(e.handlers[t], h)
}

// AddRule adds a new automation rule
func (e *Engine) AddRule(ctx context.Context, rule *Rule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	rule.Enabled = true
	e.rules[rule.ID] = rule
	return nil
}

// GetRule returns a rule by ID
func (e *Engine) GetRule(id string) (*Rule, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	rule, ok := e.rules[id]
	if !ok {
		return nil, fmt.Errorf("rule %s not found", id)
	}
	return rule, nil
}

// ListRules returns all rules
func (e *Engine) ListRules() []*Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]*Rule, 0, len(e.rules))
	for _, r := range e.rules {
		result = append(result, r)
	}
	return result
}

// DeleteRule removes a rule by ID
func (e *Engine) DeleteRule(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, ok := e.rules[id]; !ok {
		return fmt.Errorf("rule %s not found", id)
	}
	delete(e.rules, id)
	return nil
}

// ToggleRule enables or disables a rule
func (e *Engine) ToggleRule(id string, enabled bool) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	rule, ok := e.rules[id]
	if !ok {
		return fmt.Errorf("rule %s not found", id)
	}
	rule.Enabled = enabled
	rule.UpdatedAt = time.Now().UTC()
	return nil
}

// Tick is called periodically (e.g. every minute) to check cron-triggered rules
func (e *Engine) Tick() {
	e.mu.RLock()
	for _, rule := range e.rules {
		if !rule.Enabled || rule.Trigger != TriggerCron {
			continue
		}
		// Simple cron-like check: if nextRunAt is in the past or zero, fire
		if rule.NextRunAt.IsZero() || time.Now().UTC().After(rule.NextRunAt) {
			e.fireRule(rule)
		}
	}
	e.mu.RUnlock()
}

// fireRule executes the action for a rule
func (e *Engine) fireRule(rule *Rule) {
	rule.LastRunAt = time.Now().UTC()
	e.mu.Lock()
	e.rules[rule.ID] = rule
	e.mu.Unlock()

	if handler, ok := e.handlers[rule.Trigger]; ok {
		for _, h := range handler {
			_ = h(rule)
		}
	}
}

// Start begins the automation engine's tick loop
func (e *Engine) Start(interval time.Duration) {
	e.ticker = time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-e.ticker.C:
				e.Tick()
			case <-e.stopCh:
				return
			}
		}
	}()
}

// Stop halts the automation engine
func (e *Engine) Stop() {
	if e.ticker != nil {
		e.ticker.Stop()
	}
	close(e.stopCh)
}
