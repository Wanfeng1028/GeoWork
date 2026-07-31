// GeoWork Go Core - Conversation HTTP Handler

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"geowork/core/internal/aiagent"
	"geowork/core/internal/conversation"

	"go.uber.org/zap"
)

// ConversationHandler serves conversation + message endpoints and bridges
// orchestrator run events to per-conversation SSE streams.
type ConversationHandler struct {
	store        *conversation.Store
	orchestrator *aiagent.Orchestrator
	bridge       *EventBridge
	log          *zap.Logger
}

// NewConversationHandler creates a new ConversationHandler.
func NewConversationHandler(store *conversation.Store, orchestrator *aiagent.Orchestrator, bridge *EventBridge, log *zap.Logger) *ConversationHandler {
	return &ConversationHandler{store: store, orchestrator: orchestrator, bridge: bridge, log: log}
}

// RegisterRoutes attaches conversation routes to the given mux.
func (h *ConversationHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/conversations", h.handleList)
	mux.HandleFunc("POST /api/conversations", h.handleCreate)
	mux.HandleFunc("GET /api/conversations/{id}", h.handleGet)
	mux.HandleFunc("DELETE /api/conversations/{id}", h.handleDelete)
	mux.HandleFunc("GET /api/conversations/{id}/messages", h.handleListMessages)
	mux.HandleFunc("POST /api/conversations/{id}/messages", h.handlePostMessage)
	mux.HandleFunc("GET /api/conversations/{id}/events", h.handleStreamEvents)
}

// GET /api/conversations?workspaceId=&before=&limit=
func (h *ConversationHandler) handleList(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.URL.Query().Get("workspaceId")
	limit := atoiDefault(r.URL.Query().Get("limit"), 50)

	var before time.Time
	if bs := r.URL.Query().Get("before"); bs != "" {
		before, _ = time.Parse(time.RFC3339, bs)
	}

	convs, err := h.store.ListConversations(r.Context(), workspaceID, before, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if convs == nil {
		convs = []conversation.Conversation{}
	}
	writeJSON(w, map[string]any{"total": len(convs), "conversations": convs})
}

// POST /api/conversations
func (h *ConversationHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		WorkspaceID string `json:"workspaceId"`
		Title       string `json:"title"`
		Mode        string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := &conversation.Conversation{
		WorkspaceID: in.WorkspaceID,
		Title:       in.Title,
		Mode:        in.Mode,
		Status:      "active",
	}
	if err := h.store.CreateConversation(r.Context(), c); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, c)
}

// GET /api/conversations/{id}
func (h *ConversationHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := h.store.GetConversation(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}
	writeJSON(w, c)
}

// DELETE /api/conversations/{id}
func (h *ConversationHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.store.DeleteConversation(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

// GET /api/conversations/{id}/messages?before=&limit=
func (h *ConversationHandler) handleListMessages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	limit := atoiDefault(r.URL.Query().Get("limit"), 100)

	var before time.Time
	if bs := r.URL.Query().Get("before"); bs != "" {
		before, _ = time.Parse(time.RFC3339, bs)
	}

	msgs, err := h.store.ListMessages(r.Context(), id, before, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if msgs == nil {
		msgs = []conversation.Message{}
	}
	writeJSON(w, map[string]any{"total": len(msgs), "messages": msgs})
}

// POST /api/conversations/{id}/messages — append user message and trigger orchestrator.
func (h *ConversationHandler) handlePostMessage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var in struct {
		Content string `json:"content"`
		Mode    string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if in.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	// Look up conversation to inherit mode if not provided.
	c, err := h.store.GetConversation(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}
	mode := in.Mode
	if mode == "" {
		mode = c.Mode
	}

	// Persist the user message.
	userMsg := &conversation.Message{
		ConversationID: id,
		Role:           "user",
		Content:        in.Content,
	}
	if err := h.store.AppendMessage(r.Context(), userMsg); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Trigger the orchestrator if available; otherwise respond gracefully.
	if h.orchestrator == nil {
		writeJSON(w, map[string]any{
			"message": userMsg,
			"error":   "orchestrator unavailable",
		})
		return
	}

	run, err := h.orchestrator.StartRun(r.Context(), mode, in.Content)
	if err != nil {
		h.log.Warn("orchestrator start run failed", zap.String("conversationId", id), zap.Error(err))
		writeJSON(w, map[string]any{
			"message": userMsg,
			"error":   err.Error(),
		})
		return
	}

	// Bridge run events to the conversation's SSE channel: subscribe to the
	// run's events and re-publish them under the conversation ID so clients
	// streaming /api/conversations/{id}/events receive them.
	h.forwardRunEvents(run.ID, id)

	writeJSON(w, map[string]any{
		"runId":   run.ID,
		"message": userMsg,
		"mode":    mode,
	})
}

// handleStreamEvents streams conversation events via SSE.
// GET /api/conversations/{id}/events
func (h *ConversationHandler) handleStreamEvents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sse := NewSSEWriter(w)

	ch := h.bridge.Subscribe(id)
	defer h.bridge.Unsubscribe(id, ch)

	done := r.Context().Done()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case evt, ok := <-ch:
			if !ok {
				return
			}
			sse.Send(evt.Type, evt)
		case <-ticker.C:
			sse.Ping()
		}
	}
}

// forwardRunEvents subscribes to a run's EventBridge channel and re-publishes
// each event under the conversation ID, so conversation SSE subscribers receive
// run progress. On terminal events (done/error) it persists an assistant
// message summary so the conversation history survives page reloads.
func (h *ConversationHandler) forwardRunEvents(runID, conversationID string) {
	ch := h.bridge.Subscribe(runID)
	go func() {
		defer h.bridge.Unsubscribe(runID, ch)
		for evt := range ch {
			evt.TaskID = conversationID
			h.bridge.Publish(evt)
			// Terminal events: persist assistant summary, then stop forwarding.
			switch string(evt.Type) {
			case "done":
				h.persistAssistantSummary(conversationID, runID, false)
				return
			case "error":
				h.persistAssistantSummary(conversationID, runID, true)
				return
			}
		}
	}()
}

// persistAssistantSummary stores a summary of the orchestrator run as an
// assistant message so the conversation history remains complete after page
// reloads. It fetches the run's plan to build a readable step summary.
func (h *ConversationHandler) persistAssistantSummary(conversationID, runID string, failed bool) {
	content := "执行完成"
	if failed {
		content = "执行失败"
	}

	// Enrich with run plan summary if available.
	if h.orchestrator != nil {
		if run, ok := h.orchestrator.GetRun(runID); ok && len(run.Plan) > 0 {
			var steps []string
			for _, s := range run.Plan {
				status := s.Status
				if status == "" {
					status = "pending"
				}
				steps = append(steps, fmt.Sprintf("- [%s] %s", status, s.Title))
			}
			label := "执行完成"
			if failed {
				label = "执行失败"
			}
			content = fmt.Sprintf("%s，共 %d 个步骤：\n%s", label, len(steps), strings.Join(steps, "\n"))
		}
	}

	msg := &conversation.Message{
		ConversationID: conversationID,
		Role:           "assistant",
		Content:        content,
		Metadata:       fmt.Sprintf(`{"runId":"%s"}`, runID),
	}
	if err := h.store.AppendMessage(context.Background(), msg); err != nil {
		h.log.Warn("failed to persist assistant message",
			zap.String("conversationId", conversationID),
			zap.String("runId", runID),
			zap.Error(err),
		)
	}
}

// writeError / atoiDefault are local helpers for the conversation handler.
func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func atoiDefault(s string, def int) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return def
		}
		n = n*10 + int(c-'0')
	}
	if s == "" {
		return def
	}
	return n
}
