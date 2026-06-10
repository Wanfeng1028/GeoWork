// GeoWork Go Core - Tool Base Type

package toolregistry

import (
	"context"
)

// BaseTool provides default implementations for optional Tool methods.
type BaseTool struct {
	name            string
	description     string
	inputSchema     map[string]any
	outputSchema    map[string]any
	permission      string
	riskLevel       string
	sandboxRequired bool
	streaming       bool
	executeFn       func(ctx context.Context, args map[string]any) (map[string]any, error)
}

func (b *BaseTool) Name() string            { return b.name }
func (b *BaseTool) Description() string     { return b.description }
func (b *BaseTool) InputSchema() map[string]any { return b.inputSchema }
func (b *BaseTool) OutputSchema() map[string]any { return b.outputSchema }
func (b *BaseTool) Permission() string      { return b.permission }
func (b *BaseTool) RiskLevel() string       { return b.riskLevel }
func (b *BaseTool) SandboxRequired() bool   { return b.sandboxRequired }
func (b *BaseTool) StreamingSupported() bool { return b.streaming }
func (b *BaseTool) Execute(ctx context.Context, args map[string]any) (map[string]any, error) {
	if b.executeFn != nil {
		return b.executeFn(ctx, args)
	}
	return nil, nil
}

// Builder creates Tool definitions fluently.
type Builder struct {
	base BaseTool
}

func NewBuilder(name string) *Builder {
	return &Builder{base: BaseTool{name: name}}
}

func (b *Builder) Description(desc string) *Builder {
	b.base.description = desc
	return b
}

func (b *Builder) InputSchema(schema map[string]any) *Builder {
	b.base.inputSchema = schema
	return b
}

func (b *Builder) OutputSchema(schema map[string]any) *Builder {
	b.base.outputSchema = schema
	return b
}

func (b *Builder) Permission(perm string) *Builder {
	b.base.permission = perm
	return b
}

func (b *Builder) RiskLevel(level string) *Builder {
	b.base.riskLevel = level
	return b
}

func (b *Builder) Sandbox(required bool) *Builder {
	b.base.sandboxRequired = required
	return b
}

func (b *Builder) Streaming(supported bool) *Builder {
	b.base.streaming = supported
	return b
}

func (b *Builder) Execute(fn func(ctx context.Context, args map[string]any) (map[string]any, error)) *Builder {
	b.base.executeFn = fn
	return b
}

func (b *Builder) Build() Tool {
	return &b.base
}
