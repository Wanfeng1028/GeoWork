package permissions

import (
	"sync"
	"testing"
	"time"
)

func TestEngineEvaluateNoPolicy(t *testing.T) {
	e := NewEngine()
	level, err := e.Evaluate("unknown-task", ActionRunShell, nil)
	if err == nil {
		t.Fatalf("expected error for missing policy")
	}
	if level != string(Limited) {
		t.Errorf("level = %q, want limited on missing policy", level)
	}
}

func TestEngineEvaluateDefaultAndActionLevels(t *testing.T) {
	e := NewEngine()
	e.SetPolicy("t1", &PermissionPolicy{
		DefaultLevel: Limited,
		Actions:      map[string]string{string(ActionRunShell): string(FullAccess)},
	})

	cases := []struct {
		name   string
		action DangerousAction
		want   string
	}{
		{name: "action-specific override", action: ActionRunShell, want: string(FullAccess)},
		{name: "falls back to default level", action: ActionWriteFile, want: string(Limited)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := e.Evaluate("t1", tc.action, nil)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("Evaluate = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestEngineRememberedDecision(t *testing.T) {
	e := NewEngine()
	e.SetPolicy("t1", &PermissionPolicy{DefaultLevel: Limited, Actions: map[string]string{}})

	e.CreateRequest(&PermissionRequest{ID: "req-1", TaskID: "t1", Action: ActionRunShell})
	if err := e.ApproveRequest("req-1", "user approved"); err != nil {
		t.Fatalf("ApproveRequest: %v", err)
	}

	// The approved decision is remembered and returned within the TTL.
	got, err := e.Evaluate("t1", ActionRunShell, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "approved" {
		t.Errorf("Evaluate = %q, want remembered approved", got)
	}

	// Request is no longer pending.
	if len(e.GetPendingRequests()) != 0 {
		t.Errorf("approved request must leave the pending list")
	}
}

func TestEngineDenyRequest(t *testing.T) {
	e := NewEngine()
	e.SetPolicy("t1", &PermissionPolicy{DefaultLevel: Limited, Actions: map[string]string{}})
	e.CreateRequest(&PermissionRequest{ID: "req-1", TaskID: "t1", Action: ActionDeleteFile})

	if err := e.DenyRequest("req-1", "too risky"); err != nil {
		t.Fatalf("DenyRequest: %v", err)
	}
	got, err := e.Evaluate("t1", ActionDeleteFile, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "denied" {
		t.Errorf("Evaluate = %q, want remembered denied", got)
	}
}

func TestEngineResolveUnknownRequest(t *testing.T) {
	e := NewEngine()
	if err := e.ApproveRequest("ghost", ""); err == nil {
		t.Errorf("expected error approving unknown request")
	}
	if err := e.DenyRequest("ghost", ""); err == nil {
		t.Errorf("expected error denying unknown request")
	}
}

func TestEngineGetPendingRequests(t *testing.T) {
	e := NewEngine()
	e.CreateRequest(&PermissionRequest{ID: "a", TaskID: "t1", Action: ActionRunShell})
	e.CreateRequest(&PermissionRequest{ID: "b", TaskID: "t1", Action: ActionWriteFile})
	if got := len(e.GetPendingRequests()); got != 2 {
		t.Fatalf("pending = %d, want 2", got)
	}
	_ = e.ApproveRequest("a", "")
	if got := len(e.GetPendingRequests()); got != 1 {
		t.Fatalf("pending after approve = %d, want 1", got)
	}
}

func TestEngineIsAllowedWriteActionMatrix(t *testing.T) {
	cases := []struct {
		name   string
		level  PermissionLevel
		action string
		want   bool
	}{
		{name: "read_only blocks write_file", level: ReadOnly, action: "write_file", want: false},
		{name: "read_only allows read action", level: ReadOnly, action: "read_file", want: true},
		{name: "limited blocks run_shell", level: Limited, action: "run_shell", want: false},
		{name: "limited blocks delete_file", level: Limited, action: "delete_file", want: false},
		{name: "full_access allows run_shell", level: FullAccess, action: "run_shell", want: true},
		{name: "ask_every_time allows write (defers to prompt)", level: AskEveryTime, action: "write_file", want: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := NewEngine()
			e.SetPolicy("t1", &PermissionPolicy{DefaultLevel: tc.level, Actions: map[string]string{}})
			got, err := e.IsAllowed("t1", tc.action, nil)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("IsAllowed(%q, %q) = %v, want %v", tc.level, tc.action, got, tc.want)
			}
		})
	}
}

func TestEngineIsAllowedNoPolicy(t *testing.T) {
	e := NewEngine()
	if _, err := e.IsAllowed("missing", "read_file", nil); err == nil {
		t.Fatalf("expected error for missing policy")
	}
}

// TestEngineConcurrentEvaluate exercises the data race that existed when
// Evaluate deleted expired decisions while holding only a read lock. Run with
// -race: before the fix this reported a concurrent map write.
func TestEngineConcurrentEvaluate(t *testing.T) {
	e := NewEngine()
	e.SetPolicy("t1", &PermissionPolicy{DefaultLevel: Limited, Actions: map[string]string{}})

	// Seed an already-expired decision so Evaluate takes the delete branch.
	key := "t1:" + string(ActionRunShell)
	e.mu.Lock()
	e.decisions[key] = Decision{Decision: "approved", At: time.Now().Add(-48 * time.Hour)}
	e.mu.Unlock()

	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				_, _ = e.Evaluate("t1", ActionRunShell, nil)
			}
		}()
	}
	wg.Wait()
}
