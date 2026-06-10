// GeoWork Go Core - Automation Routes

package automation

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Routes struct {
	engine *Engine
}

func NewRoutes(engine *Engine) *Routes {
	return &Routes{engine: engine}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/automation/rules", r.handleList)
	mux.HandleFunc("GET /api/automation/rules/{id}", r.handleGet)
	mux.HandleFunc("POST /api/automation/rules", r.handleCreate)
	mux.HandleFunc("DELETE /api/automation/rules/{id}", r.handleDelete)
	mux.HandleFunc("PATCH /api/automation/rules/{id}/toggle", r.handleToggle)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	rules := r.engine.ListRules()
	if rules == nil {
		rules = []*Rule{}
	}
	writeJSON(w, rules)
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/automation/rules/")
	rule, err := r.engine.GetRule(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, rule)
}

func (r *Routes) handleCreate(w http.ResponseWriter, req *http.Request) {
	var rule Rule
	if err := json.NewDecoder(req.Body).Decode(&rule); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.engine.AddRule(req.Context(), &rule); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, rule)
}

func (r *Routes) handleDelete(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/automation/rules/")
	if err := r.engine.DeleteRule(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handleToggle(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/automation/rules/")
	var payload struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.engine.ToggleRule(id, payload.Enabled); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	rule, _ := r.engine.GetRule(id)
	writeJSON(w, rule)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
