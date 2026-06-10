// GeoWork Go Core - Tool Registry Routes

package toolregistry

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	registry *Registry
}

func NewRoutes(registry *Registry) *Routes {
	return &Routes{registry: registry}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/tools", r.handleList)
	mux.HandleFunc("GET /api/tools/{name}", r.handleGet)
	mux.HandleFunc("POST /api/tools/execute", r.handleExecute)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	tools := r.registry.List()
	if tools == nil {
		tools = []Tool{}
	}
	result := make([]map[string]any, len(tools))
	for i, t := range tools {
		result[i] = map[string]any{
			"name":              t.Name(),
			"description":       t.Description(),
			"permission":        t.Permission(),
			"riskLevel":         t.RiskLevel(),
			"sandboxRequired":   t.SandboxRequired(),
			"streamingSupported": t.StreamingSupported(),
			"inputSchema":       t.InputSchema(),
			"outputSchema":      t.OutputSchema(),
		}
	}
	writeJSON(w, result)
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	name := req.PathValue("name")
	t, ok := r.registry.Get(name)
	if !ok {
		writeError(w, http.StatusNotFound, "tool not found")
		return
	}
	result := map[string]any{
		"name":               t.Name(),
		"description":        t.Description(),
		"permission":         t.Permission(),
		"riskLevel":          t.RiskLevel(),
		"sandboxRequired":    t.SandboxRequired(),
		"streamingSupported": t.StreamingSupported(),
		"inputSchema":        t.InputSchema(),
		"outputSchema":       t.OutputSchema(),
	}
	writeJSON(w, result)
}

func (r *Routes) handleExecute(w http.ResponseWriter, req *http.Request) {
	var reqBody struct {
		Name string                 `json:"name"`
		Args map[string]any         `json:"args"`
	}
	if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result, err := r.registry.Execute(req.Context(), reqBody.Name, reqBody.Args)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, result)
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
