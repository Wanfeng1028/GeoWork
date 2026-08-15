// GeoWork Go Core - Agent Event Triggers (P2-4 §5.4)
//
// TriggerManager subscribes to external events (file_changed, webhook,
// etc.) and starts an Agent run when the event matches a registered
// Trigger. Pattern matching uses filepath.Match so triggers like "*.py"
// "src/**/*.go" map naturally onto filesystem events.

package aiagent

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Trigger maps an external event to an Agent run.
type Trigger struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Event   string `json:"event"`   // event type, e.g. "file_changed"
	Pattern string `json:"pattern"` // filepath.Match pattern applied to data["path"]
	Mode    string `json:"mode"`    // Agent Mode
	Prompt  string `json:"prompt"`  // prompt template; %s placeholders filled from data
	Enabled bool   `json:"enabled"`
}

// TriggerManager dispatches events to matching triggers.
type TriggerManager struct {
	mu       sync.RWMutex
	triggers map[string]*Trigger
	orch     *Orchestrator
	log      *zap.Logger
	wg       sync.WaitGroup
}

// NewTriggerManager builds a trigger manager bound to an orchestrator.
func NewTriggerManager(orch *Orchestrator, log *zap.Logger) *TriggerManager {
	return &TriggerManager{
		triggers: make(map[string]*Trigger),
		orch:     orch,
		log:      log,
	}
}

// Add registers a trigger. Returns an error if a trigger with the same
// ID already exists.
func (tm *TriggerManager) Add(t *Trigger) error {
	if t == nil {
		return fmt.Errorf("nil trigger")
	}
	if t.ID == "" {
		return fmt.Errorf("trigger ID required")
	}
	tm.mu.Lock()
	defer tm.mu.Unlock()
	if _, exists := tm.triggers[t.ID]; exists {
		return fmt.Errorf("trigger %q already exists", t.ID)
	}
	tm.triggers[t.ID] = t
	if tm.log != nil {
		tm.log.Info("trigger added",
			zap.String("id", t.ID),
			zap.String("event", t.Event),
			zap.String("pattern", t.Pattern),
		)
	}
	return nil
}

// Update modifies a trigger. Only non-zero fields in the patch are applied.
func (tm *TriggerManager) Update(id string, patch Trigger) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	t, ok := tm.triggers[id]
	if !ok {
		return fmt.Errorf("trigger %q not found", id)
	}
	if patch.Name != "" {
		t.Name = patch.Name
	}
	if patch.Event != "" {
		t.Event = patch.Event
	}
	if patch.Pattern != "" {
		t.Pattern = patch.Pattern
	}
	if patch.Mode != "" {
		t.Mode = patch.Mode
	}
	if patch.Prompt != "" {
		t.Prompt = patch.Prompt
	}
	t.Enabled = patch.Enabled
	return nil
}

// Remove deletes a trigger.
func (tm *TriggerManager) Remove(id string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	if _, ok := tm.triggers[id]; !ok {
		return fmt.Errorf("trigger %q not found", id)
	}
	delete(tm.triggers, id)
	return nil
}

// List returns a snapshot of all triggers.
func (tm *TriggerManager) List() []Trigger {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	out := make([]Trigger, 0, len(tm.triggers))
	for _, t := range tm.triggers {
		out = append(out, *t)
	}
	return out
}

// Get returns a copy of a trigger by ID.
func (tm *TriggerManager) Get(id string) (*Trigger, error) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	t, ok := tm.triggers[id]
	if !ok {
		return nil, fmt.Errorf("trigger %q not found", id)
	}
	cp := *t
	return &cp, nil
}

// HandleEvent dispatches `event` with payload `data` to all matching
// triggers. Each matching trigger fires an Agent run in its own
// goroutine so a slow trigger doesn't block the event source.
//
// `data` is matched as follows:
//   - data["path"] (string) is matched against trigger.Pattern via filepath.Match
//   - data["value"] / data["payload"] (string) is substituted into the
//     prompt via fmt.Sprintf when the trigger's Prompt contains %s.
func (tm *TriggerManager) HandleEvent(event string, data map[string]any) {
	tm.mu.RLock()
	matching := make([]*Trigger, 0)
	for _, t := range tm.triggers {
		if !t.Enabled {
			continue
		}
		if t.Event != event {
			continue
		}
		if t.Pattern != "" {
			path, _ := data["path"].(string)
			if path == "" {
				continue
			}
			// Match against the full path first so patterns containing
			// "/" (e.g. "src/**/*.go") work as expected. Fall back to
			// Base(path) so simple filename patterns (e.g. "*.py") keep
			// matching regardless of directory.
			matched, err := filepath.Match(t.Pattern, path)
			if err != nil || !matched {
				matched, err = filepath.Match(t.Pattern, filepath.Base(path))
				if err != nil || !matched {
					continue
				}
			}
		}
		matching = append(matching, t)
	}
	tm.mu.RUnlock()

	for _, t := range matching {
		tm.fireRun(t, data)
	}
}

func (tm *TriggerManager) fireRun(t *Trigger, data map[string]any) {
	prompt := t.Prompt
	if path, ok := data["path"].(string); ok && path != "" {
		// Simple substitution: replace the first %s in Prompt with path.
		// fmt.Sprintf would fail if Prompt has no placeholder, so guard it.
		if containsSprintfPlaceholder(prompt) {
			prompt = fmt.Sprintf(prompt, path)
		} else {
			prompt = prompt + "\n\nContext path: " + path
		}
	}

	tm.wg.Add(1)
	go func() {
		defer tm.wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		run, err := tm.orch.StartRun(ctx, t.Mode, prompt)
		if tm.log != nil {
			if err != nil {
				tm.log.Warn("trigger run failed to start",
					zap.String("trigger", t.ID),
					zap.String("event", t.Event),
					zap.Error(err),
				)
			} else {
				tm.log.Info("trigger run started",
					zap.String("trigger", t.ID),
					zap.String("event", t.Event),
					zap.String("runId", run.ID),
				)
			}
		}
	}()
}

// Wait blocks until all in-flight trigger runs have returned. Used by
// tests and graceful shutdown.
func (tm *TriggerManager) Wait() {
	tm.wg.Wait()
}

// containsSprintfPlaceholder reports whether s contains a %s verb safe
// to pass to fmt.Sprintf.
func containsSprintfPlaceholder(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == '%' && i+1 < len(s) {
			if s[i+1] == 's' {
				return true
			}
			i++ // skip escaped %% and other verbs
		}
	}
	return false
}
