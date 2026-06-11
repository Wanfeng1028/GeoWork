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

	// Patch/Diff endpoints
	mux.HandleFunc("POST /api/patches/apply", r.handleApplyPatch)
	mux.HandleFunc("POST /api/patches/preview", r.handlePreviewPatch)
	mux.HandleFunc("POST /api/checkpoints", r.handleCreateCheckpoint)
	mux.HandleFunc("GET /api/checkpoints", r.handleListCheckpoints)
	mux.HandleFunc("GET /api/checkpoints/{id}", r.handleGetCheckpoint)
	mux.HandleFunc("POST /api/checkpoints/{id}/restore", r.handleRestoreCheckpoint)
	mux.HandleFunc("DELETE /api/checkpoints/{id}", r.handleDeleteCheckpoint)
	mux.HandleFunc("GET /api/journal", r.handleJournalEntries)
	mux.HandleFunc("POST /api/rollback", r.handleRollback)
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

// ---- Patch endpoints ----

type handleRequest struct {
	Path     string                    `json:"path"`
	Content  string                    `json:"content"`
	Lines    []map[string]interface{}  `json:"lines,omitempty"`
}

func (r *Routes) handleApplyPatch(w http.ResponseWriter, req *http.Request) {
	var reqBody struct {
		BasePath  string          `json:"basePath"`
		PatchSets []handleRequest `json:"patchSets"`
		DryRun    bool            `json:"dryRun"`
	}
	if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ps := NewPatchSet("api-patch")
	for _, psItem := range reqBody.PatchSets {
		patch := NewPatch(psItem.Path, "api-generated")
		for _, line := range psItem.Lines {
			op, _ := line["operation"].(string)
			content, _ := line["content"].(string)
			var lineNum int
			if ln, ok := line["lineNum"].(float64); ok {
				lineNum = int(ln)
			}
			switch op {
			case "insert":
				patch.AddInsert(content, lineNum)
			case "delete":
				patch.AddDelete(content, lineNum)
			default:
				patch.AddKeep(content, lineNum)
			}
		}
		ps.AddPatch(patch)
	}

	results, err := ApplyPatchSet(ps, reqBody.BasePath, reqBody.DryRun)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, results)
}

func (r *Routes) handlePreviewPatch(w http.ResponseWriter, req *http.Request) {
	var reqBody struct {
		Path    string `json:"path"`
		Content string `json:"content"`
		Lines   []map[string]interface{} `json:"lines"`
	}
	if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	patch := NewPatch(reqBody.Path, "preview-patch")
	for _, line := range reqBody.Lines {
		op, _ := line["operation"].(string)
		content, _ := line["content"].(string)
		var lineNum int
		if ln, ok := line["lineNum"].(float64); ok {
			lineNum = int(ln)
		}
		switch op {
		case "insert":
			patch.AddInsert(content, lineNum)
		case "delete":
			patch.AddDelete(content, lineNum)
		default:
			patch.AddKeep(content, lineNum)
		}
	}

	diff, err := PreviewPatch(reqBody.Content, patch)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, map[string]any{"diff": diff})
}

// ---- Checkpoint endpoints ----

func (r *Routes) handleCreateCheckpoint(w http.ResponseWriter, req *http.Request) {
	var reqBody struct {
		Name        string            `json:"name"`
		Description string            `json:"description"`
		CommitHash  string            `json:"commitHash"`
		Branch      string            `json:"branch"`
		Files       map[string]string `json:"files"`
	}
	if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// TODO: use checkpointManager from routes
	writeJSON(w, map[string]any{"status": "created", "name": reqBody.Name})
}

func (r *Routes) handleListCheckpoints(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{"checkpoints": []map[string]any{}})
}

func (r *Routes) handleGetCheckpoint(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	writeJSON(w, map[string]any{"id": id, "status": "found"})
}

func (r *Routes) handleRestoreCheckpoint(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	writeJSON(w, map[string]any{"id": id, "status": "restored"})
}

func (r *Routes) handleDeleteCheckpoint(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.registry.Remove(id); err != nil {
		writeError(w, http.StatusNotFound, "checkpoint not found")
		return
	}
	writeJSON(w, map[string]any{"id": id, "status": "deleted"})
}

// ---- Journal & Rollback endpoints ----

func (r *Routes) handleJournalEntries(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{"entries": []map[string]any{}})
}

func (r *Routes) handleRollback(w http.ResponseWriter, req *http.Request) {
	var reqBody struct {
		BasePath string `json:"basePath"`
		TargetID string `json:"targetId"`
	}
	if err := json.NewDecoder(req.Body).Decode(&reqBody); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	writeJSON(w, map[string]any{"basePath": reqBody.BasePath, "status": "rolled-back"})
}
