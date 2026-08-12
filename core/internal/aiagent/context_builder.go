// GeoWork Go Core - Agent Context Builder

package aiagent

import (
	"geowork/core/internal/aiagent/skills"
	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// ToolDef / ToolFunction are aliased to the modelgateway definitions so
// that ContextBuilder.Build returns []modelgateway.ToolDef directly,
// avoiding the type-mismatch errors that arise when the orchestrator
// passes a locally-defined []ToolDef to gateway methods that expect
// []modelgateway.ToolDef. This mirrors the ChatMessage alias pattern
// established when the Orchestrator was refactored to depend on the
// ModelGateway interface.
type ToolDef = modelgateway.ToolDef
type ToolFunction = modelgateway.ToolFunction

// ContextBuilder assembles the full context for model calls.
type ContextBuilder struct {
	log        *zap.Logger
	registry   *toolregistry.Registry
	repoMap    *RepoMap
	budget     ContextBudget
	summarizer *ToolResultSummarizer
	skills     *skills.Registry
	// skillLoader is used to lazily load a skill's SKILL.md body when
	// SetActiveSkill selects a skill that hasn't been phase-2 loaded yet.
	skillLoader *skills.Loader
	// activeSkill is the skill ID whose prompt+tools should be injected
	// into the next Build. Empty means no skill is active (use default
	// system prompt + all registry tools).
	activeSkill string
}

func NewContextBuilder(log *zap.Logger, registry *toolregistry.Registry) *ContextBuilder {
	return &ContextBuilder{
		log:        log,
		registry:   registry,
		summarizer: NewToolResultSummarizer(),
		budget:     DefaultContextBudget(),
	}
}

// WithRepoMap attaches a repository map to the builder for context awareness.
func (cb *ContextBuilder) WithRepoMap(rm *RepoMap) *ContextBuilder {
	cb.repoMap = rm
	return cb
}

// WithBudget sets the context budget.
func (cb *ContextBuilder) WithBudget(budget ContextBudget) *ContextBuilder {
	cb.budget = budget
	return cb
}

// WithSkills attaches the skills registry so Build can inject the
// active skill's prompt snippet and surface its recommended tools.
// Without this call, the builder operates in skill-less mode (all
// registry tools, default system prompt).
func (cb *ContextBuilder) WithSkills(reg *skills.Registry) *ContextBuilder {
	cb.skills = reg
	return cb
}

// WithSkillLoader attaches the loader used for lazy phase-2 loading.
// Optional — if unset, skills that weren't loaded at startup will
// contribute an empty prompt (meta-only).
func (cb *ContextBuilder) WithSkillLoader(l *skills.Loader) *ContextBuilder {
	cb.skillLoader = l
	return cb
}

// SetActiveSkill selects which skill's prompt + recommended tools to
// inject on the next Build. Pass "" to deactivate (use defaults).
func (cb *ContextBuilder) SetActiveSkill(id string) {
	cb.activeSkill = id
}

// BuildAssembles the system prompt, tool definitions, and conversation history.
func (cb *ContextBuilder) Build(mode, prompt, memory string) (messages []ChatMessage, tools []ToolDef) {
	planner := NewPlanner(cb.log, nil)
	systemPrompt := planner.BuildSystemPrompt(mode, memory)

	// P2-1: inject the active skill's prompt snippet (phase-2 loaded
	// SKILL.md body) into the system prompt. If the skill isn't loaded
	// yet, lazily load it now so the first Build pays the disk cost.
	var activeSkill *skills.Skill
	if cb.skills != nil && cb.activeSkill != "" {
		if s, err := cb.skills.Get(cb.activeSkill); err == nil {
			if !s.Loaded && cb.skillLoader != nil {
				_ = cb.skillLoader.LoadFullContent(s)
			}
			activeSkill = s
		}
	}
	if activeSkill != nil && activeSkill.Prompt != "" {
		systemPrompt += "\n\n--- Active Skill: " + activeSkill.Meta.Name + " ---\n" + activeSkill.Prompt
	}

	messages = []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: prompt},
	}

	// Append repo map if available
	if cb.repoMap != nil && cb.repoMap != (*RepoMap)(nil) {
		if rmCtx := cb.repoMap.FormatAsContext(50); rmCtx != "" {
			messages = append(messages, ChatMessage{
				Role:    "system",
				Content: rmCtx,
			})
		}
	}

	// Build tool definitions from registry. When a skill is active,
	// surface its recommended tools first (order matters for token
	// budget) but still include all others.
	registryTools := cb.registry.List()
	if activeSkill != nil && len(activeSkill.RecommendedTools) > 0 {
		registryTools = cb.reorderTools(registryTools, activeSkill.RecommendedTools)
	}
	for _, t := range registryTools {
		tools = append(tools, ToolDef{
			Type: "function",
			Function: ToolFunction{
				Name:        t.Name(),
				Description: t.Description(),
				Parameters:  t.InputSchema(),
			},
		})
	}

	return
}

// reorderTools moves recommended tools to the front of the slice,
// preserving the rest in their original order. Used by Build when a
// skill is active so its preferred tools fit in the token budget first.
func (cb *ContextBuilder) reorderTools(all []toolregistry.Tool, recommended []string) []toolregistry.Tool {
	if len(recommended) == 0 {
		return all
	}
	recSet := make(map[string]struct{}, len(recommended))
	for _, r := range recommended {
		recSet[r] = struct{}{}
	}
	head := make([]toolregistry.Tool, 0, len(recommended))
	tail := make([]toolregistry.Tool, 0, len(all))
	for _, t := range all {
		if _, ok := recSet[t.Name()]; ok {
			head = append(head, t)
		} else {
			tail = append(tail, t)
		}
	}
	return append(head, tail...)
}

// BuildWithMessages assembles context and applies budget constraints.
func (cb *ContextBuilder) BuildWithMessages(
	mode, prompt, memory string,
	existingMessages []ChatMessage,
) BudgetResult {
	baseMsgs, tools := cb.Build(mode, prompt, memory)

	// Append existing messages (skip the first two: system + user we just added)
	if len(existingMessages) > 0 {
		baseMsgs = append(baseMsgs, existingMessages...)
	}

	bab := NewBudgetAwareBuilder(cb, cb.budget)
	return bab.Enforce(baseMsgs, tools)
}

// SummarizeToolOutput is a convenience wrapper around SummarizeToolResult.
func (cb *ContextBuilder) SummarizeToolOutput(stdout, stderr string, maxChars int) string {
	return SummarizeToolResult("", stdout, stderr, maxChars)
}
