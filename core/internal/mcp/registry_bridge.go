// GeoWork Go Core - MCP → ToolRegistry Bridge (P2-2 §3.5)
//
// RegisterAllTools connects to every configured MCP server, performs the
// initialize handshake, and registers each discovered tool into the
// supplied ToolRegistry. Lives in package mcp so the dependency direction
// stays one-way (mcp → toolregistry); toolregistry never imports mcp.
//
// Failures are non-fatal — a server that won't start is logged and
// skipped, leaving the rest of the registry intact.

package mcp

import (
	"context"
	"fmt"

	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// RegisterAllTools iterates Manager.configs, connects each enabled server,
// and registers every discovered MCPTool under the namespaced name
// "<serverID>_<toolName>" so it cannot collide with builtin tools or
// other MCP servers.
//
// Already-registered tools (idempotent re-runs) are skipped.
func RegisterAllTools(ctx context.Context, m *Manager, reg *toolregistry.Registry, log *zap.Logger) error {
	if m == nil || reg == nil {
		return fmt.Errorf("mcp RegisterAllTools: nil manager or registry")
	}

	configs := m.ListConfigs()
	registered := 0
	connectedServers := 0

	for _, cfg := range configs {
		if !cfg.Enabled && !cfg.BuiltIn {
			// Built-in defaults are skipped unless explicitly enabled.
			continue
		}
		// If the server is already connected (e.g. via the HTTP API),
		// reuse that client — otherwise connect now.
		client, err := ensureConnected(ctx, m, cfg.ID)
		if err != nil {
			if log != nil {
				log.Warn("mcp: server connect failed; skipping",
					zap.String("server", cfg.ID),
					zap.Error(err),
				)
			}
			continue
		}
		connectedServers++

		for _, t := range client.Tools() {
			toolName := cfg.ID + "_" + t.Name
			if reg.IsRegistered(toolName) {
				continue
			}
			// Capture loop variables for the closure.
			clientRef := client
			remoteName := t.Name
			adapter := toolregistry.NewBuilder(toolName).
				Description(t.Description).
				InputSchema(t.InputSchema).
				Permission("exec").
				RiskLevel("medium").
				Sandbox(false).
				Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
					return clientRef.CallToolRaw(ctx, remoteName, args)
				}).
				Build()
			if err := reg.Register(adapter); err != nil {
				if log != nil {
					log.Warn("mcp: failed to register tool",
						zap.String("tool", toolName),
						zap.Error(err),
					)
				}
				continue
			}
			registered++
		}
	}

	if log != nil {
		log.Info("mcp tools registered",
			zap.Int("count", registered),
			zap.Int("servers", connectedServers),
		)
	}
	return nil
}

// ensureConnected returns the connected client for `id`, connecting on
// demand if Manager only has the config registered. This keeps the
// bootstrap path (Manager created but no HTTP /connect calls yet) working.
func ensureConnected(ctx context.Context, m *Manager, id string) (*MCPClient, error) {
	m.mu.Lock()
	client, ok := m.clients[id]
	m.mu.Unlock()
	if ok {
		return client, nil
	}
	if err := m.Connect(ctx, id); err != nil {
		return nil, err
	}
	m.mu.Lock()
	client, ok = m.clients[id]
	m.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("mcp: server %s connect reported success but client missing", id)
	}
	return client, nil
}
