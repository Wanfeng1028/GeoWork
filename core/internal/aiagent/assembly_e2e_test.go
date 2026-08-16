// GeoWork Go Core - Production-assembly E2E tests (doc/22 BP1)
//
// The existing orchestrator tests build a minimal registry with a single
// permission-free read tool, which silently skips the production
// permission path — the exact blind spot that let the F1 assembly gap
// live (every write/exec tool call was "permission denied" under the
// real main.go wiring while the whole suite stayed green).
//
// These tests mirror the main.go wiring chain — builtin tools, sandbox
// roots, desktop permission policy, harness, speculative policy table,
// workspace pin — and drive real writes through it.

package aiagent

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go.uber.org/zap"

	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"
)

// newAssemblyOrchestrator mirrors cmd/geowork-runtime/main.go's
// orchestrator wiring. Any drift between this chain and main.go is a
// regression — keep both in sync.
func newAssemblyOrchestrator(t *testing.T, gw modelgateway.ModelGateway, ws string) *Orchestrator {
	t.Helper()
	log := zap.NewNop()
	registry := toolregistry.NewRegistry(log)
	if err := toolregistry.RegisterBuiltinTools(registry); err != nil {
		t.Fatalf("register builtin tools: %v", err)
	}
	registry.WithAllowedRoots([]string{ws})
	provider := &modelgateway.ModelProvider{ID: "scripted", DefaultModel: "scripted-model"}
	orch := NewOrchestrator(registry, gw, provider, log)
	orch.WithHarness(NewHarness(log))
	orch.WithPolicyTable(toolregistry.DefaultPolicyTable())
	orch.WithPermissionPolicy(DefaultDesktopPolicy())
	orch.WithWorkspacePath(ws)
	return orch
}

func writeToolCall(id, path, content string) modelgateway.ToolCall {
	return modelgateway.ToolCall{
		Index: 0,
		ID:    id,
		Type:  "function",
		Function: modelgateway.ToolFunctionCall{
			Name:      "write_file",
			Arguments: fmt.Sprintf(`{"path":%q,"content":%q}`, path, content),
		},
	}
}

// The headline BP1 test: under the real assembly, a write_file tool call
// from the model must actually land on disk. Before BP1 this failed with
// "high-risk tool write_file requires an explicit permission policy".
func TestRealAssembly_WriteFileSucceeds(t *testing.T) {
	ws := t.TempDir()
	target := filepath.ToSlash(filepath.Join(ws, "out", "hello.txt"))
	gw := &scriptedGateway{responses: []scriptedResponse{
		{toolCalls: []modelgateway.ToolCall{writeToolCall("w1", target, "hello geowork")}},
		{content: "file written"},
	}}
	orch := newAssemblyOrchestrator(t, gw, ws)

	run, err := orch.StartRun(context.Background(), "Work", "write hello to a file")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	done := waitRun(t, orch, run.ID)
	if done.Status != StatusCompleted {
		t.Fatalf("run status = %s (result: %s), want completed", done.Status, done.Result)
	}
	data, err := os.ReadFile(filepath.Join(ws, "out", "hello.txt"))
	if err != nil {
		t.Fatalf("file was not written: %v", err)
	}
	if string(data) != "hello geowork" {
		t.Fatalf("file content = %q, want %q", string(data), "hello geowork")
	}
}

// A write targeting a path outside the sandbox roots must be denied; the
// run itself still completes (the model receives the tool error and the
// scripted second turn ends the loop).
func TestRealAssembly_SandboxEscapeDenied(t *testing.T) {
	ws := t.TempDir()
	outside := filepath.ToSlash(filepath.Join(t.TempDir(), "escape.txt"))
	gw := &scriptedGateway{responses: []scriptedResponse{
		{toolCalls: []modelgateway.ToolCall{writeToolCall("w1", outside, "nope")}},
		{content: "okay, the write was blocked"},
	}}
	orch := newAssemblyOrchestrator(t, gw, ws)

	run, err := orch.StartRun(context.Background(), "Work", "write outside the workspace")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	done := waitRun(t, orch, run.ID)
	if done.Status != StatusCompleted {
		t.Fatalf("run status = %s, want completed (blocked tool must not fail the run)", done.Status)
	}
	if _, err := os.Stat(outside); !os.IsNotExist(err) {
		t.Fatalf("file outside sandbox roots was created")
	}
}

// Registry-level check of the run_shell command-string path scan
// (doc/22 F5 minimal fix): absolute paths embedded in the command are
// validated against the sandbox roots.
func TestRealAssembly_RunShellCommandPathScan(t *testing.T) {
	ws := t.TempDir()
	log := zap.NewNop()
	registry := toolregistry.NewRegistry(log)
	if err := toolregistry.RegisterBuiltinTools(registry); err != nil {
		t.Fatalf("register builtin tools: %v", err)
	}
	registry.WithAllowedRoots([]string{ws})
	ctx := toolregistry.WithPolicy(context.Background(), DefaultDesktopPolicy())

	outside := filepath.ToSlash(filepath.Join(t.TempDir(), "x.txt"))
	_, err := registry.Execute(ctx, "run_shell",
		map[string]any{"command": "cat " + outside}, toolregistry.ModeDeterministic)
	if err == nil || !strings.Contains(err.Error(), "outside the sandbox") {
		t.Fatalf("expected sandbox rejection for outside path, got: %v", err)
	}

	// A command referencing a path INSIDE the roots passes the scan (the
	// command itself may still fail at exec time — that is not this gate).
	inside := filepath.ToSlash(filepath.Join(ws, "ok.txt"))
	_, err = registry.Execute(ctx, "run_shell",
		map[string]any{"command": "echo hi > " + inside}, toolregistry.ModeDeterministic)
	if err != nil && strings.Contains(err.Error(), "outside the sandbox") {
		t.Fatalf("inside path wrongly rejected: %v", err)
	}
}
