// GeoWork Go Core - MCP Client (P2-2 §3.3)
//
// MCPClient connects to an MCP server via a Transport (stdio or http),
// performs the JSON-RPC 2.0 initialize handshake, discovers the server's
// tool catalog, and exposes CallTool for downstream adapters.

package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// MCPTool describes a tool exposed by an MCP server.
type MCPTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema,omitempty"`
}

// ServerInfo captures the initialize handshake response.
type ServerInfo struct {
	Name            string    `json:"name"`
	Version         string    `json:"version"`
	ProtocolVersion string    `json:"protocolVersion,omitempty"`
	Tools           []MCPTool `json:"tools,omitempty"`
}

// MCPResponse is the parsed result of a tools/call request. Either Result
// or Error is populated.
type MCPResponse struct {
	Result json.RawMessage `json:"result,omitempty"`
	Error  *JSONRPCError   `json:"error,omitempty"`
}

// MCPClient is a connected MCP client. It is safe for concurrent CallTool use.
type MCPClient struct {
	transport Transport
	info      *ServerInfo
	tools     []MCPTool
	log       *zap.Logger
	nextID    int64
	timeout   time.Duration
}

// NewMCPClient builds a client from a ServerConfig — the constructor used
// by Manager.Connect. The transport is chosen from the config (stdio if
// Command is set, http otherwise).
func NewMCPClient(cfg *ServerConfig, log *zap.Logger) *MCPClient {
	var transport Transport
	if cfg.IsStdio() {
		transport = NewStdioTransport(cfg.Command, cfg.Args, cfg.Env, log)
	} else {
		transport = NewHTTPTransport(cfg.Command, nil, log) // cfg.Command holds the endpoint URL when not stdio
	}
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	return &MCPClient{transport: transport, log: log, timeout: timeout}
}

// NewClient returns a client bound to the given transport. The transport
// is not connected — call Connect() to perform the handshake.
func NewClient(transport Transport, log *zap.Logger) *MCPClient {
	return &MCPClient{transport: transport, log: log, timeout: 30 * time.Second}
}

// Connect performs the transport connect + initialize handshake and
// populates the tool list.
func (c *MCPClient) Connect(ctx context.Context) error {
	if c.transport == nil {
		return fmt.Errorf("mcp: nil transport")
	}
	if err := c.transport.Connect(); err != nil {
		return fmt.Errorf("mcp: transport connect: %w", err)
	}

	// initialize
	resp, err := c.sendRequest("initialize", map[string]any{
		"protocolVersion": "2024-11-05",
		"capabilities":    map[string]any{},
		"clientInfo": map[string]any{
			"name":    "GeoWork",
			"version": "1.0",
		},
	})
	if err != nil {
		return fmt.Errorf("mcp: initialize: %w", err)
	}
	var initResp struct {
		Result struct {
			ProtocolVersion string `json:"protocolVersion"`
			ServerInfo      struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			} `json:"serverInfo"`
		} `json:"result"`
		Error *JSONRPCError `json:"error"`
	}
	if err := json.Unmarshal(resp, &initResp); err != nil {
		return fmt.Errorf("mcp: parse initialize response: %w", err)
	}
	if initResp.Error != nil {
		return fmt.Errorf("mcp: initialize rpc error: %w", initResp.Error)
	}

	info := &ServerInfo{
		Name:            initResp.Result.ServerInfo.Name,
		Version:         initResp.Result.ServerInfo.Version,
		ProtocolVersion: initResp.Result.ProtocolVersion,
	}
	c.info = info

	// Send initialized notification (no response expected).
	_, _ = c.sendRequest("notifications/initialized", nil)

	// Discover tools.
	toolsResp, err := c.sendRequest("tools/list", map[string]any{})
	if err != nil {
		// Some servers don't expose tools/list — leave empty.
		if c.log != nil {
			c.log.Warn("mcp: tools/list failed; assuming no tools",
				zap.String("server", info.Name),
				zap.Error(err),
			)
		}
		c.tools = []MCPTool{}
		return nil
	}
	var toolsPayload struct {
		Result struct {
			Tools []MCPTool `json:"tools"`
		} `json:"result"`
		Error *JSONRPCError `json:"error"`
	}
	if err := json.Unmarshal(toolsResp, &toolsPayload); err != nil {
		return fmt.Errorf("mcp: parse tools/list response: %w", err)
	}
	if toolsPayload.Error != nil {
		return fmt.Errorf("mcp: tools/list rpc error: %w", toolsPayload.Error)
	}
	c.tools = toolsPayload.Result.Tools
	if c.tools == nil {
		c.tools = []MCPTool{}
	}
	if c.log != nil {
		c.log.Info("mcp client connected",
			zap.String("server", info.Name),
			zap.String("version", info.Version),
			zap.Int("tools", len(c.tools)),
		)
	}
	return nil
}

// CallTool invokes `name` with `args` on the connected MCP server.
// Returns a parsed MCPResponse.
func (c *MCPClient) CallTool(ctx context.Context, name string, args map[string]any) (*MCPResponse, error) {
	resp, err := c.sendRequest("tools/call", map[string]any{
		"name":      name,
		"arguments": args,
	})
	if err != nil {
		return nil, fmt.Errorf("mcp: call %s: %w", name, err)
	}
	var payload MCPResponse
	if err := json.Unmarshal(resp, &payload); err != nil {
		return nil, fmt.Errorf("mcp: parse call response: %w", err)
	}
	return &payload, nil
}

// CallToolRaw invokes `name` and returns the raw result map. Convenience
// for adapters that want a map[string]any directly (e.g. the toolregistry
// Tool adapter uses this so its Execute signature matches the registry).
func (c *MCPClient) CallToolRaw(ctx context.Context, name string, args map[string]any) (map[string]any, error) {
	resp, err := c.CallTool(ctx, name, args)
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("mcp: call %s rpc error: %w", name, resp.Error)
	}
	var out map[string]any
	if len(resp.Result) > 0 {
		if err := json.Unmarshal(resp.Result, &out); err != nil {
			// Result might be a scalar; wrap it.
			out = map[string]any{"result": string(resp.Result)}
		}
	}
	if out == nil {
		out = map[string]any{}
	}
	return out, nil
}

// Tools returns the discovered tool catalog. Available after Connect.
func (c *MCPClient) Tools() []MCPTool {
	return c.tools
}

// ServerInfo returns the server identity captured during initialize.
func (c *MCPClient) ServerInfo() *ServerInfo { return c.info }

// Close closes the underlying transport.
func (c *MCPClient) Close() error {
	if c.transport == nil {
		return nil
	}
	return c.transport.Close()
}

// sendRequest builds a JSON-RPC 2.0 envelope, sends it, and returns the
// raw response bytes.
func (c *MCPClient) sendRequest(method string, params any) ([]byte, error) {
	id := atomic.AddInt64(&c.nextID, 1)
	envelope := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
	}
	if params != nil {
		envelope["params"] = params
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("marshal %s: %w", method, err)
	}
	resp, err := c.transport.Send(body)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
