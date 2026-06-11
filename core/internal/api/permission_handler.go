// GeoWork Go Core - Permission Handler

package api

import (
	"encoding/json"
	"net/http"

	"geowork/core/internal/permissions"

	gruntime "geowork/core/internal/runtime"
)

type permissionHandler struct {
	app      *gruntime.App
	permEng  *permissions.Engine
	bridge   *EventBridge
}

func newPermissionHandler(app *gruntime.App, permEng *permissions.Engine, bridge *EventBridge) *permissionHandler {
	return &permissionHandler{app: app, permEng: permEng, bridge: bridge}
}

func (h *permissionHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/permissions/requests", h.handlePending)
	mux.HandleFunc("GET /api/permissions/policies", h.handlePolicies)
	mux.HandleFunc("POST /api/permissions/resolve", h.handleResolve)
}

// GET /api/permissions/requests
func (h *permissionHandler) handlePending(w http.ResponseWriter, r *http.Request) {
	if h.permEng == nil {
		writeJSON(w, []permissions.PermissionRequest{})
		return
	}
	writeJSON(w, h.permEng.GetPendingRequests())
}

// GET /api/permissions/policies?taskId=xxx
func (h *permissionHandler) handlePolicies(w http.ResponseWriter, r *http.Request) {
	if h.permEng == nil {
		writeJSON(w, permissions.PermissionPolicy{
			DefaultLevel: permissions.Limited,
			Actions:      make(map[string]string),
			Remembered:   make(map[string]bool),
		})
		return
	}
	taskID := r.URL.Query().Get("taskId")
	policy := h.permEng.GetPolicies(taskID)
	if policy == nil {
		policy = &permissions.PermissionPolicy{
			DefaultLevel: permissions.Limited,
			Actions:      make(map[string]string),
			Remembered:   make(map[string]bool),
		}
	}
	writeJSON(w, policy)
}

// POST /api/permissions/resolve - 前端审批/拒绝权限请求
func (h *permissionHandler) handleResolve(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RequestID string `json:"requestId"`
		Decision  string `json:"decision"` // "approved" or "rejected"
		Reason    string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if h.permEng != nil {
		if in.Decision == "approved" {
			h.permEng.ApproveRequest(in.RequestID, in.Reason)
		} else {
			h.permEng.DenyRequest(in.RequestID, in.Reason)
		}
	}

	// Also attempt to resolve via the runtime app
	if h.app != nil {
		h.app.ResolveSecurityDecision(in.RequestID, in.Decision, in.Reason)
	}

	// Notify subscribers if this was a permission.required event
	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:    TaskCompleted, // permission resolved
			Message: "Permission " + in.Decision,
			Data: map[string]any{
				"requestId": in.RequestID,
				"decision":  in.Decision,
			},
		})
	}

	writeJSON(w, map[string]any{
		"status":     "resolved",
		"requestId":  in.RequestID,
		"decision":   in.Decision,
		"reason":     in.Reason,
	})
}
