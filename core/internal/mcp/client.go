// GeoWork Go Core - MCP Client

package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"

	"go.uber.org/zap"
)

// MCPClient manages communication with an MCP server via stdio.
type MCPClient struct {
	config     *ServerConfig
	cmd        *exec.Cmd
	stdin      *os.File
	stdout     *bufio.Reader
	log        *zap.Logger
	mu         sync.Mutex
	nextID     atomic.Int64
	runs       map[int64]*pendingRequest
	serverInfo map[string]string
}

type pendingRequest struct {
	cancel context.CancelFunc
	result chan<- MCPResponse
}

type MCPResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *MCPError       `json:"error,omitempty"`
}

type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func NewMCPClient(config *ServerConfig, log *zap.Logger) *MCPClient {
	return &MCPClient{
		config:     config,
		log:        log,
		runs:       make(map[int64]*pendingRequest),
		serverInfo: make(map[string]string),
	}
}

// Connect starts the MCP server process and initializes the connection.
func (c *MCPClient) Connect(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, c.config.Command, c.config.Args...)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}

	c.cmd = cmd
	c.stdin = stdin
	c.stdout = bufio.NewReader(stdout)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start process: %w", err)
	}

	// Initialize with JSON-RPC initialize request
	_ = c.sendRequest(ctx, map[string]any{
		"jsonrpc": "2.0",
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]any{},
			"clientInfo":      map[string]any{"name": "geowork", "version": "0.3.0"},
		},
		"id": c.nextID.Add(1),
	})

	// Send initialized notification
	_ = c.sendNotification("notifications/initialized", map[string]any{})

	c.serverInfo["version"] = "2024-11-05"
	return nil
}

// IsConnected checks if the client is connected.
func (c *MCPClient) IsConnected() bool {
	return c.cmd != nil && c.cmd.Process != nil
}

// ListTools fetches available tools from the MCP server.
func (c *MCPClient) ListTools(ctx context.Context) ([]map[string]any, error) {
	resp, err := c.sendRequest(ctx, map[string]any{
		"jsonrpc": "2.0",
		"method":  "tools/list",
		"id":      c.nextID.Add(1),
	})
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("tools/list error: %s", resp.Error.Message)
	}

	var result struct {
		Tools []map[string]any `json:"tools"`
	}
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, err
	}
	return result.Tools, nil
}

// CallTool invokes an MCP tool.
func (c *MCPClient) CallTool(ctx context.Context, name string, args map[string]any) (*MCPResponse, error) {
	return c.sendRequest(ctx, map[string]any{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"params": map[string]any{
			"name":   name,
			"arguments": args,
		},
		"id": c.nextID.Add(1),
	})
}

// Close stops the MCP server process.
func (c *MCPClient) Close() error {
	if c.cmd != nil && c.cmd.Process != nil {
		return c.cmd.Process.Kill()
	}
	return nil
}

// sendRequest sends a JSON-RPC request and waits for the response.
func (c *MCPClient) sendRequest(ctx context.Context, req map[string]any) (*MCPResponse, error) {
	reqData, _ := json.Marshal(req)

	ch := make(chan MCPResponse, 1)
	id := req["id"].(int64)
	cancel := context.CancelFunc(func() {})
	ctx, cancel = context.WithCancel(ctx)
	defer cancel()

	c.mu.Lock()
	c.runs[id] = &pendingRequest{cancel: cancel, result: ch}
	c.mu.Unlock()

	_, err := c.stdin.Write(append(reqData, '\n'))
	if err != nil {
		c.mu.Lock()
		delete(c.runs, id)
		c.mu.Unlock()
		return nil, fmt.Errorf("write request: %w", err)
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case resp := <-ch:
		return &resp, nil
	}
}

// sendNotification sends a notification (no response expected).
func (c *MCPClient) sendNotification(method string, params map[string]any) error {
	req := map[string]any{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	}
	data, _ := json.Marshal(req)
	_, err := c.stdin.Write(append(data, '\n'))
	return err
}

// ReadResponse reads a single JSON-RPC response from the server.
func (c *MCPClient) ReadResponse() error {
	line, err := c.stdout.ReadString('\n')
	if err != nil {
		return err
	}

	var resp struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      json.Number     `json:"id,omitempty"`
		Method  string          `json:"method,omitempty"`
		Result  json.RawMessage `json:"result,omitempty"`
		Error   *MCPError       `json:"error,omitempty"`
	}
	if err := json.Unmarshal([]byte(line), &resp); err != nil {
		return err
	}

	if resp.ID != "" {
		id, _ := resp.ID.Int64()
		c.mu.Lock()
		pending, ok := c.runs[id]
		c.mu.Unlock()
		if ok {
			pending.result <- MCPResponse{Result: resp.Result, Error: resp.Error}
			c.mu.Lock()
			delete(c.runs, id)
			c.mu.Unlock()
		}
	}

	return nil
}
