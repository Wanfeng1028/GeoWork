package aiagent

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"go.uber.org/zap"
)

func newTestHarness() *Harness {
	return NewHarness(zap.NewNop())
}

// TestEvaluateDefaultRules pins the behavior of the six built-in rules. This
// is the highest-risk surface: it gates every tool call the agent makes.
func TestEvaluateDefaultRules(t *testing.T) {
	cases := []struct {
		name         string
		ctx          *EvaluationContext
		wantAllowed  bool
		wantApproved bool
		wantRuleID   string
	}{
		{
			name:        "verifying state denies delete_file",
			ctx:         &EvaluationContext{State: StateVerifying, ToolName: "delete_file"},
			wantAllowed: false,
			wantRuleID:  "no-delete-in-verifying",
		},
		{
			name:        "verifying state denies write_file",
			ctx:         &EvaluationContext{State: StateVerifying, ToolName: "write_file"},
			wantAllowed: false,
			wantRuleID:  "no-write-in-verifying",
		},
		{
			name:        "editing state allows write_file",
			ctx:         &EvaluationContext{State: StateEditing, ToolName: "write_file", RiskLevel: "high"},
			wantAllowed: true,
		},
		{
			name:        "editing state allows delete_file",
			ctx:         &EvaluationContext{State: StateEditing, ToolName: "delete_file", RiskLevel: "high"},
			wantAllowed: true,
		},
		{
			name:         "low risk auto-approved",
			ctx:          &EvaluationContext{State: StateEditing, ToolName: "read_file", RiskLevel: "low"},
			wantAllowed:  true,
			wantApproved: true,
		},
		{
			name:         "medium risk auto-approved",
			ctx:          &EvaluationContext{State: StateEditing, ToolName: "write_file", RiskLevel: "medium"},
			wantAllowed:  true,
			wantApproved: true,
		},
		{
			name:        "high risk not auto-approved",
			ctx:         &EvaluationContext{State: StateEditing, ToolName: "run_shell", RiskLevel: "high"},
			wantAllowed: true,
		},
		{
			name:        "empty risk not auto-approved",
			ctx:         &EvaluationContext{State: StateEditing, ToolName: "read_file", RiskLevel: ""},
			wantAllowed: true,
		},
		{
			name:        "run_shell throttle is advisory, still allowed",
			ctx:         &EvaluationContext{State: StateEditing, ToolName: "run_shell", RiskLevel: "high"},
			wantAllowed: true,
		},
	}

	h := newTestHarness()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := h.Evaluate(tc.ctx)
			if res.Allowed != tc.wantAllowed {
				t.Errorf("Allowed = %v, want %v (reason=%q rule=%q)", res.Allowed, tc.wantAllowed, res.Reason, res.RuleID)
			}
			if res.AutoApproved != tc.wantApproved {
				t.Errorf("AutoApproved = %v, want %v", res.AutoApproved, tc.wantApproved)
			}
			if tc.wantRuleID != "" && res.RuleID != tc.wantRuleID {
				t.Errorf("RuleID = %q, want %q", res.RuleID, tc.wantRuleID)
			}
		})
	}
}

// TestEvaluateDenyShortCircuits verifies a deny rule wins even when a later
// (lower-priority) approve rule would also match.
func TestEvaluateDenyShortCircuits(t *testing.T) {
	h := newTestHarness()
	// verifying + delete_file + low risk: the deny (priority 100) must beat
	// the low-risk approve (priority 50).
	res := h.Evaluate(&EvaluationContext{
		State:     StateVerifying,
		ToolName:  "delete_file",
		RiskLevel: "low",
	})
	if res.Allowed {
		t.Errorf("expected deny to short-circuit approve, got Allowed=true")
	}
	if res.AutoApproved {
		t.Errorf("denied result must not be auto-approved")
	}
	if res.RuleID != "no-delete-in-verifying" {
		t.Errorf("RuleID = %q, want no-delete-in-verifying", res.RuleID)
	}
}

// TestEvaluateAuditSandbox verifies the audit-sandbox-paths rule fires when a
// tool touches a file path. The condition must use the quoted form
// `sandbox == 'true'` — the parser only matches quoted values, and the
// unquoted form silently never fired (fixed alongside this test).
func TestEvaluateAuditSandbox(t *testing.T) {
	h := newTestHarness()
	res := h.Evaluate(&EvaluationContext{
		State:    StateEditing,
		ToolName: "write_file",
		FilePath: "/workspace/data/file.txt",
	})
	if !res.Allowed {
		t.Fatalf("expected allowed, got denied by %q", res.RuleID)
	}
	if len(res.Audited) != 1 || res.Audited[0] != "audit-sandbox-paths" {
		t.Errorf("expected audit-sandbox-paths to fire, got %v", res.Audited)
	}

	// No FilePath → sandbox is false → no audit entry.
	res2 := h.Evaluate(&EvaluationContext{State: StateEditing, ToolName: "read_file"})
	if len(res2.Audited) != 0 {
		t.Errorf("expected no audit entries without a file path, got %v", res2.Audited)
	}
}

// TestMatchConditionParser exercises the condition expression parser through
// custom rules, covering the operators and fail-safe branches.
func TestMatchConditionParser(t *testing.T) {
	cases := []struct {
		name      string
		condition string
		ctx       *EvaluationContext
		want      bool
	}{
		{
			name:      "empty condition always matches",
			condition: "",
			ctx:       &EvaluationContext{ToolName: "anything"},
			want:      true,
		},
		{
			name:      "equality matches",
			condition: "tool == 'read_file'",
			ctx:       &EvaluationContext{ToolName: "read_file"},
			want:      true,
		},
		{
			name:      "equality mismatch",
			condition: "tool == 'read_file'",
			ctx:       &EvaluationContext{ToolName: "write_file"},
			want:      false,
		},
		{
			name:      "inequality matches",
			condition: "tool != 'read_file'",
			ctx:       &EvaluationContext{ToolName: "write_file"},
			want:      true,
		},
		{
			name:      "AND both true",
			condition: "state == 'editing' && tool == 'write_file'",
			ctx:       &EvaluationContext{State: StateEditing, ToolName: "write_file"},
			want:      true,
		},
		{
			name:      "AND one false",
			condition: "state == 'editing' && tool == 'write_file'",
			ctx:       &EvaluationContext{State: StateVerifying, ToolName: "write_file"},
			want:      false,
		},
		{
			name:      "OR one true",
			condition: "tool == 'read_file' || tool == 'write_file'",
			ctx:       &EvaluationContext{ToolName: "write_file"},
			want:      true,
		},
		{
			name:      "OR none true",
			condition: "tool == 'read_file' || tool == 'list_dir'",
			ctx:       &EvaluationContext{ToolName: "write_file"},
			want:      false,
		},
		{
			name:      "malformed atom fails safe to false",
			condition: "this is not a valid expression",
			ctx:       &EvaluationContext{ToolName: "read_file"},
			want:      false,
		},
		{
			name:      "unquoted value fails safe to false",
			condition: "tool == read_file",
			ctx:       &EvaluationContext{ToolName: "read_file"},
			want:      false,
		},
		{
			name:      "unknown field resolves to empty string",
			condition: "nonexistent == ''",
			ctx:       &EvaluationContext{ToolName: "read_file"},
			want:      true,
		},
		{
			name:      "mode field matches",
			condition: "mode == 'deterministic'",
			ctx:       &EvaluationContext{Mode: "deterministic"},
			want:      true,
		},
		{
			name:      "sandbox true when FilePath set",
			condition: "sandbox == 'true'",
			ctx:       &EvaluationContext{FilePath: "/some/path"},
			want:      true,
		},
		{
			name:      "sandbox false when FilePath empty",
			condition: "sandbox == 'false'",
			ctx:       &EvaluationContext{},
			want:      true,
		},
		{
			name:      "runId field matches",
			condition: "runId == 'run-42'",
			ctx:       &EvaluationContext{RunID: "run-42"},
			want:      true,
		},
		{
			name:      "separator inside quotes not split",
			condition: "tool == 'a||b' || tool == 'write_file'",
			ctx:       &EvaluationContext{ToolName: "write_file"},
			want:      true,
		},
		{
			name:      "parenthesized atom",
			condition: "(tool == 'read_file')",
			ctx:       &EvaluationContext{ToolName: "read_file"},
			want:      true,
		},
	}

	h := newTestHarness()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := h.matchCondition(tc.condition, tc.ctx)
			if got != tc.want {
				t.Errorf("matchCondition(%q) = %v, want %v", tc.condition, got, tc.want)
			}
		})
	}
}

func TestSplitTopLevel(t *testing.T) {
	cases := []struct {
		name string
		expr string
		sep  string
		want []string
	}{
		{
			name: "simple split",
			expr: "a && b",
			sep:  "&&",
			want: []string{"a ", " b"},
		},
		{
			name: "separator inside single quotes not split",
			expr: "tool == 'x&&y' && b",
			sep:  "&&",
			want: []string{"tool == 'x&&y' ", " b"},
		},
		{
			name: "separator inside parens not split",
			expr: "(a && b) && c",
			sep:  "&&",
			want: []string{"(a && b) ", " c"},
		},
		{
			name: "no separator returns whole expr",
			expr: "a == 'x'",
			sep:  "&&",
			want: []string{"a == 'x'"},
		},
		{
			name: "trailing separator drops empty tail",
			expr: "a ||",
			sep:  "||",
			want: []string{"a "},
		},
		{
			name: "or separator",
			expr: "a || b || c",
			sep:  "||",
			want: []string{"a ", " b ", " c"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := splitTopLevel(tc.expr, tc.sep)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("splitTopLevel(%q, %q) = %q, want %q", tc.expr, tc.sep, got, tc.want)
			}
		})
	}
}

// TestPriorityAndEnabled verifies priority ordering and that disabled rules are
// skipped.
func TestPriorityAndEnabled(t *testing.T) {
	h := &Harness{log: zap.NewNop()}
	// A low-priority deny and a high-priority approve on the same match: the
	// approve runs first but does not short-circuit, so the deny still applies.
	h.AddRule(HarnessRule{ID: "approve", Type: RuleApproval, Condition: "tool == 'x'", Action: ActionApprove, Priority: 10, Enabled: true})
	h.AddRule(HarnessRule{ID: "deny", Type: RuleStateConstraint, Condition: "tool == 'x'", Action: ActionDeny, Priority: 1, Enabled: true})

	res := h.Evaluate(&EvaluationContext{ToolName: "x"})
	if res.Allowed {
		t.Errorf("expected deny to apply regardless of approve order")
	}
	if res.RuleID != "deny" {
		t.Errorf("RuleID = %q, want deny", res.RuleID)
	}

	// Disabled deny must be skipped.
	h2 := &Harness{log: zap.NewNop()}
	h2.AddRule(HarnessRule{ID: "deny-off", Type: RuleStateConstraint, Condition: "tool == 'x'", Action: ActionDeny, Priority: 100, Enabled: false})
	res2 := h2.Evaluate(&EvaluationContext{ToolName: "x"})
	if !res2.Allowed {
		t.Errorf("disabled deny rule must not block, got denied")
	}
}

func TestLoadFromFile(t *testing.T) {
	t.Run("missing file keeps defaults and returns nil", func(t *testing.T) {
		h := newTestHarness()
		before := len(h.Rules())
		if err := h.LoadFromFile(filepath.Join(t.TempDir(), "does-not-exist.json")); err != nil {
			t.Fatalf("missing file must be a no-op, got error: %v", err)
		}
		if got := len(h.Rules()); got != before {
			t.Errorf("rule count changed from %d to %d on missing file", before, got)
		}
	})

	t.Run("invalid JSON returns error", func(t *testing.T) {
		h := newTestHarness()
		path := filepath.Join(t.TempDir(), "bad.json")
		if err := os.WriteFile(path, []byte("{not json"), 0644); err != nil {
			t.Fatal(err)
		}
		if err := h.LoadFromFile(path); err == nil {
			t.Errorf("expected error for invalid JSON")
		}
	})

	t.Run("valid JSON fully replaces rules", func(t *testing.T) {
		h := newTestHarness()
		path := filepath.Join(t.TempDir(), "rules.json")
		cfg := `{"rules":[{"id":"only-rule","name":"Only","type":"state_constraint","condition":"tool == 'x'","action":"deny","priority":1,"enabled":true}]}`
		if err := os.WriteFile(path, []byte(cfg), 0644); err != nil {
			t.Fatal(err)
		}
		if err := h.LoadFromFile(path); err != nil {
			t.Fatalf("LoadFromFile: %v", err)
		}
		rules := h.Rules()
		if len(rules) != 1 {
			t.Fatalf("expected rules to be fully replaced to 1, got %d", len(rules))
		}
		if rules[0].ID != "only-rule" {
			t.Errorf("rule ID = %q, want only-rule", rules[0].ID)
		}
	})
}

func TestRulesReturnsCopy(t *testing.T) {
	h := newTestHarness()
	rules := h.Rules()
	count := len(rules)
	rules[0].ID = "mutated"
	if h.Rules()[0].ID == "mutated" {
		t.Errorf("Rules() must return a copy, mutation leaked into harness")
	}
	if len(h.Rules()) != count {
		t.Errorf("rule count changed unexpectedly")
	}
}
