package tools

import (
	"context"
	"testing"
)

func TestFuncTool(t *testing.T) {
	tool := FuncTool{
		ToolName:        "test.tool",
		ToolDescription: "A test tool",
		Risk:            RiskLow,
		Handler: func(ctx context.Context, input Input) (Result, error) {
			return Result{OK: true, Data: map[string]any{"result": "ok"}}, nil
		},
	}

	if tool.Name() != "test.tool" {
		t.Fatalf("expected name test.tool, got %s", tool.Name())
	}
	if tool.Description() != "A test tool" {
		t.Fatalf("expected description 'A test tool', got %s", tool.Description())
	}
	if tool.RiskLevel() != RiskLow {
		t.Fatalf("expected risk low, got %s", tool.RiskLevel())
	}

	result, err := tool.Run(context.Background(), Input{"key": "value"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.OK {
		t.Fatalf("expected OK true")
	}
	if result.Data["result"] != "ok" {
		t.Fatalf("expected result ok, got %v", result.Data["result"])
	}
}

func TestRegistry(t *testing.T) {
	registry := NewRegistry()

	tool := FuncTool{
		ToolName:        "test.registry",
		ToolDescription: "Registry test",
		Risk:            RiskMedium,
		Handler: func(ctx context.Context, input Input) (Result, error) {
			return Result{OK: true}, nil
		},
	}

	registry.Register(tool)

	registered, ok := registry.Get("test.registry")
	if !ok {
		t.Fatalf("expected tool to be registered")
	}
	if registered.Name() != "test.registry" {
		t.Fatalf("expected name test.registry, got %s", registered.Name())
	}

	list := registry.List()
	if len(list) != 1 {
		t.Fatalf("expected 1 tool in list, got %d", len(list))
	}

	_, ok = registry.Get("nonexistent")
	if ok {
		t.Fatalf("expected tool to not be found")
	}

	_, err := registry.Run(context.Background(), "nonexistent", Input{})
	if err == nil {
		t.Fatalf("expected error for nonexistent tool")
	}
}

func TestRiskLevels(t *testing.T) {
	if RiskLow != "low" {
		t.Fatalf("expected RiskLow to be 'low'")
	}
	if RiskMedium != "medium" {
		t.Fatalf("expected RiskMedium to be 'medium'")
	}
	if RiskHigh != "high" {
		t.Fatalf("expected RiskHigh to be 'high'")
	}
}
