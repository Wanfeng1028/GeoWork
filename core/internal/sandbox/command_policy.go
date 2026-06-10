package sandbox

import (
	"fmt"
	"log/slog"
	"regexp"
	"strings"
)

// CommandPolicy defines rules for command allow/deny lists.
type CommandPolicy struct {
	AllowedCommands []string
	BlockedCommands []string
	AllowPatterns   []*regexp.Regexp
	BlockPatterns   []*regexp.Regexp
	AllowlistMode   bool
}

// CommandValidator validates command strings against a policy.
type CommandValidator struct {
	policy *CommandPolicy
	log    *slog.Logger
}

// ErrCommandBlocked is returned when a command is blocked by policy.
type ErrCommandBlocked struct {
	Command string
	Reason  string
}

func (e *ErrCommandBlocked) Error() string {
	return fmt.Sprintf("command blocked: %s (%s)", e.Command, e.Reason)
}

// NewCommandValidator creates a new validator from the policy.
func NewCommandValidator(policy *CommandPolicy, log *slog.Logger) *CommandValidator {
	return &CommandValidator{
		policy: policy,
		log:    log,
	}
}

// Validate checks if the given command is allowed by the policy.
func (v *CommandValidator) Validate(command string) error {
	if command == "" {
		return &ErrCommandBlocked{Command: command, Reason: "empty command"}
	}

	trimmed := strings.TrimSpace(command)
	if v.isAllowed(trimmed) {
		return nil
	}

	if v.policy.AllowlistMode && len(v.policy.AllowedCommands) > 0 {
		return &ErrCommandBlocked{
			Command: command,
			Reason:  "not in allowlist",
		}
	}

	for _, blocked := range v.policy.BlockedCommands {
		if strings.Contains(strings.ToLower(command), strings.ToLower(blocked)) {
			return &ErrCommandBlocked{
				Command: command,
				Reason:  fmt.Sprintf("contains blocked keyword: %s", blocked),
			}
		}
	}

	for _, pattern := range v.policy.BlockPatterns {
		if pattern.MatchString(trimmed) {
			return &ErrCommandBlocked{
				Command: command,
				Reason:  fmt.Sprintf("matches block pattern: %s", pattern.String()),
			}
		}
	}

	if v.policy.AllowlistMode {
		return &ErrCommandBlocked{
			Command: command,
			Reason:  "command not in allowlist",
		}
	}

	return nil
}

// ValidateComponent validates a single component (word) of a command.
func (v *CommandValidator) ValidateComponent(component string) error {
	if component == "" {
		return &ErrCommandBlocked{Command: component, Reason: "empty component"}
	}

	for _, blocked := range v.policy.BlockedCommands {
		if strings.EqualFold(component, blocked) {
			return &ErrCommandBlocked{
				Command: component,
				Reason:  fmt.Sprintf("blocked command: %s", blocked),
			}
		}
	}

	for _, pattern := range v.policy.BlockPatterns {
		if pattern.MatchString(component) {
			return &ErrCommandBlocked{
				Command: component,
				Reason:  fmt.Sprintf("matches block pattern: %s", pattern.String()),
			}
		}
	}

	for _, allowed := range v.policy.AllowedCommands {
		if strings.EqualFold(component, allowed) {
			return nil
		}
	}

	if v.policy.AllowlistMode {
		return &ErrCommandBlocked{
			Command: component,
			Reason:  "not in allowlist",
		}
	}

	return nil
}

// isAllowed checks whether a command matches the allow list.
func (v *CommandValidator) isAllowed(command string) bool {
	trimmed := strings.TrimSpace(command)
	lower := strings.ToLower(trimmed)

	for _, allowed := range v.policy.AllowedCommands {
		if strings.EqualFold(allowed, lower) {
			return true
		}
	}

	for _, pattern := range v.policy.AllowPatterns {
		if pattern.MatchString(lower) {
			return true
		}
	}

	return false
}

// NewCommandPolicy creates a default command policy.
func NewCommandPolicy(allowlistMode bool) *CommandPolicy {
	return &CommandPolicy{
		AllowlistMode: allowlistMode,
		AllowedCommands: []string{
			"ls", "cat", "grep", "echo", "mkdir", "rm", "cp", "mv",
			"find", "head", "tail", "sed", "awk", "sort", "uniq",
			"chmod", "chown", "touch", "wc", "diff", "tar", "zip",
			"go", "node", "python", "pip", "npm", "git", "curl",
		},
		BlockedCommands: []string{
			"rm -rf /", "chmod 777", "mkfs", "fdisk", "dd if=",
			"shutdown", "reboot", "poweroff", "kill -9", "curl -X DELETE",
			"iptables", "ufw", "sudo",
		},
	}
}

// CompileAllowPatterns compiles string patterns into regexes.
func (p *CommandPolicy) CompileAllowPatterns(patterns []string) error {
	for _, pattern := range patterns {
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			return fmt.Errorf("invalid allow pattern %q: %w", pattern, err)
		}
		p.AllowPatterns = append(p.AllowPatterns, re)
	}
	return nil
}

// CompileBlockPatterns compiles string patterns into regexes.
func (p *CommandPolicy) CompileBlockPatterns(patterns []string) error {
	for _, pattern := range patterns {
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			return fmt.Errorf("invalid block pattern %q: %w", pattern, err)
		}
		p.BlockPatterns = append(p.BlockPatterns, re)
	}
	return nil
}

// AddAllowedCommand adds a command to the allow list.
func (p *CommandPolicy) AddAllowedCommand(cmd string) {
	lower := strings.ToLower(strings.TrimSpace(cmd))
	if lower == "" {
		return
	}
	for _, existing := range p.AllowedCommands {
		if strings.EqualFold(existing, lower) {
			return
		}
	}
	p.AllowedCommands = append(p.AllowedCommands, lower)
}

// RemoveAllowedCommand removes a command from the allow list.
func (p *CommandPolicy) RemoveAllowedCommand(cmd string) {
	lower := strings.ToLower(strings.TrimSpace(cmd))
	for i, c := range p.AllowedCommands {
		if strings.EqualFold(c, lower) {
			p.AllowedCommands = append(p.AllowedCommands[:i], p.AllowedCommands[i+1:]...)
			return
		}
	}
}

// AddBlockedCommand adds a command to the block list.
func (p *CommandPolicy) AddBlockedCommand(cmd string) {
	lower := strings.ToLower(strings.TrimSpace(cmd))
	if lower == "" {
		return
	}
	for _, existing := range p.BlockedCommands {
		if strings.EqualFold(existing, lower) {
			return
		}
	}
	p.BlockedCommands = append(p.BlockedCommands, lower)
}

// RemoveBlockedCommand removes a command from the block list.
func (p *CommandPolicy) RemoveBlockedCommand(cmd string) {
	lower := strings.ToLower(strings.TrimSpace(cmd))
	for i, c := range p.BlockedCommands {
		if strings.EqualFold(c, lower) {
			p.BlockedCommands = append(p.BlockedCommands[:i], p.BlockedCommands[i+1:]...)
			return
		}
	}
}

// GetBlockedCommands returns a copy of the blocked commands.
func (p *CommandPolicy) GetBlockedCommands() []string {
	cp := make([]string, len(p.BlockedCommands))
	copy(cp, p.BlockedCommands)
	return cp
}

// GetAllowedCommands returns a copy of the allowed commands.
func (p *CommandPolicy) GetAllowedCommands() []string {
	cp := make([]string, len(p.AllowedCommands))
	copy(cp, p.AllowedCommands)
	return cp
}

// ParseCommand splits a command string into its components.
func ParseCommand(cmd string) []string {
	return strings.Fields(cmd)
}

// ValidateParsedCommand validates each component of a parsed command.
func (v *CommandValidator) ValidateParsedCommand(components []string) error {
	if len(components) == 0 {
		return &ErrCommandBlocked{Command: "", Reason: "no command components"}
	}
	for _, component := range components {
		if err := v.ValidateComponent(component); err != nil {
			return err
		}
	}
	return nil
}

// GetAllowlistMode returns whether the policy is in allowlist mode.
func (p *CommandPolicy) GetAllowlistMode() bool {
	return p.AllowlistMode
}

// SetAllowlistMode sets whether the policy uses allowlist or blocklist mode.
func (p *CommandPolicy) SetAllowlistMode(enabled bool) {
	p.AllowlistMode = enabled
}

// CommandInfo holds metadata about a command validation result.
type CommandInfo struct {
	Command    string
	Allowed    bool
	Reason     string
	Components []string
}

// GetCommandInfo returns metadata about a command's validity.
func (v *CommandValidator) GetCommandInfo(command string) *CommandInfo {
	components := ParseCommand(command)
	info := &CommandInfo{
		Command:    command,
		Components: components,
	}
	if err := v.Validate(command); err != nil {
		info.Allowed = false
		info.Reason = err.Error()
	} else {
		info.Allowed = true
	}
	return info
}

// ResetPolicy resets the command policy to defaults.
func (p *CommandPolicy) ResetPolicy(allowlistMode bool) {
	p.AllowedCommands = []string{
		"ls", "cat", "grep", "echo", "mkdir", "rm", "cp", "mv",
		"find", "head", "tail", "sed", "awk", "sort", "uniq",
		"chmod", "chown", "touch", "wc", "diff", "tar", "zip",
		"go", "node", "python", "pip", "npm", "git", "curl",
	}
	p.BlockedCommands = []string{
		"rm -rf /", "chmod 777", "mkfs", "fdisk", "dd if=",
		"shutdown", "reboot", "poweroff", "kill -9", "curl -X DELETE",
		"iptables", "ufw", "sudo",
	}
	p.AllowPatterns = nil
	p.BlockPatterns = nil
	p.AllowlistMode = allowlistMode
}
