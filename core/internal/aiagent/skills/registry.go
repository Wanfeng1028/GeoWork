// GeoWork Go Core - Skills Registry (P2-1)
//
// A Skill is a packaged capability bundle: a System Prompt fragment
// (SKILL.md) plus a recommended tool list plus a few default args.
// When a skill is active, ContextBuilder appends its PromptSnippet to
// the system message so the model behaves as a domain specialist
// (GIS analyst, paper writer, code reviewer, ...).
//
// Skills are loaded in two phases (main doc §7.3):
//   - Phase 1 (startup): scan skills/ and read only manifest/meta.json
//     to build a lightweight index.
//   - Phase 2 (on use): read the full skill/SKILL.md body lazily and
//     cache it on the Skill struct.

package skills

import (
	"fmt"
	"sync"
)

// SkillMeta is the phase-1 metadata read from manifest/meta.json.
type SkillMeta struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Version      string   `json:"version"`
	Description  string   `json:"description"`
	Tags         []string `json:"tags"`
	Mode         string   `json:"mode"`         // Work/Code/Paper/Analysis/Write
	Dependencies []string `json:"dependencies"` // other skill IDs this one relies on
}

// Skill is the full skill record. Prompt is populated lazily by
// Loader.LoadFullContent (phase 2). Loaded tracks whether phase 2
// has run so we don't re-read SKILL.md on every Build.
type Skill struct {
	Meta   SkillMeta
	Prompt string // SKILL.md body (phase 2)
	Dir    string // skill directory path

	// RecommendedTools lists builtin/MCP tool names the skill prefers.
	// ContextBuilder surfaces these first when the skill is active.
	RecommendedTools []string `json:"recommendedTools,omitempty"`

	// DefaultArgs are suggested defaults injected into the run context
	// (e.g. {"language": "python"} for gis-analysis).
	DefaultArgs map[string]any `json:"defaultArgs,omitempty"`

	// Examples are optional few-shot examples appended to the prompt.
	Examples []Example `json:"examples,omitempty"`

	Loaded bool
}

// Example is a single few-shot demonstration for the skill.
type Example struct {
	UserInput         string   `json:"userInput"`
	AssistantResponse string   `json:"assistantResponse"`
	ToolCalls         []string `json:"toolCalls,omitempty"`
}

// Registry is the in-memory skill index. Register is idempotent on
// overwrite (returns an error on duplicate ID so callers don't
// accidentally shadow a builtin).
type Registry struct {
	mu     sync.RWMutex
	skills map[string]*Skill
}

func NewRegistry() *Registry {
	return &Registry{skills: make(map[string]*Skill)}
}

// Register adds a skill. Returns an error if the ID already exists.
func (r *Registry) Register(s *Skill) error {
	if s == nil {
		return fmt.Errorf("cannot register nil skill")
	}
	if s.Meta.ID == "" {
		return fmt.Errorf("skill has empty ID")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.skills[s.Meta.ID]; exists {
		return fmt.Errorf("skill %q already registered", s.Meta.ID)
	}
	r.skills[s.Meta.ID] = s
	return nil
}

// RegisterOrReplace adds a skill, replacing any existing one with the
// same ID. Used by the loader when re-scanning the skills directory.
func (r *Registry) RegisterOrReplace(s *Skill) {
	if s == nil || s.Meta.ID == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.skills[s.Meta.ID] = s
}

// Get returns the skill with the given ID. The returned pointer is
// safe to read; callers must not mutate it.
func (r *Registry) Get(id string) (*Skill, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.skills[id]
	if !ok {
		return nil, fmt.Errorf("skill %q not found", id)
	}
	return s, nil
}

// List returns all registered skills in arbitrary order.
func (r *Registry) List() []*Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Skill, 0, len(r.skills))
	for _, s := range r.skills {
		out = append(out, s)
	}
	return out
}

// ListForMode returns skills whose Meta.Mode matches mode or is empty
// (empty Mode = applies to all modes).
func (r *Registry) ListForMode(mode string) []*Skill {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Skill, 0)
	for _, s := range r.skills {
		if s.Meta.Mode == "" || s.Meta.Mode == mode {
			out = append(out, s)
		}
	}
	return out
}

// Delete removes a skill by ID.
func (r *Registry) Delete(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.skills, id)
}

// Count returns the number of registered skills.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.skills)
}
