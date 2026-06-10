// GeoWork Go Core - MCP Tools Adapter

package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"geowork/core/internal/toolregistry"
)

// ToolsAdapter wraps an MCP server as a ToolRegistry tool.
type ToolsAdapter struct {
	base      toolregistry.BaseTool
	manager   *Manager
	serverID  string
}

// NewToolsAdapter creates a meta-tool that exposes an MCP server's tools.
func NewToolsAdapter(manager *Manager, serverID string) *ToolsAdapter {
	return &ToolsAdapter{
		manager:  manager,
		serverID: serverID,
	}
}

// ToTool converts the adapter to a ToolRegistry tool.
func (a *ToolsAdapter) ToTool() toolregistry.Tool {
	return toolregistry.NewBuilder("mcp:"+a.serverID).
		Description(fmt.Sprintf("Call tools from MCP server: %s", a.serverID)).
		InputSchema(map[string]any{
			"type": "object",
			"properties": map[string]any{
				"tool": map[string]any{
					"type":        "string",
					"description": "MCP tool name to call",
				},
				"args": map[string]any{
					"type":        "string",
					"description": "JSON string of arguments",
				},
			},
			"required": []string{"tool", "args"},
		}).
		OutputSchema(map[string]any{
			"type":       "object",
			"properties": map[string]any{
				"success": map[string]any{"type": "boolean"},
				"result":  map[string]any{"type": "string"},
				"error":   map[string]any{"type": "string"},
			},
		}).
		Permission("exec").
		RiskLevel("medium").
		Execute(a.execute).
		Build()
}

func (a *ToolsAdapter) execute(ctx context.Context, args map[string]any) (map[string]any, error) {
	toolName, _ := args["tool"].(string)
	argsJSON, _ := args["args"].(string)

	var argsMap map[string]any
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &argsMap); err != nil {
			return map[string]any{
				"success": false,
				"error":   "invalid args JSON: " + err.Error(),
			}, nil
		}
	}

	resp, err := a.manager.CallTool(ctx, a.serverID, toolName, argsMap)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   err.Error(),
		}, nil
	}

	result := ""
	if resp != nil && resp.Result != nil {
		resultJSON, _ := json.Marshal(resp.Result)
		result = string(resultJSON)
	}

	if resp != nil && resp.Error != nil {
		return map[string]any{
			"success": false,
			"error":   resp.Error.Message,
		}, nil
	}

	return map[string]any{
		"success": true,
		"result":  result,
	}, nil
}

// ListMCPTools lists all tools from all connected MCP servers.
func (m *Manager) ListMCPTools(ctx context.Context) ([]map[string]any, error) {
	m.mu.Lock()
	serverIDs := make([]string, 0, len(m.configs))
	for id := range m.configs {
		serverIDs = append(serverIDs, id)
	}
	m.mu.Unlock()

	var allTools []map[string]any
	for _, id := range serverIDs {
		tools, err := m.ListTools(ctx, id)
		if err != nil {
			continue
		}
		for _, t := range tools {
			t["server"] = id
			allTools = append(allTools, t)
		}
	}
	return allTools, nil
}
