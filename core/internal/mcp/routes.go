// GeoWork Go Core - MCP Routes

package mcp

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	manager *Manager
}

func NewRoutes(manager *Manager) *Routes {
	return &Routes{manager: manager}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/mcp", r.handleList)
	mux.HandleFunc("GET /api/mcp/{id}", r.handleGet)
	mux.HandleFunc("POST /api/mcp", r.handleCreate)
	mux.HandleFunc("DELETE /api/mcp/{id}", r.handleDelete)
	mux.HandleFunc("POST /api/mcp/{id}/connect", r.handleConnect)
	mux.HandleFunc("POST /api/mcp/{id}/disconnect", r.handleDisconnect)
	mux.HandleFunc("GET /api/mcp/{id}/tools", r.handleListTools)
	mux.HandleFunc("POST /api/mcp/{id}/tools/call", r.handleCallTool)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.manager.ListConfigs())
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	configs := r.manager.ListConfigs()
	for _, c := range configs {
		if c.ID == id {
			writeJSON(w, c)
			return
		}
	}
	writeError(w, http.StatusNotFound, "server not found")
}

func (r *Routes) handleCreate(w http.ResponseWriter, req *http.Request) {
	var cfg ServerConfig
	if err := json.NewDecoder(req.Body).Decode(&cfg); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.manager.AddConfig(&cfg); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, cfg)
}

func (r *Routes) handleDelete(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.manager.RemoveConfig(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handleConnect(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.manager.Connect(req.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "connected"})
}

func (r *Routes) handleDisconnect(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.manager.Disconnect(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "disconnected"})
}

func (r *Routes) handleListTools(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	tools, err := r.manager.ListTools(req.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, tools)
}

func (r *Routes) handleCallTool(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	var in struct {
		Name string                 `json:"name"`
		Args map[string]any         `json:"args"`
	}
	if err := json.NewDecoder(req.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	resp, err := r.manager.CallTool(req.Context(), id, in.Name, in.Args)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, resp)
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
