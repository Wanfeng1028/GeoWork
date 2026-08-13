// GeoWork Go Core - WebSocket HTTP Handler
//
// P1-3 §5.5.1 / doc/09-GeoWork-Communication-Protocol.md §3.3:
// HTTP entry point that upgrades to a WebSocket connection and runs the
// message dispatch loop. The handler is bound to /api/ws in router.go.
//
// Connection lifecycle:
//  1. Client opens ws://host:port/api/ws?runId=run_abc
//  2. Server upgrades, creates a WsSession, registers it with the
//     manager (evicting any prior session for run_abc).
//  3. Server enters a read loop: each inbound JSON-RPC message is
//     dispatched to the session's typed channels (approval responses,
//     abort requests) or matched to a pending SendRequestAndWait call.
//  4. When the client disconnects (read returns or ctx cancels), the
//     session is unregistered. The orchestrator's waitForApproval may
//     still be blocked — it will hit its 5-minute timeout or the HTTP
//     fallback API can resolve the approval.
//
// Outbound messages (server → client) are sent via session.SendRequestAndWait
// or session.SendNotification from the orchestrator side, never from here.

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"go.uber.org/zap"

	"geowork/core/internal/idgen"
)

// ApprovalResolver resolves an approval request via the Governor.
// Wired up by router.go to call governor.ResolveApproval(reqID, decision, reason).
// decision is "approved" | "denied" | "timeout".
type ApprovalResolver func(approvalID string, decision string, reason string) error

// RunAborter aborts a run by runID. Wired up by router.go to call
// orchestrator.StopRun(runID). Returns an error if the run is unknown.
type RunAborter func(runID string, reason string) error

// WsHandler is the HTTP handler that upgrades to WebSocket and runs the
// per-connection read loop. It is bound to GET /api/ws in router.go.
//
// Dependencies are injected via the constructor so the handler can be
// wired in cmd/geowork-runtime/main.go alongside the SSE Routes:
//   - manager: the singleton WsSessionManager used by the orchestrator
//     to look up active sessions (e.g. for SendRequestAndWait approval).
type WsHandler struct {
	manager *WsSessionManager
	log     *zap.Logger

	// resolver is called when the client sends an approval/response.
	// If nil, approval responses are dropped (the HTTP API still works
	// as a fallback). Set via SetApprovalResolver in router.go.
	resolverMu sync.RWMutex
	resolver    ApprovalResolver
	aborter     RunAborter

	// seq is used to generate JSON-RPC request ids for server-initiated
	// requests (e.g. approval/request). Atomic for concurrent Send* calls.
	seq atomic.Uint64
}

// NewWsHandler constructs the WebSocket upgrade handler.
func NewWsHandler(manager *WsSessionManager, log *zap.Logger) *WsHandler {
	if log == nil {
		log = zap.NewNop()
	}
	return &WsHandler{manager: manager, log: log}
}

// Manager returns the underlying session manager. Exposed so the
// orchestrator (or its routes) can look up sessions by runID.
func (h *WsHandler) Manager() *WsSessionManager { return h.manager }

// SetApprovalResolver wires the callback invoked when a client sends
// an approval/response notification. router.go installs a closure
// that delegates to the orchestrator's Governor so the WebSocket path
// and the HTTP approval API share the same resolver.
func (h *WsHandler) SetApprovalResolver(fn ApprovalResolver) {
	h.resolverMu.Lock()
	defer h.resolverMu.Unlock()
	h.resolver = fn
}

// SetRunAborter wires the callback invoked when a client sends a
// run/abort request. router.go installs a closure that calls
// orchestrator.StopRun(runID).
func (h *WsHandler) SetRunAborter(fn RunAborter) {
	h.resolverMu.Lock()
	defer h.resolverMu.Unlock()
	h.aborter = fn
}

// resolverSafe returns the current resolver under a read lock so
// concurrent approval responses don't race with SetApprovalResolver.
func (h *WsHandler) resolverSafe() ApprovalResolver {
	h.resolverMu.RLock()
	defer h.resolverMu.RUnlock()
	return h.resolver
}

// aborterSafe returns the current aborter under a read lock.
func (h *WsHandler) aborterSafe() RunAborter {
	h.resolverMu.RLock()
	defer h.resolverMu.RUnlock()
	return h.aborter
}

// nextReqID returns a process-unique JSON-RPC request id.
// Prefixed with "ws_" so it's distinguishable from run IDs and
// approval IDs in logs.
func (h *WsHandler) nextReqID() string {
	n := h.seq.Add(1)
	return fmt.Sprintf("ws_%d_%s", n, idgen.NewShort())
}

// ServeHTTP upgrades to WebSocket and runs the read loop. The runID is
// taken from the `runId` query param. If absent, the connection is
// rejected with 400 — every session must be scoped to a run so the
// orchestrator can find it via GetSession(runID).
func (h *WsHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	runID := req.URL.Query().Get("runId")
	if runID == "" {
		http.Error(w, "missing runId query parameter", http.StatusBadRequest)
		return
	}

	// Accept the WebSocket upgrade. The Origin check is permissive in
	// dev (the desktop app loads from http://localhost); production
	// deployments should set CheckOrigin appropriately. We rely on the
	// loopback listener + OS-level isolation for security.
	conn, err := websocket.Accept(w, req, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // accept any origin (desktop app)
	})
	if err != nil {
		h.log.Warn("ws upgrade failed", zap.String("runId", runID), zap.Error(err))
		return
	}
	// Limit frame size to 1 MiB to prevent malicious clients from
	// blowing up memory. JSON-RPC messages are tiny.
	conn.SetReadLimit(1 << 20)

	session := NewWsSession(conn, runID, h.log)
	h.manager.Register(session)
	defer h.manager.Unregister(runID)

	// Detach the underlying connection from the HTTP server's write
	// deadline — we'll manage reads/writes ourselves.
	ctx := req.Context()

	// Read loop. Terminates when the client disconnects, the context
	// cancels, or a fatal protocol error occurs.
	for {
		msgType, payload, err := conn.Read(ctx)
		if err != nil {
			// Normal close codes (1000, 1001) are expected on shutdown.
			h.log.Debug("ws read closed",
				zap.String("runId", runID),
				zap.Error(err))
			return
		}
		if msgType != websocket.MessageText {
			// Ignore binary frames — protocol is text-only JSON.
			continue
		}

		// Parse and dispatch. ParseMessage discriminates Request vs
		// Notification vs Response so we can route to the right path.
		msg, perr := ParseMessage(payload)
		if perr != nil {
			// Parse error: per JSON-RPC 2.0 §5.1, respond with -32700.
			// Parse errors have no id (we couldn't parse one), so we
			// send a notification-shaped error. The client should log it.
			errNotif, _ := json.Marshal(map[string]any{
				"jsonrpc": "2.0",
				"error":   perr,
			})
			writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			_ = conn.Write(writeCtx, websocket.MessageText, errNotif)
			cancel()
			continue
		}

		switch m := msg.(type) {
		case *JsonRpcRequest:
			h.handleClientRequest(ctx, session, m)
		case *JsonRpcNotification:
			h.handleClientNotification(session, m)
		case *JsonRpcResponse:
			session.dispatchResponse(m)
		default:
			h.log.Warn("ws: unrecognized message type")
		}
	}
}

// handleClientRequest processes a JSON-RPC request from the client.
// P1 supports run/abort (a Request expecting a response). Other
// request methods return method-not-found (-32601).
func (h *WsHandler) handleClientRequest(ctx context.Context, session *WsSession, req *JsonRpcRequest) {
	switch req.Method {
	case MethodRunAbort:
		// Parse params (runId, reason). If runId is missing or doesn't
		// match the session's run, we still accept — the orchestrator's
		// StopRun is idempotent.
		var params RunAbortParams
		if len(req.Params) > 0 {
			_ = json.Unmarshal(req.Params, &params)
		}
		if params.RunID == "" {
			params.RunID = session.RunID()
		}
		// Invoke the registered aborter (router.go wires this to
		// orchestrator.StopRun). If no aborter is wired, just ack.
		if aborter := h.aborterSafe(); aborter != nil {
			if err := aborter(params.RunID, params.Reason); err != nil {
				errResp := NewErrorResponse(req.ID, ErrCodeInternal, err.Error())
				_ = h.writeResponse(ctx, session, errResp)
				return
			}
		}

		// Ack the abort.
		result, _ := json.Marshal(map[string]string{"status": "aborting", "runId": params.RunID})
		resp := NewResponse(req.ID, result)
		_ = h.writeResponse(ctx, session, resp)

	default:
		// Method not found. JSON-RPC 2.0 §5.1.1 requires an error response.
		errResp := NewErrorResponse(req.ID, ErrCodeMethodNotFound,
			"method not found: "+req.Method)
		_ = h.writeResponse(ctx, session, errResp)
	}
}

// handleClientNotification processes a JSON-RPC notification (no reply expected).
// P1 supports approval/response (sent as a notification — the original
// approval/request was the request that started the exchange).
func (h *WsHandler) handleClientNotification(session *WsSession, notif *JsonRpcNotification) {
	switch notif.Method {
	case MethodApprovalResponse:
		// The client is replying to an approval/request we sent earlier.
		// Parse the result, then invoke the resolver (which calls
		// governor.ResolveApproval). The governor writes to the
		// approval request's DecisionCh, which the orchestrator's
		// waitForApproval is blocked on — so the run unblocks here.
		var result ApprovalResponseResult
		if len(notif.Params) > 0 {
			if err := json.Unmarshal(notif.Params, &result); err != nil {
				h.log.Warn("ws: invalid approval/response params", zap.Error(err))
				return
			}
		}
		// Also push to the session's approval channel so any
		// SendRequestAndWait caller unblocks (defensive — both paths
		// should end up resolving the governor, but this keeps the
		// session API honest).
		session.handleApprovalResponse(result)

		if resolver := h.resolverSafe(); resolver != nil {
			// Map UI "allow"/"deny" to governor decision strings.
			decision := "denied"
			reason := result.Comment
			switch result.Action {
			case "allow":
				decision = "approved"
				if reason == "" {
					reason = "user approved via websocket"
				}
			case "deny":
				decision = "denied"
				if reason == "" {
					reason = "user denied via websocket"
				}
			default:
				h.log.Warn("ws: unknown approval action", zap.String("action", result.Action))
				return
			}
			if err := resolver(result.ApprovalID, decision, reason); err != nil {
				h.log.Warn("ws: approval resolver failed",
					zap.String("approvalId", result.ApprovalID),
					zap.Error(err))
			}
		} else {
			h.log.Warn("ws: approval/response received but no resolver wired; falling back to HTTP")
		}

	case MethodRunAbort:
		// Some clients may send run/abort as a notification instead of
		// a request. Handle both shapes.
		var params RunAbortParams
		if len(notif.Params) > 0 {
			_ = json.Unmarshal(notif.Params, &params)
		}
		if params.RunID == "" {
			params.RunID = session.RunID()
		}
		if aborter := h.aborterSafe(); aborter != nil {
			if err := aborter(params.RunID, params.Reason); err != nil {
				h.log.Warn("ws: run abort failed",
					zap.String("runId", params.RunID),
					zap.Error(err))
			}
		}

	default:
		// Per JSON-RPC 2.0, unknown notifications are silently ignored.
		h.log.Debug("ws: unknown notification ignored",
			zap.String("method", notif.Method))
	}
}

// writeResponse sends a JSON-RPC response to the client.
// A 10s timeout wraps the Write so a slow/stuck client cannot block
// the read loop indefinitely.
func (h *WsHandler) writeResponse(ctx context.Context, session *WsSession, resp JsonRpcResponse) error {
	payload, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return session.conn.Write(writeCtx, websocket.MessageText, payload)
}

// SendApprovalRequest is called by the orchestrator to ask the UI to
// approve a critical tool call. It constructs an approval/request
// JSON-RPC message and blocks on SendRequestAndWait for the reply.
// If the WebSocket session for runID is missing, returns an error so
// the caller can fall back to HTTP / timeout.
//
// The orchestrator's waitForApproval calls this first (when a ws
// session exists); if it fails or times out, the existing governor
// HTTP path remains as the fallback.
func (h *WsHandler) SendApprovalRequest(ctx context.Context, runID string, params ApprovalRequestParams, timeoutSeconds int) (*ApprovalResponseResult, error) {
	session := h.manager.GetSession(runID)
	if session == nil {
		return nil, errNoWsSession
	}
	paramsJSON, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	reqID := h.nextReqID()
	req := NewRequest(reqID, MethodApprovalRequest, paramsJSON)
	timeout := time.Duration(timeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Minute
	}
	resp, err := session.SendRequestAndWait(ctx, req, timeout)
	if err != nil {
		return nil, err
	}
	var result ApprovalResponseResult
	if len(resp.Result) > 0 {
		if err := json.Unmarshal(resp.Result, &result); err != nil {
			return nil, fmt.Errorf("unmarshal approval response: %w", err)
		}
	}
	return &result, nil
}

// errNoWsSession is returned by SendApprovalRequest when no WebSocket
// session is active for the requested run. The caller should fall back
// to the HTTP approval path (governor.ResolveApproval) or the timeout.
var errNoWsSession = fmt.Errorf("no websocket session for run")
