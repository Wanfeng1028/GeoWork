// GeoWork Go Core - Dynamic Worker Tool Registration

package toolregistry

import (
	"context"
	"fmt"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// RegisterWorkerTools fetches the tool catalog from the Python Worker and
// dynamically registers each one into the ToolRegistry.
//
// Worker tool names use a namespaced format (e.g. "research.openalex.search",
// "geo.gdal.inspect_dataset") and are kept distinct from the 13 builtin
// tools (read_file / write_file / ...). Registering them in the same
// ToolRegistry lets workflow + aiagent calls flow through the unified
// governance path (audit log + permission check + sandbox flag).
//
// Failure to fetch the catalog is non-fatal: the runtime logs a warning and
// continues with only the builtin tools registered. Callers that depend on a
// specific worker tool should check its presence via r.Get(name) afterwards.
func RegisterWorkerTools(ctx context.Context, r *Registry, workerClient *worker.Client, log *zap.Logger) error {
	if r == nil {
		return fmt.Errorf("registry is nil")
	}
	if workerClient == nil {
		return fmt.Errorf("worker client is nil")
	}

	tools, err := workerClient.ListTools(ctx)
	if err != nil {
		if log != nil {
			log.Warn("failed to list worker tools; skipping dynamic registration",
				zap.Error(err),
			)
		}
		return nil
	}

	registered := 0
	for _, t := range tools {
		toolName := t.Name
		if toolName == "" {
			continue
		}
		// Skip if already registered (idempotent on repeated startup).
		if r.IsRegistered(toolName) {
			continue
		}
		risk := t.RiskLevel
		if risk == "" {
			risk = "medium"
		}
		// Capture toolName in a local variable to avoid the classic
		// loop-variable-capture footgun when building the closure below.
		name := toolName
		tool := NewBuilder(name).
			Description(t.Description).
			InputSchema(t.InputSchema).
			Permission("exec").
			RiskLevel(risk).
			Sandbox(false).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				return workerClient.RunTool(ctx, name, args)
			}).
			Build()
		if err := r.Register(tool); err != nil {
			if log != nil {
				log.Warn("failed to register worker tool",
					zap.String("tool", name),
					zap.Error(err),
				)
			}
			continue
		}
		registered++
	}

	if log != nil {
		log.Info("worker tools registered",
			zap.Int("count", registered),
			zap.Int("catalogSize", len(tools)),
		)
	}
	return nil
}
