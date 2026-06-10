package permissions

import (
	"encoding/json"
	"fmt"
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

// PermissionPolicy holds the authorization policy with default action and rules.
type PermissionPolicy struct {
	DefaultAction Effect          `json:"default_action"`
	Rules         []PermissionRule `json:"rules"`
}

// DefaultPolicy returns a deny-all default policy.
func DefaultPolicy() *PermissionPolicy {
	return &PermissionPolicy{
		DefaultAction: Deny,
		Rules:         []PermissionRule{},
	}
}

// NewPermissionPolicy creates a policy with a specified default action.
func NewPermissionPolicy(defaultAction Effect) *PermissionPolicy {
	return &PermissionPolicy{
		DefaultAction: defaultAction,
		Rules:         []PermissionRule{},
	}
}

// AddRule appends a permission rule to the policy.
func (p *PermissionPolicy) AddRule(rule PermissionRule) *PermissionPolicy {
	p.Rules = append(p.Rules, rule)
	return p
}

// AddRules appends multiple rules at once.
func (p *PermissionPolicy) AddRules(rules []PermissionRule) *PermissionPolicy {
	p.Rules = append(p.Rules, rules...)
	return p
}

// CheckPermission evaluates whether a resource+action combination is permitted.
func (p *PermissionPolicy) CheckPermission(resource, action string, conditions map[string]string) bool {
	return p.IsAllowed(resource, action, conditions)
}

// IsAllowed checks if the given resource and action are allowed by the policy.
func (p *PermissionPolicy) IsAllowed(resource, action string, conditions map[string]string) bool {
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
func (p *PermissionPolicy) ToJSON() ([]byte, error) {
	return json.MarshalIndent(p, "", "  ")
}

// FromJSON deserializes a policy from JSON bytes.
func FromJSON(data []byte) (*PermissionPolicy, error) {
	var policy PermissionPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("unmarshal policy: %w", err)
	}
	if policy.DefaultAction == "" {
		policy.DefaultAction = Deny
	}
	return &policy, nil
}

// GetRules returns a copy of the policy rules.
func (p *PermissionPolicy) GetRules() []PermissionRule {
	cp := make([]PermissionRule, len(p.Rules))
	copy(cp, p.Rules)
	return cp
}

// RemoveRule removes a rule at the given index.
func (p *PermissionPolicy) RemoveRule(index int) error {
	if index < 0 || index >= len(p.Rules) {
		return fmt.Errorf("rule index %d out of range", index)
	}
	p.Rules = append(p.Rules[:index], p.Rules[index+1:]...)
	return nil
}

// FindMatchingRules returns all rules that match a given resource and action.
func (p *PermissionPolicy) FindMatchingRules(resource, action string) []PermissionRule {
	var result []PermissionRule
	for _, rule := range p.Rules {
		if matchesResource(rule.Resource, resource) && matchesAction(rule.Action, action) {
			result = append(result, rule)
		}
	}
	return result
}

// GetDefaultAction returns the policy's default action.
func (p *PermissionPolicy) GetDefaultAction() Effect {
	return p.DefaultAction
}

// SetDefaultAction sets the default action for the policy.
func (p *PermissionPolicy) SetDefaultAction(action Effect) {
	p.DefaultAction = action
}

// HasRules returns true if the policy contains any rules.
func (p *PermissionPolicy) HasRules() bool {
	return len(p.Rules) > 0
}

// RuleCount returns the number of rules in the policy.
func (p *PermissionPolicy) RuleCount() int {
	return len(p.Rules)
}

// Merge combines another policy's rules into this one.
func (p *PermissionPolicy) Merge(other *PermissionPolicy) *PermissionPolicy {
	p.Rules = append(p.Rules, other.Rules...)
	return p
}

// ClearRules removes all rules from the policy.
func (p *PermissionPolicy) ClearRules() {
	p.Rules = nil
}

// Clone creates a deep copy of the policy.
func (p *PermissionPolicy) Clone() *PermissionPolicy {
	cp := &PermissionPolicy{
		DefaultAction: p.DefaultAction,
		Rules:         make([]PermissionRule, len(p.Rules)),
	}
	copy(cp.Rules, p.Rules)
	return cp
}

// PolicySummary holds a high-level view of a policy.
type PolicySummary struct {
	DefaultAction  Effect          `json:"default_action"`
	RuleCount      int             `json:"rule_count"`
	Rules          []RuleSummary   `json:"rules"`
}

// RuleSummary is a simplified view of a single rule.
type RuleSummary struct {
	Resource string   `json:"resource"`
	Action   string   `json:"action"`
	Effect   Effect   `json:"effect"`
}

// GetSummary returns a condensed summary of the policy.
func (p *PermissionPolicy) GetSummary() PolicySummary {
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
func AllowAllResources() *PermissionPolicy {
	return &PermissionPolicy{
		DefaultAction: Allow,
		Rules:         []PermissionRule{},
	}
}

// DenyAllResources returns a new policy that denies all access.
func DenyAllResources() *PermissionPolicy {
	return &PermissionPolicy{
		DefaultAction: Deny,
		Rules:         []PermissionRule{},
	}
}
