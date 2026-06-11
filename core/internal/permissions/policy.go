package permissions

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Effect represents the decision of a permission rule.
type Effect string

const (
	Allow Effect = "allow"
	Deny  Effect = "deny"
)

// PermissionRule defines a single authorization rule.
type PermissionRule struct {
	Resource   string            `json:"resource"`
	Action     string            `json:"action"`
	Effect     Effect            `json:"effect"`
	Conditions map[string]string `json:"conditions,omitempty"`
}

// AuthorizationPolicy holds the authorization policy with default action and rules.
type AuthorizationPolicy struct {
	DefaultAction Effect           `json:"default_action"`
	Rules         []PermissionRule `json:"rules"`
}

// DefaultPolicy returns a deny-all default policy.
func DefaultPolicy() *AuthorizationPolicy {
	return &AuthorizationPolicy{
		DefaultAction: Deny,
		Rules:         []PermissionRule{},
	}
}

// NewAuthorizationPolicy creates a policy with a specified default action.
func NewAuthorizationPolicy(defaultAction Effect) *AuthorizationPolicy {
	return &AuthorizationPolicy{
		DefaultAction: defaultAction,
		Rules:         []PermissionRule{},
	}
}

// AddRule appends a permission rule to the policy.
func (p *AuthorizationPolicy) AddRule(rule PermissionRule) *AuthorizationPolicy {
	p.Rules = append(p.Rules, rule)
	return p
}

// AddRules appends multiple rules at once.
func (p *AuthorizationPolicy) AddRules(rules []PermissionRule) *AuthorizationPolicy {
	p.Rules = append(p.Rules, rules...)
	return p
}

// CheckPermission evaluates whether a resource+action combination is permitted.
func (p *AuthorizationPolicy) CheckPermission(resource, action string, conditions map[string]string) bool {
	return p.IsAllowed(resource, action, conditions)
}

// IsAllowed checks if the given resource and action are allowed by the policy.
func (p *AuthorizationPolicy) IsAllowed(resource, action string, conditions map[string]string) bool {
	resource = strings.ToLower(strings.TrimSpace(resource))
	action = strings.ToLower(strings.TrimSpace(action))

	for _, rule := range p.Rules {
		if !matchesResource(rule.Resource, resource) {
			continue
		}
		if !matchesAction(rule.Action, action) {
			continue
		}
		if !matchesConditions(rule.Conditions, conditions) {
			continue
		}
		return rule.Effect == Allow
	}

	return p.DefaultAction == Allow
}

// matchesResource checks if a rule resource matches a target resource.
func matchesResource(ruleResource, targetResource string) bool {
	ruleResource = strings.ToLower(strings.TrimSpace(ruleResource))
	targetResource = strings.ToLower(strings.TrimSpace(targetResource))

	if ruleResource == "*" {
		return true
	}
	if ruleResource == targetResource {
		return true
	}
	if strings.HasSuffix(ruleResource, "*") {
		prefix := strings.TrimSuffix(ruleResource, "*")
		return strings.HasPrefix(targetResource, prefix)
	}
	return false
}

// matchesAction checks if a rule action matches a target action.
func matchesAction(ruleAction, targetAction string) bool {
	ruleAction = strings.ToLower(strings.TrimSpace(ruleAction))
	targetAction = strings.ToLower(strings.TrimSpace(targetAction))

	if ruleAction == "*" {
		return true
	}
	return ruleAction == targetAction
}

// matchesConditions checks if all rule conditions are satisfied.
func matchesConditions(ruleConditions, targetConditions map[string]string) bool {
	if len(ruleConditions) == 0 {
		return true
	}
	if targetConditions == nil {
		targetConditions = make(map[string]string)
	}
	for key, value := range ruleConditions {
		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.ToLower(strings.TrimSpace(value))
		if targetVal, ok := targetConditions[key]; !ok || strings.ToLower(strings.TrimSpace(targetVal)) != value {
			return false
		}
	}
	return true
}

// ToJSON serializes the policy to JSON bytes.
func (p *AuthorizationPolicy) ToJSON() ([]byte, error) {
	return json.MarshalIndent(p, "", "  ")
}

// FromJSON deserializes a policy from JSON bytes.
func FromJSON(data []byte) (*AuthorizationPolicy, error) {
	var policy AuthorizationPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("unmarshal policy: %w", err)
	}
	if policy.DefaultAction == "" {
		policy.DefaultAction = Deny
	}
	return &policy, nil
}

// GetRules returns a copy of the policy rules.
func (p *AuthorizationPolicy) GetRules() []PermissionRule {
	cp := make([]PermissionRule, len(p.Rules))
	copy(cp, p.Rules)
	return cp
}

// RemoveRule removes a rule at the given index.
func (p *AuthorizationPolicy) RemoveRule(index int) error {
	if index < 0 || index >= len(p.Rules) {
		return fmt.Errorf("rule index %d out of range", index)
	}
	p.Rules = append(p.Rules[:index], p.Rules[index+1:]...)
	return nil
}

// FindMatchingRules returns all rules that match a given resource and action.
func (p *AuthorizationPolicy) FindMatchingRules(resource, action string) []PermissionRule {
	var result []PermissionRule
	for _, rule := range p.Rules {
		if matchesResource(rule.Resource, resource) && matchesAction(rule.Action, action) {
			result = append(result, rule)
		}
	}
	return result
}

// GetDefaultAction returns the policy's default action.
func (p *AuthorizationPolicy) GetDefaultAction() Effect {
	return p.DefaultAction
}

// SetDefaultAction sets the default action for the policy.
func (p *AuthorizationPolicy) SetDefaultAction(action Effect) {
	p.DefaultAction = action
}

// HasRules returns true if the policy contains any rules.
func (p *AuthorizationPolicy) HasRules() bool {
	return len(p.Rules) > 0
}

// RuleCount returns the number of rules in the policy.
func (p *AuthorizationPolicy) RuleCount() int {
	return len(p.Rules)
}

// Merge combines another policy's rules into this one.
func (p *AuthorizationPolicy) Merge(other *AuthorizationPolicy) *AuthorizationPolicy {
	p.Rules = append(p.Rules, other.Rules...)
	return p
}

// ClearRules removes all rules from the policy.
func (p *AuthorizationPolicy) ClearRules() {
	p.Rules = nil
}

// Clone creates a deep copy of the policy.
func (p *AuthorizationPolicy) Clone() *AuthorizationPolicy {
	cp := &AuthorizationPolicy{
		DefaultAction: p.DefaultAction,
		Rules:         make([]PermissionRule, len(p.Rules)),
	}
	copy(cp.Rules, p.Rules)
	return cp
}

// PolicySummary holds a high-level view of a policy.
type PolicySummary struct {
	DefaultAction Effect        `json:"default_action"`
	RuleCount     int           `json:"rule_count"`
	Rules         []RuleSummary `json:"rules"`
}

// RuleSummary is a simplified view of a single rule.
type RuleSummary struct {
	Resource string `json:"resource"`
	Action   string `json:"action"`
	Effect   Effect `json:"effect"`
}

// GetSummary returns a condensed summary of the policy.
func (p *AuthorizationPolicy) GetSummary() PolicySummary {
	summary := PolicySummary{
		DefaultAction: p.DefaultAction,
		RuleCount:     len(p.Rules),
	}
	for _, rule := range p.Rules {
		summary.Rules = append(summary.Rules, RuleSummary{
			Resource: rule.Resource,
			Action:   rule.Action,
			Effect:   rule.Effect,
		})
	}
	return summary
}

// AllowAllResources returns a new policy that allows all resources and actions.
func AllowAllResources() *AuthorizationPolicy {
	return &AuthorizationPolicy{
		DefaultAction: Allow,
		Rules:         []PermissionRule{},
	}
}

// DenyAllResources returns a new policy that denies all access.
func DenyAllResources() *AuthorizationPolicy {
	return &AuthorizationPolicy{
		DefaultAction: Deny,
		Rules:         []PermissionRule{},
	}
}

// --- PolicyConfig: permission policy configuration for file loading ---

// PolicyConfig holds permission policy configuration loaded from a JSON/YAML config file.
type PolicyConfig struct {
	Version      string       `json:"version"`
	Global       GlobalPolicy `json:"global"`
	TaskPolicies []TaskPolicy `json:"taskPolicies,omitempty"`
	Whitelist    []ActionRule `json:"whitelist,omitempty"`
	Blacklist    []ActionRule `json:"blacklist,omitempty"`
}

// GlobalPolicy defines global permission policy defaults.
type GlobalPolicy struct {
	DefaultLevel         PermissionLevel `json:"defaultLevel"`
	HighRiskAlwaysReview bool            `json:"highRiskAlwaysReview"`
	DecisionTTLHours     int             `json:"decisionTTLHours"`
}

// TaskPolicy defines per-task permission overrides.
type TaskPolicy struct {
	TaskID  string            `json:"taskId"`
	Mode    string            `json:"mode"` // work/code/paper/ppt
	Level   PermissionLevel   `json:"level"`
	Actions map[string]string `json:"actions"`
}

// ActionRule defines a whitelist/blacklist rule for dangerous actions.
type ActionRule struct {
	Action  DangerousAction `json:"action"`
	Level   PermissionLevel `json:"level"`
	Pattern string          `json:"pattern,omitempty"` // glob or regex pattern
	Comment string          `json:"comment,omitempty"`
}

// PolicyLoader handles loading and saving PolicyConfig from/to disk.
type PolicyLoader struct{}

// NewPolicyLoader returns a new PolicyLoader instance.
func NewPolicyLoader() *PolicyLoader {
	return &PolicyLoader{}
}

// Load reads a PolicyConfig from the given file path.
func (l *PolicyLoader) Load(path string) (*PolicyConfig, error) {
	if path == "" {
		return nil, fmt.Errorf("load: path is empty")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("load: resolve path %q: %w", path, err)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("load: read file %q: %w", absPath, err)
	}

	var config PolicyConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("load: unmarshal policy config %q: %w", absPath, err)
	}

	return &config, nil
}

// Save writes a PolicyConfig to the given file path as indented JSON.
func (l *PolicyLoader) Save(path string, config *PolicyConfig) error {
	if path == "" {
		return fmt.Errorf("save: path is empty")
	}
	if config == nil {
		return fmt.Errorf("save: config is nil")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("save: resolve path %q: %w", path, err)
	}

	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("save: create directory %q: %w", dir, err)
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("save: marshal policy config: %w", err)
	}

	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return fmt.Errorf("save: write file %q: %w", absPath, err)
	}

	return nil
}

// Default returns a sensible default PolicyConfig.
func (l *PolicyLoader) Default() *PolicyConfig {
	return &PolicyConfig{
		Version: "1.0",
		Global: GlobalPolicy{
			DefaultLevel:         Limited,
			HighRiskAlwaysReview: true,
			DecisionTTLHours:     24,
		},
		Whitelist: []ActionRule{
			{
				Action:  ActionReadEnv,
				Level:   Limited,
				Pattern: "*",
				Comment: "Allow reading environment variables within workspace",
			},
			{
				Action:  ActionRunShell,
				Level:   Limited,
				Pattern: "ls|cat|echo|pwd|whoami|date",
				Comment: "Allow safe read-only shell commands",
			},
		},
		Blacklist: []ActionRule{
			{
				Action:  ActionModifySystem,
				Level:   Limited,
				Pattern: "*",
				Comment: "Always deny system-level modifications",
			},
			{
				Action:  ActionAccessSecrets,
				Level:   Limited,
				Pattern: "*",
				Comment: "Always deny access to secrets and credentials",
			},
		},
	}
}

// Validate checks that the PolicyConfig has valid required fields and returns
// descriptive errors for any problems found.
func (c *PolicyConfig) Validate() error {
	if c.Version == "" {
		return fmt.Errorf("policy config: version is required")
	}

	if err := c.Global.validate(); err != nil {
		return fmt.Errorf("policy config: global: %w", err)
	}

	if c.TaskPolicies != nil {
		for i, tp := range c.TaskPolicies {
			if err := tp.validate(i); err != nil {
				return fmt.Errorf("policy config: taskPolicies[%d]: %w", i, err)
			}
		}
	}

	for i, r := range c.Whitelist {
		if err := r.validate(i, "whitelist"); err != nil {
			return err
		}
	}

	for i, r := range c.Blacklist {
		if err := r.validate(i, "blacklist"); err != nil {
			return err
		}
	}

	return nil
}

// mergeInto merges the policy config into an in-memory PermissionPolicy.
func (c *PolicyConfig) MergeInto(policy *PermissionPolicy) {
	if policy == nil {
		return
	}

	policy.DefaultLevel = c.Global.DefaultLevel

	if c.Global.DecisionTTLHours > 0 {
		// Decision TTL is stored indirectly; actions and defaults take effect here.
	}

	for _, tp := range c.TaskPolicies {
		// Merge per-task action overrides into the global policy.
		for actionStr, actionLevel := range tp.Actions {
			policy.Actions[actionStr] = actionLevel
		}
		// tp.Level is the task-level default; specific action mappings above take precedence.
	}

	for _, rule := range c.Whitelist {
		policy.Actions[string(rule.Action)] = string(rule.Level)
	}

	for _, rule := range c.Blacklist {
		policy.Actions[string(rule.Action)] = string(rule.Level)
	}
}

// --- Internal validation helpers ---

func (g *GlobalPolicy) validate() error {
	if g.DefaultLevel == "" {
		return fmt.Errorf("defaultLevel is required")
	}
	if g.DefaultLevel != ReadOnly && g.DefaultLevel != AskEveryTime && g.DefaultLevel != Limited && g.DefaultLevel != FullAccess {
		return fmt.Errorf("defaultLevel has invalid value %q", g.DefaultLevel)
	}
	if g.DecisionTTLHours < 0 {
		return fmt.Errorf("decisionTTLHours must be non-negative, got %d", g.DecisionTTLHours)
	}
	return nil
}

func (tp *TaskPolicy) validate(index int) error {
	if tp.TaskID == "" {
		return fmt.Errorf("taskId is required")
	}
	if tp.Mode == "" {
		return fmt.Errorf("mode is required")
	}
	if tp.Level == "" {
		return fmt.Errorf("level is required")
	}
	validModes := map[string]bool{
		"work":  true,
		"code":  true,
		"paper": true,
		"ppt":   true,
	}
	if !validModes[tp.Mode] {
		return fmt.Errorf("mode has invalid value %q, expected one of: work, code, paper, ppt", tp.Mode)
	}
	return nil
}

func (r *ActionRule) validate(index int, source string) error {
	if string(r.Action) == "" {
		return fmt.Errorf("%s[%d]: action is required", source, index)
	}
	if r.Level == "" {
		return fmt.Errorf("%s[%d]: level is required for action %q", source, index, r.Action)
	}
	return nil
}
