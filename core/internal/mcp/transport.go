// GeoWork Go Core - MCP Transport Layer (P2-2 §3.3)
//
// Transport defines the wire-level interface for talking to an MCP server.
// Two implementations ship today:
//
//   - StdioTransport: spawns the MCP server as a child process and pipes
//     JSON-RPC 2.0 messages over stdin/stdout. The default MCP deployment
//     pattern (e.g. npx @modelcontextprotocol/server-filesystem).
//   - HTTPTransport: talks to an HTTP+SSE MCP server. Suitable for remote
//     / containerized MCP servers where stdio is not an option.
//
// All transports speak JSON-RPC 2.0 — the request/response envelope is
// identical across transports, only the carriage differs.

package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Transport is the carriage layer for MCP JSON-RPC messages.
type Transport interface {
	// Connect establishes the transport (spawn process / open HTTP).
	Connect() error
	// Send writes a JSON-RPC request and returns the raw JSON response.
	Send(request []byte) ([]byte, error)
	// Close releases transport resources.
	Close() error
}

// JSONRPCMessage is the JSON-RPC 2.0 envelope used by MCP.
type JSONRPCMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

// JSONRPCError is the JSON-RPC 2.0 error object.
type JSONRPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *JSONRPCError) Error() string {
	return fmt.Sprintf("mcp rpc error %d: %s", e.Code, e.Message)
}

// StdioTransport spawns an MCP server as a child process and exchanges
// newline-delimited JSON-RPC over stdin/stdout.
type StdioTransport struct {
	cmd     string
	args    []string
	env     []string
	process *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	reader  *bufio.Reader
	mu      sync.Mutex
	log     *zap.Logger
}

// NewStdioTransport builds a transport that will spawn `cmd args...`
// on Connect. The optional env replaces the child's environment; if nil
// the child inherits the parent's.
func NewStdioTransport(cmd string, args []string, env []string, log *zap.Logger) *StdioTransport {
	return &StdioTransport{cmd: cmd, args: args, env: env, log: log}
}

func (t *StdioTransport) Connect() error {
	cmd := exec.Command(t.cmd, t.args...)
	if len(t.env) > 0 {
		cmd.Env = t.env
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("mcp stdio: stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("mcp stdio: stdout pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("mcp stdio: start %s: %w", t.cmd, err)
	}
	t.process = cmd
	t.stdin = stdin
	t.stdout = stdout
	t.reader = bufio.NewReader(stdout)
	if t.log != nil {
		t.log.Info("mcp stdio transport connected",
			zap.String("cmd", t.cmd),
			zap.Strings("args", t.args),
			zap.Int("pid", cmd.Process.Pid),
		)
	}
	return nil
}

func (t *StdioTransport) Send(request []byte) ([]byte, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.process == nil {
		return nil, fmt.Errorf("mcp stdio: not connected")
	}
	// MCP stdio framing: one JSON object per line.
	if _, err := t.stdin.Write(append(request, '\n')); err != nil {
		return nil, fmt.Errorf("mcp stdio: write: %w", err)
	}
	line, err := t.reader.ReadBytes('\n')
	if err != nil {
		return nil, fmt.Errorf("mcp stdio: read: %w", err)
	}
	return line, nil
}

func (t *StdioTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.process == nil {
		return nil
	}
	_ = t.stdin.Close()
	if t.process.Process != nil {
		_ = t.process.Process.Kill()
	}
	_ = t.process.Wait()
	t.process = nil
	return nil
}

// HTTPTransport talks to an HTTP+SSE MCP server. Each Send posts a
// JSON-RPC request to the configured endpoint and reads back the
// JSON-RPC response from the SSE stream (single shot here for simplicity).
type HTTPTransport struct {
	endpoint string
	client   *http.Client
	headers  map[string]string
	log      *zap.Logger
}

// NewHTTPTransport builds a transport targeting `endpoint` (e.g.
// "https://mcp.example.com/rpc").
func NewHTTPTransport(endpoint string, headers map[string]string, log *zap.Logger) *HTTPTransport {
	return &HTTPTransport{
		endpoint: endpoint,
		client:   &http.Client{Timeout: 60 * time.Second},
		headers:  headers,
		log:      log,
	}
}

func (t *HTTPTransport) Connect() error {
	if t.endpoint == "" {
		return fmt.Errorf("mcp http: empty endpoint")
	}
	if !strings.HasPrefix(t.endpoint, "http://") && !strings.HasPrefix(t.endpoint, "https://") {
		return fmt.Errorf("mcp http: endpoint must be http(s) URL, got %q", t.endpoint)
	}
	if t.log != nil {
		t.log.Info("mcp http transport ready", zap.String("endpoint", t.endpoint))
	}
	return nil
}

func (t *HTTPTransport) Send(request []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, t.endpoint, strings.NewReader(string(request)))
	if err != nil {
		return nil, fmt.Errorf("mcp http: new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	for k, v := range t.headers {
		req.Header.Set(k, v)
	}
	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mcp http: do: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("mcp http: read body: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("mcp http: status %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}

func (t *HTTPTransport) Close() error { return nil }
