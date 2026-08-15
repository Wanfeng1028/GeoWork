// GeoWork Go Core - WebSocket JSON-RPC 2.0 Protocol
//
// P1-3 §5.5.1 / doc/09-GeoWork-Communication-Protocol.md:
// SSE continues to carry one-way event stream (Agent → UI). WebSocket
// carries bidirectional control signaling (Agent ↔ UI): approval
// requests/responses, run abort, run status notifications. JSON-RPC 2.0
// gives us a standard request/response correlation via `id`, plus
// fire-and-forget Notifications (no `id`).
//
// P1 Methods (this phase):
//   approval/request  Server → Client  Request       Ask user to allow/deny a critical tool
//   approval/response Client → Server Response      User's allow/deny reply
//   run/abort          Client → Server Request       User aborts the run
//   run/status         Server → Client Notification  Push state change
//
// P2 will extend with terminal/* and browser/* methods (see protocol doc §4.2).

package api

import (
	"encoding/json"
	"fmt"
)

// JSON-RPC 2.0 standard error codes (per spec §5.1).
const (
	ErrCodeParseError     = -32700
	ErrCodeInvalidRequest = -32600
	ErrCodeMethodNotFound = -32601
	ErrCodeInvalidParams  = -32602
	ErrCodeInternal       = -32603
)

// P1 method names. Exported so handlers and tests can reference them
// without magic strings. P2 will add terminal/* and browser/* methods.
const (
	MethodApprovalRequest  = "approval/request"  // S→C
	MethodApprovalResponse = "approval/response" // C→S
	MethodRunAbort         = "run/abort"         // C→S
	MethodRunStatus        = "run/status"        // S→C
)

// JsonRpcRequest is a JSON-RPC 2.0 request (expects a response).
type JsonRpcRequest struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JsonRpcResponse is a JSON-RPC 2.0 response (replies to a request).
// Either Result or Error is set, never both.
type JsonRpcResponse struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JsonRpcError   `json:"error,omitempty"`
}

// JsonRpcNotification is a JSON-RPC 2.0 notification (no response expected).
type JsonRpcNotification struct {
	Jsonrpc string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JsonRpcError carries a JSON-RPC 2.0 error payload.
type JsonRpcError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// Error implements the error interface so JsonRpcError can be returned
// as a Go error while still marshalling cleanly to JSON-RPC.
func (e *JsonRpcError) Error() string {
	if e == nil {
		return "<nil>"
	}
	if e.Data != nil {
		return fmt.Sprintf("rpc error %d: %s (data=%s)", e.Code, e.Message, string(e.Data))
	}
	return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message)
}

// ApprovalRequestParams is the params payload of approval/request.
// Sent from server to client when a critical tool needs approval.
type ApprovalRequestParams struct {
	RunID      string `json:"runId"`
	ApprovalID string `json:"approvalId"`
	Tool       string `json:"tool"`
	Reason     string `json:"reason"`
	RiskLevel  string `json:"riskLevel"`
	Timeout    int    `json:"timeout"` // seconds
}

// ApprovalResponseResult is the result payload of approval/response.
// Sent from client to server to resolve an approval request.
// ApprovalID correlates back to the approval/request the server sent
// earlier (and to the SSE approval_request event's approvalId).
type ApprovalResponseResult struct {
	ApprovalID string `json:"approvalId"`
	Action     string `json:"action"` // "allow" | "deny"
	Comment    string `json:"comment,omitempty"`
}

// RunAbortParams is the params payload of run/abort.
type RunAbortParams struct {
	RunID  string `json:"runId"`
	Reason string `json:"reason,omitempty"`
}

// RunStatusParams is the params payload of run/status notifications.
type RunStatusParams struct {
	RunID string `json:"runId"`
	State string `json:"state"`
}

// ParseMessage decodes a raw JSON-RPC message into one of:
// *JsonRpcRequest (has ID + Method), *JsonRpcNotification (Method only),
// or *JsonRpcResponse (has ID + Result/Error). Returns an error if the
// payload is not valid JSON-RPC 2.0.
//
// The dispatcher uses this to decide whether to await a reply (Request),
// fire-and-forget (Notification), or correlate to a pending call (Response).
func ParseMessage(data []byte) (any, error) {
	// First peek at the envelope to discriminate by fields present.
	var peek struct {
		Jsonrpc string          `json:"jsonrpc"`
		ID      *string         `json:"id"`
		Method  string          `json:"method"`
		Result  json.RawMessage `json:"result"`
		Error   *JsonRpcError   `json:"error"`
	}
	if err := json.Unmarshal(data, &peek); err != nil {
		return nil, &JsonRpcError{Code: ErrCodeParseError, Message: "parse error: " + err.Error()}
	}
	if peek.Jsonrpc != "2.0" {
		return nil, &JsonRpcError{Code: ErrCodeInvalidRequest, Message: "jsonrpc must be \"2.0\""}
	}

	// Response: has id, no method, has result or error.
	if peek.ID != nil && peek.Method == "" && (len(peek.Result) > 0 || peek.Error != nil) {
		var resp JsonRpcResponse
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, &JsonRpcError{Code: ErrCodeParseError, Message: err.Error()}
		}
		return &resp, nil
	}

	// Request: has id + method.
	if peek.ID != nil && peek.Method != "" {
		var rq JsonRpcRequest
		if err := json.Unmarshal(data, &rq); err != nil {
			return nil, &JsonRpcError{Code: ErrCodeParseError, Message: err.Error()}
		}
		return &rq, nil
	}

	// Notification: has method, no id.
	if peek.ID == nil && peek.Method != "" {
		var n JsonRpcNotification
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, &JsonRpcError{Code: ErrCodeParseError, Message: err.Error()}
		}
		return &n, nil
	}

	return nil, &JsonRpcError{Code: ErrCodeInvalidRequest, Message: fmt.Sprintf("unrecognized JSON-RPC 2.0 message shape")}
}

// NewRequest constructs a JsonRpcRequest with the given id/method/params.
// params may be nil. Marshalling params is the caller's responsibility.
func NewRequest(id, method string, params json.RawMessage) JsonRpcRequest {
	return JsonRpcRequest{Jsonrpc: "2.0", ID: id, Method: method, Params: params}
}

// NewResponse constructs a JsonRpcResponse with a result.
func NewResponse(id string, result json.RawMessage) JsonRpcResponse {
	return JsonRpcResponse{Jsonrpc: "2.0", ID: id, Result: result}
}

// NewErrorResponse constructs a JsonRpcResponse with an error.
func NewErrorResponse(id string, code int, message string) JsonRpcResponse {
	return JsonRpcResponse{Jsonrpc: "2.0", ID: id, Error: &JsonRpcError{Code: code, Message: message}}
}

// NewNotification constructs a JsonRpcNotification.
func NewNotification(method string, params json.RawMessage) JsonRpcNotification {
	return JsonRpcNotification{Jsonrpc: "2.0", Method: method, Params: params}
}
