// GeoWork Go Core - Diff Handler

package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"sync"

	gruntime "geowork/core/internal/runtime"
)

type diffEntry struct {
	ID        string `json:"id"`
	TaskID    string `json:"taskId"`
	Path      string `json:"path"`
	Content   string `json:"content"`
	Preview   string `json:"preview,omitempty"`
	CreatedAt string `json:"createdAt"`
	Accepted  bool   `json:"accepted"`
}

type diffHandler struct {
	app    *gruntime.App
	bridge *EventBridge
	mu     sync.RWMutex
	diffs  map[string]*diffEntry
}

func newDiffHandler(app *gruntime.App, bridge *EventBridge) *diffHandler {
	return &diffHandler{
		app:    app,
		bridge: bridge,
		diffs:  make(map[string]*diffEntry),
	}
}

func (h *diffHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/diffs", h.handleList)
	mux.HandleFunc("GET /api/diffs/{id}", h.handleGet)
	mux.HandleFunc("POST /api/diffs/{id}/accept", h.handleAccept)
	mux.HandleFunc("POST /api/diffs/{id}/reject", h.handleReject)
	mux.HandleFunc("POST /api/diffs/accept-all", h.handleAcceptAll)
	mux.HandleFunc("POST /api/diffs/reject-all", h.handleRejectAll)
	mux.HandleFunc("POST /api/security/diff", h.handleCreateDiff)
	mux.HandleFunc("POST /api/security/rollback", h.handleRollback)
}

// POST /api/security/diff
func (h *diffHandler) handleCreateDiff(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)

	diff, err := h.app.FileDiff(in.Path, in.Content)
	writeResult(w, diff, err)
	if err != nil {
		return
	}

	id := "diff_" + hashString(in.Path)
	h.mu.Lock()
	h.diffs[id] = &diffEntry{
		ID:        id,
		Path:      in.Path,
		Content:   in.Content,
		CreatedAt: nowRFC3339(),
	}
	h.mu.Unlock()

	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:    DiffCreated,
			Message: "Diff created for: " + in.Path,
			Data: map[string]any{
				"id":      id,
				"path":    in.Path,
				"preview": truncateString(in.Content, 500),
			},
		})
	}
}

// POST /api/security/rollback
func (h *diffHandler) handleRollback(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Path string `json:"path"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeResult(w, map[string]string{"status": "rolled_back"}, h.app.RollbackFile(in.Path))
}

// GET /api/diffs
func (h *diffHandler) handleList(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	result := make([]*diffEntry, 0, len(h.diffs))
	for _, d := range h.diffs {
		result = append(result, d)
	}
	h.mu.RUnlock()
	writeJSON(w, result)
}

// GET /api/diffs/{id}
func (h *diffHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.mu.RLock()
	d, ok := h.diffs[id]
	h.mu.RUnlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, d)
}

// POST /api/diffs/{id}/accept
func (h *diffHandler) handleAccept(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.mu.Lock()
	d, ok := h.diffs[id]
	h.mu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}

	if err := os.WriteFile(d.Path, []byte(d.Content), 0644); err != nil {
		http.Error(w, "failed to apply diff: "+err.Error(), http.StatusInternalServerError)
		return
	}

	h.mu.Lock()
	d.Accepted = true
	h.mu.Unlock()

	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:    StepDelta,
			Message: "Diff accepted: " + d.Path,
			Data: map[string]any{
				"id":     id,
				"path":   d.Path,
				"action": "accept",
			},
		})
	}

	writeJSON(w, map[string]any{
		"status": "accepted",
		"id":     id,
		"path":   d.Path,
	})
}

// POST /api/diffs/{id}/reject
func (h *diffHandler) handleReject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.mu.Lock()
	d, ok := h.diffs[id]
	if ok {
		d.Accepted = false
	}
	h.mu.Unlock()

	if !ok {
		http.NotFound(w, r)
		return
	}

	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:    StepDelta,
			Message: "Diff rejected: " + d.Path,
			Data: map[string]any{
				"id":     id,
				"path":   d.Path,
				"action": "reject",
			},
		})
	}

	writeJSON(w, map[string]any{
		"status": "rejected",
		"id":     id,
		"path":   d.Path,
	})
}

// POST /api/diffs/accept-all
func (h *diffHandler) handleAcceptAll(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	count := 0
	for _, d := range h.diffs {
		if !d.Accepted {
			if err := os.WriteFile(d.Path, []byte(d.Content), 0644); err != nil {
				continue
			}
			d.Accepted = true
			count++
		}
	}
	h.mu.Unlock()

	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:    StepDelta,
			Message: "All diffs accepted",
			Data: map[string]any{
				"action": "accept-all",
				"count":  count,
			},
		})
	}

	writeJSON(w, map[string]any{
		"status": "accepted_all",
		"count":  count,
	})
}

// POST /api/diffs/reject-all
func (h *diffHandler) handleRejectAll(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	count := 0
	for _, d := range h.diffs {
		if d.Accepted {
			d.Accepted = false
			count++
		}
	}
	h.mu.Unlock()

	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:    StepDelta,
			Message: "All diffs rejected",
			Data: map[string]any{
				"action": "reject-all",
				"count":  count,
			},
		})
	}

	writeJSON(w, map[string]any{
		"status": "rejected_all",
		"count":  count,
	})
}

func hashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
