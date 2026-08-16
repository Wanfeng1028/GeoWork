package permissions

import (
	"testing"
)

func TestAuthorizationPolicyIsAllowed(t *testing.T) {
	cases := []struct {
		name       string
		rules      []PermissionRule
		defaultAct Effect
		resource   string
		action     string
		conditions map[string]string
		want       bool
	}{
		{
			name:       "exact resource and action allow",
			rules:      []PermissionRule{{Resource: "files", Action: "read", Effect: Allow}},
			defaultAct: Deny,
			resource:   "files",
			action:     "read",
			want:       true,
		},
		{
			name:       "exact match deny",
			rules:      []PermissionRule{{Resource: "files", Action: "delete", Effect: Deny}},
			defaultAct: Allow,
			resource:   "files",
			action:     "delete",
			want:       false,
		},
		{
			name:       "wildcard resource",
			rules:      []PermissionRule{{Resource: "*", Action: "read", Effect: Allow}},
			defaultAct: Deny,
			resource:   "anything",
			action:     "read",
			want:       true,
		},
		{
			name:       "wildcard action",
			rules:      []PermissionRule{{Resource: "files", Action: "*", Effect: Allow}},
			defaultAct: Deny,
			resource:   "files",
			action:     "write",
			want:       true,
		},
		{
			name:       "prefix wildcard resource",
			rules:      []PermissionRule{{Resource: "files/*", Action: "read", Effect: Allow}},
			defaultAct: Deny,
			resource:   "files/data/a.txt",
			action:     "read",
			want:       true,
		},
		{
			name:       "prefix wildcard does not match other roots",
			rules:      []PermissionRule{{Resource: "files/*", Action: "read", Effect: Allow}},
			defaultAct: Deny,
			resource:   "secrets/key",
			action:     "read",
			want:       false,
		},
		{
			name:       "case and whitespace normalized",
			rules:      []PermissionRule{{Resource: "Files", Action: "Read", Effect: Allow}},
			defaultAct: Deny,
			resource:   "  files  ",
			action:     " READ ",
			want:       true,
		},
		{
			name:       "condition satisfied",
			rules:      []PermissionRule{{Resource: "files", Action: "read", Effect: Allow, Conditions: map[string]string{"env": "dev"}}},
			defaultAct: Deny,
			resource:   "files",
			action:     "read",
			conditions: map[string]string{"env": "dev"},
			want:       true,
		},
		{
			name:       "condition value mismatch skips rule",
			rules:      []PermissionRule{{Resource: "files", Action: "read", Effect: Allow, Conditions: map[string]string{"env": "dev"}}},
			defaultAct: Deny,
			resource:   "files",
			action:     "read",
			conditions: map[string]string{"env": "prod"},
			want:       false,
		},
		{
			name:       "condition key missing skips rule",
			rules:      []PermissionRule{{Resource: "files", Action: "read", Effect: Allow, Conditions: map[string]string{"env": "dev"}}},
			defaultAct: Deny,
			resource:   "files",
			action:     "read",
			conditions: map[string]string{},
			want:       false,
		},
		{
			name:       "nil conditions with rule conditions skips rule",
			rules:      []PermissionRule{{Resource: "files", Action: "read", Effect: Allow, Conditions: map[string]string{"env": "dev"}}},
			defaultAct: Deny,
			resource:   "files",
			action:     "read",
			conditions: nil,
			want:       false,
		},
		{
			name: "first matching rule wins - deny before allow",
			rules: []PermissionRule{
				{Resource: "files", Action: "read", Effect: Deny},
				{Resource: "files", Action: "read", Effect: Allow},
			},
			defaultAct: Allow,
			resource:   "files",
			action:     "read",
			want:       false,
		},
		{
			name: "first matching rule wins - allow before deny",
			rules: []PermissionRule{
				{Resource: "files", Action: "read", Effect: Allow},
				{Resource: "files", Action: "read", Effect: Deny},
			},
			defaultAct: Deny,
			resource:   "files",
			action:     "read",
			want:       true,
		},
		{
			name:       "no rule matches falls to default deny",
			rules:      []PermissionRule{{Resource: "files", Action: "read", Effect: Allow}},
			defaultAct: Deny,
			resource:   "network",
			action:     "connect",
			want:       false,
		},
		{
			name:       "no rule matches falls to default allow",
			rules:      []PermissionRule{},
			defaultAct: Allow,
			resource:   "network",
			action:     "connect",
			want:       true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := NewAuthorizationPolicy(tc.defaultAct)
			p.AddRules(tc.rules)
			if got := p.IsAllowed(tc.resource, tc.action, tc.conditions); got != tc.want {
				t.Errorf("IsAllowed(%q, %q) = %v, want %v", tc.resource, tc.action, got, tc.want)
			}
		})
	}
}

func TestFromJSONDefaultsToDeny(t *testing.T) {
	p, err := FromJSON([]byte(`{"rules":[]}`))
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}
	if p.DefaultAction != Deny {
		t.Errorf("empty default_action must default to Deny, got %q", p.DefaultAction)
	}
}

func TestFromJSONInvalid(t *testing.T) {
	if _, err := FromJSON([]byte(`{not json`)); err == nil {
		t.Fatalf("expected error for invalid JSON")
	}
}

func TestPolicyJSONRoundTrip(t *testing.T) {
	p := NewAuthorizationPolicy(Allow)
	p.AddRule(PermissionRule{Resource: "files/*", Action: "read", Effect: Allow})

	data, err := p.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}
	restored, err := FromJSON(data)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}
	if restored.DefaultAction != Allow || restored.RuleCount() != 1 {
		t.Errorf("round trip mismatch: %+v", restored)
	}
}

func TestRemoveRule(t *testing.T) {
	p := NewAuthorizationPolicy(Deny)
	p.AddRules([]PermissionRule{
		{Resource: "a", Action: "read", Effect: Allow},
		{Resource: "b", Action: "read", Effect: Allow},
	})
	if err := p.RemoveRule(0); err != nil {
		t.Fatalf("RemoveRule: %v", err)
	}
	if p.RuleCount() != 1 || p.GetRules()[0].Resource != "b" {
		t.Errorf("wrong rule removed: %+v", p.GetRules())
	}
	if err := p.RemoveRule(5); err == nil {
		t.Errorf("expected error for out-of-range index")
	}
	if err := p.RemoveRule(-1); err == nil {
		t.Errorf("expected error for negative index")
	}
}

func TestCloneIsDeepCopy(t *testing.T) {
	p := NewAuthorizationPolicy(Deny)
	p.AddRule(PermissionRule{Resource: "a", Action: "read", Effect: Allow})
	cp := p.Clone()
	cp.AddRule(PermissionRule{Resource: "b", Action: "write", Effect: Deny})
	if p.RuleCount() != 1 {
		t.Errorf("mutating clone must not affect original, got %d rules", p.RuleCount())
	}
}

func TestPolicyConfigValidate(t *testing.T) {
	valid := func() *PolicyConfig {
		return &PolicyConfig{
			Version: "1.0",
			Global:  GlobalPolicy{DefaultLevel: Limited, DecisionTTLHours: 24},
		}
	}

	cases := []struct {
		name    string
		mutate  func(c *PolicyConfig)
		wantErr bool
	}{
		{name: "valid config", mutate: func(c *PolicyConfig) {}, wantErr: false},
		{name: "missing version", mutate: func(c *PolicyConfig) { c.Version = "" }, wantErr: true},
		{name: "missing defaultLevel", mutate: func(c *PolicyConfig) { c.Global.DefaultLevel = "" }, wantErr: true},
		{name: "invalid defaultLevel", mutate: func(c *PolicyConfig) { c.Global.DefaultLevel = "superuser" }, wantErr: true},
		{name: "negative decisionTTLHours", mutate: func(c *PolicyConfig) { c.Global.DecisionTTLHours = -1 }, wantErr: true},
		{
			name:    "invalid task mode",
			mutate:  func(c *PolicyConfig) { c.TaskPolicies = []TaskPolicy{{TaskID: "t1", Mode: "research", Level: Limited}} },
			wantErr: true,
		},
		{
			name:    "valid task policy",
			mutate:  func(c *PolicyConfig) { c.TaskPolicies = []TaskPolicy{{TaskID: "t1", Mode: "work", Level: Limited}} },
			wantErr: false,
		},
		{
			name:    "task policy missing taskId",
			mutate:  func(c *PolicyConfig) { c.TaskPolicies = []TaskPolicy{{Mode: "work", Level: Limited}} },
			wantErr: true,
		},
		{
			name:    "whitelist rule missing level",
			mutate:  func(c *PolicyConfig) { c.Whitelist = []ActionRule{{Action: ActionRunShell}} },
			wantErr: true,
		},
		{
			name:    "blacklist rule missing action",
			mutate:  func(c *PolicyConfig) { c.Blacklist = []ActionRule{{Level: Limited}} },
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := valid()
			tc.mutate(c)
			err := c.Validate()
			if tc.wantErr && err == nil {
				t.Errorf("expected validation error")
			}
			if !tc.wantErr && err != nil {
				t.Errorf("unexpected validation error: %v", err)
			}
		})
	}
}

func TestMergeInto(t *testing.T) {
	cfg := &PolicyConfig{
		Version: "1.0",
		Global:  GlobalPolicy{DefaultLevel: FullAccess},
		TaskPolicies: []TaskPolicy{
			{TaskID: "t1", Mode: "work", Level: Limited, Actions: map[string]string{"run_shell": string(AskEveryTime)}},
		},
		Whitelist: []ActionRule{{Action: ActionReadEnv, Level: Limited}},
		Blacklist: []ActionRule{{Action: ActionReadEnv, Level: ReadOnly}},
	}

	policy := &PermissionPolicy{Actions: map[string]string{}}
	cfg.MergeInto(policy)

	if policy.DefaultLevel != FullAccess {
		t.Errorf("DefaultLevel = %q, want full_access", policy.DefaultLevel)
	}
	if policy.Actions["run_shell"] != string(AskEveryTime) {
		t.Errorf("task action override not merged: %v", policy.Actions)
	}
	// Blacklist is applied after whitelist, so it wins for the same action.
	if policy.Actions[string(ActionReadEnv)] != string(ReadOnly) {
		t.Errorf("blacklist must overwrite whitelist for same action, got %v", policy.Actions[string(ActionReadEnv)])
	}
}

func TestMergeIntoNilPolicyIsNoop(t *testing.T) {
	cfg := &PolicyConfig{Version: "1.0", Global: GlobalPolicy{DefaultLevel: Limited}}
	cfg.MergeInto(nil) // must not panic
}

func TestPolicyLoaderSaveLoadRoundTrip(t *testing.T) {
	loader := NewPolicyLoader()
	path := t.TempDir() + "/policy.json"

	cfg := loader.Default()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("default config must be valid: %v", err)
	}
	if err := loader.Save(path, cfg); err != nil {
		t.Fatalf("Save: %v", err)
	}
	loaded, err := loader.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if loaded.Version != cfg.Version || loaded.Global.DefaultLevel != cfg.Global.DefaultLevel {
		t.Errorf("round trip mismatch: %+v", loaded)
	}
}

func TestPolicyLoaderErrors(t *testing.T) {
	loader := NewPolicyLoader()
	if _, err := loader.Load(""); err == nil {
		t.Errorf("expected error for empty load path")
	}
	if _, err := loader.Load(t.TempDir() + "/missing.json"); err == nil {
		t.Errorf("expected error for missing file")
	}
	if err := loader.Save("", &PolicyConfig{}); err == nil {
		t.Errorf("expected error for empty save path")
	}
	if err := loader.Save(t.TempDir()+"/x.json", nil); err == nil {
		t.Errorf("expected error for nil config")
	}
}
