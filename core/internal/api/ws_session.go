// GeoWork Go Core - WebSocket Session Manager
//
// P1-3 §5.5.1 / doc/09-GeoWork-Communication-Protocol.md §7:
// WsSession wraps one WebSocket connection scoped to a runID. It
// multiplexes incoming JSON-RPC messages onto typed handler channels
// (approval responses, run abort, etc.) and provides SendRequestAndWait
// for the orchestrator to make blocking approval calls to the UI.
//
// WsSessionManager tracks active sessions by runID so the orchestrator
// can call GetSession(runID) when it needs to ask the user a question.
// When a WebSocket drops, the session is removed from the manager —
// the orchestrator's HTTP approval fallback still works (or the
// 5-minute timeout fires).

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/coder/websocket"

	"go.uber.org/zap"
)

// WsSession wraps one WebSocket connection scoped to a runID.
// All methods are safe for concurrent use.
type WsSession struct {
	conn  *websocket.Conn
	runID string
	log   *zap.Logger

	// send serializes writes to the underlying connection (the
	// websocket.Conn writer is not safe for concurrent use). Each
	// Send* call locks this mutex, writes, and unlocks.
	sendMu sync.Mutex

	// pending maps request id -> waiting channel. SendRequestAndWait
	// registers here; the read loop dispatches responses here.
	pendingMu sync.Mutex
	pending   map[string]chan JsonRpcResponse

	// handlers for client-initiated messages. Registered via On*.
	approvalRespCh chan ApprovalResponseResult
	abortCh        chan RunAbortParams

	// done is closed when the read loop exits (connection drop,
	// context cancel, or Close()). Safe to select on for teardown.
	doneOnce sync.Once
	done     chan struct{}
}

// NewWsSession constructs a session for the given connection and runID.
func NewWsSession(conn *websocket.Conn, runID string, log *zap.Logger) *WsSession {
	if log == nil {
		log = zap.NewNop()
	}
	return &WsSession{
		conn:           conn,
		runID:          runID,
		log:            log,
		pending:        make(map[string]chan JsonRpcResponse),
		approvalRespCh: make(chan ApprovalResponseResult, 1),
		abortCh:        make(chan RunAbortParams, 1),
		done:           make(chan struct{}),
	}
}

// RunID returns the run this session is bound to.
func (s *WsSession) RunID() string { return s.runID }

// Done returns a channel that's closed when the session ends.
// Callers can select on this to detect disconnects.
func (s *WsSession) Done() <-chan struct{} { return s.done }

// ApprovalResponses returns the channel of client-sent approval
// responses. The orchestrator can listen on this to resolve a
// pending approval. Each response is delivered once (buffered size 1
// per the typical one-outstanding-approval-per-run invariant).
func (s *WsSession) ApprovalResponses() <-chan ApprovalResponseResult { return s.approvalRespCh }

// Aborts returns the channel of client-sent run abort requests.
func (s *WsSession) Aborts() <-chan RunAbortParams { return s.abortCh }

// SendRequestAndWait sends a JSON-RPC request over the WebSocket and
// blocks until a matching response arrives, the timeout fires, or the
// session ends. Returns the parsed response or an error.
//
// Used by the orchestrator's approval flow: it calls SendRequestAndWait
// with method=approval/request and blocks until the user replies
// (approval/response) or the 5-minute timeout fires. If the session
// drops (Done closed), the call returns immediately with an error so
// the orchestrator can fall back to HTTP or deny on timeout.
func (s *WsSession) SendRequestAndWait(ctx context.Context, req JsonRpcRequest, timeout time.Duration) (*JsonRpcResponse, error) {
	// Register a pending response channel before sending so a fast
	// client reply can't race past us.
	respCh := make(chan JsonRpcResponse, 1)
	s.pendingMu.Lock()
	s.pending[req.ID] = respCh
	s.pendingMu.Unlock()
	defer func() {
		s.pendingMu.Lock()
		delete(s.pending, req.ID)
		s.pendingMu.Unlock()
	}()

	// Send the request.
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	if err := s.writeRaw(payload); err != nil {
		return nil, fmt.Errorf("write request: %w", err)
	}

	// Wait for reply, timeout, context cancel, or session close.
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-s.Done():
		return nil, fmt.Errorf("session closed while waiting for response %s", req.ID)
	case <-timer.C:
		return nil, fmt.Errorf("request %s timed out after %s", req.ID, timeout)
	case resp := <-respCh:
		if resp.Error != nil {
			return &resp, fmt.Errorf("rpc error %d: %s", resp.Error.Code, resp.Error.Message)
		}
		return &resp, nil
	}
}

// SendNotification sends a JSON-RPC notification (no response expected).
// Used for run/status pushes from server to client.
func (s *WsSession) SendNotification(method string, params any) error {
	notif := NewNotification(method, nil)
	if params != nil {
		data, err := json.Marshal(params)
		if err != nil {
			return fmt.Errorf("marshal params: %w", err)
		}
		notif.Params = data
	}
	payload, err := json.Marshal(notif)
	if err != nil {
		return fmt.Errorf("marshal notification: %w", err)
	}
	return s.writeRaw(payload)
}

// dispatchResponse routes a response to its waiting SendRequestAndWait caller.
func (s *WsSession) dispatchResponse(resp *JsonRpcResponse) {
	s.pendingMu.Lock()
	ch, ok := s.pending[resp.ID]
	s.pendingMu.Unlock()
	if !ok {
		s.log.Warn("ws: received response with no pending request",
			zap.String("id", resp.ID))
		return
	}
	select {
	case ch <- *resp:
	default:
		// Channel has buffer 1; if a second response arrives for the
		// same id (protocol violation), drop it.
	}
}

// handleApprovalResponse routes an approval/response result to the
// approval channel so the orchestrator can resolve the pending request.
func (s *WsSession) handleApprovalResponse(result ApprovalResponseResult) {
	select {
	case s.approvalRespCh <- result:
	default:
		// Buffer is 1; if the client sends duplicate responses, drop.
	}
}

// handleAbort routes a run/abort request to the abort channel.
func (s *WsSession) handleAbort(params RunAbortParams) {
	select {
	case s.abortCh <- params:
	default:
	}
}

// writeRaw serializes writes to the underlying connection.
func (s *WsSession) writeRaw(payload []byte) error {
	s.sendMu.Lock()
	defer s.sendMu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return s.conn.Write(ctx, websocket.MessageText, payload)
}

// close marks the session as done and closes the underlying connection.
// Idempotent — only the first call closes the done channel.
func (s *WsSession) close() {
	s.doneOnce.Do(func() {
		close(s.done)
	})
}

// WsSessionManager tracks active WebSocket sessions by runID.
// At most one session per run is allowed — a new connection for the
// same runID evicts the previous one (the old session's Done channel
// fires so its read loop exits).
type WsSessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*WsSession
	log      *zap.Logger
}

// NewWsSessionManager constructs an empty manager.
func NewWsSessionManager(log *zap.Logger) *WsSessionManager {
	if log == nil {
		log = zap.NewNop()
	}
	return &WsSessionManager{
		sessions: make(map[string]*WsSession),
		log:      log,
	}
}

// Register associates session with session.runID, evicting any prior
// session for the same run. The evicted session's Done channel is closed
// so its read loop exits and the connection is released.
func (m *WsSessionManager) Register(session *WsSession) *WsSession {
	m.mu.Lock()
	defer m.mu.Unlock()
	if old, ok := m.sessions[session.runID]; ok {
		old.close()
	}
	m.sessions[session.runID] = session
	m.log.Info("ws session registered", zap.String("runId", session.runID))
	return session
}

// Unregister removes a session by runID. No-op if the session is no
// longer the registered one (i.e. it was already evicted by a newer
// connection for the same run).
func (m *WsSessionManager) Unregister(runID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if sess, ok := m.sessions[runID]; ok {
		sess.close()
		delete(m.sessions, runID)
		m.log.Info("ws session unregistered", zap.String("runId", runID))
	}
}

// GetSession returns the active session for runID, or nil if no client
// is currently connected for that run.
func (m *WsSessionManager) GetSession(runID string) *WsSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[runID]
}

// HasSession reports whether a WebSocket session is active for runID.
// The orchestrator can use this to decide whether to use the WebSocket
// approval path or fall back to the HTTP approval API.
func (m *WsSessionManager) HasSession(runID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.sessions[runID]
	return ok
}

// Count returns the number of active sessions. Used by /api/health.
func (m *WsSessionManager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}
