// GeoWork Go Core - Permission Routes

package permissions

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type Routes struct {
	engine *Engine
}

func NewRoutes(engine *Engine) *Routes {
	return &Routes{engine: engine}
}

func (r *Routes) Register(mux http.HandlerFunc) {
	mux.HandleFunc("/api/permissions/requests", r.handleRequests)
	mux.HandleFunc("/api/permissions/policies", r.handlePolicies)
}

func (r *Routes) handleRequests(w http.ResponseWriter, req *http.Request) {
	parts := strings.Split(strings.TrimPrefix(req.URL.Path, "/api/permissions/requests"), "/")

	switch req.Method {
	case http.MethodGet:
		r.listRequests(w, req)
	case http.MethodPost:
		if len(parts) >= 2 && parts[0] != "" {
			if parts[1] == "approve" {
				r.approveRequest(w, req, parts[0])
			} else if parts[1] == "deny" {
				r.denyRequest(w, req, parts[0])
			}
		}
	}
}

func (r *Routes) listRequests(w http.ResponseWriter, req *http.Request) {
	requests := r.engine.GetPendingRequests()
	writeJSON(w, requests)
}

func (r *Routes) approveRequest(w http.ResponseWriter, req *http.Request, id string) {
	var input struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(req.Body).Decode(&input)
	if input.Reason == "" {
		input.Reason = "User approved"
	}
	if err := r.engine.ApproveRequest(id, input.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "approved"})
}

func (r *Routes) denyRequest(w http.ResponseWriter, req *http.Request, id string) {
	var input struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(req.Body).Decode(&input)
	if input.Reason == "" {
		input.Reason = "User denied"
	}
	if err := r.engine.DenyRequest(id, input.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "denied"})
}

func (r *Routes) handlePolicies(w http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case http.MethodGet:
		taskID := req.URL.Query().Get("taskId")
		policy := r.engine.GetPolicies(taskID)
		if policy == nil {
			policy = &PermissionPolicy{
				DefaultLevel: Limited,
				Actions:      make(map[string]string),
				Remembered:   make(map[string]bool),
			}
		}
		writeJSON(w, policy)
	case http.MethodPatch:
		var input struct {
			TaskID     string            `json:"taskId"`
			DefaultLevel string        `json:"defaultLevel"`
			Actions    map[string]string `json:"actions"`
		}
		json.NewDecoder(req.Body).Decode(&input)
		policy := &PermissionPolicy{
			DefaultLevel: PermissionLevel(input.DefaultLevel),
			Actions:      input.Actions,
			Remembered:   make(map[string]bool),
		}
		r.engine.UpdatePolicy(input.TaskID, policy)
		writeJSON(w, map[string]string{"status": "ok"})
	}
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
