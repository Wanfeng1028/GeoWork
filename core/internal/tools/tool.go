package tools

import (
	"context"
	"errors"
	"sync"
)

type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
)

type Input map[string]any

type Result struct {
	OK      bool           `json:"ok"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data"`
}

type Tool interface {
	Name() string
	Description() string
	RiskLevel() RiskLevel
	Run(context.Context, Input) (Result, error)
}

type FuncTool struct {
	ToolName        string
	ToolDescription string
	Risk            RiskLevel
	Handler         func(context.Context, Input) (Result, error)
}

func (t FuncTool) Name() string { return t.ToolName }
func (t FuncTool) Description() string { return t.ToolDescription }
func (t FuncTool) RiskLevel() RiskLevel { return t.Risk }
func (t FuncTool) Run(ctx context.Context, input Input) (Result, error) { return t.Handler(ctx, input) }

type Registry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

func NewRegistry() *Registry {
	return &Registry{tools: map[string]Tool{}}
}

func (r *Registry) Register(tool Tool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[tool.Name()] = tool
}

func (r *Registry) Get(name string) (Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	tool, ok := r.tools[name]
	return tool, ok
}

func (r *Registry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Tool, 0, len(r.tools))
	for _, tool := range r.tools {
		out = append(out, tool)
	}
	return out
}

func (r *Registry) Run(ctx context.Context, name string, input Input) (Result, error) {
	tool, ok := r.Get(name)
	if !ok {
		return Result{}, errors.New("tool not registered: " + name)
	}
	return tool.Run(ctx, input)
}
