// GeoWork Go Core - Model Gateway Routes

package modelgateway

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	registry   *ProviderRegistry
	client     *OpenAICompatibleClient
	cache      *Cache
	limiter    *RateLimiter
	usageMeter *UsageMeter
}

func NewRoutes(registry *ProviderRegistry, client *OpenAICompatibleClient, cache *Cache, limiter *RateLimiter, usageMeter *UsageMeter) *Routes {
	return &Routes{registry: registry, client: client, cache: cache, limiter: limiter, usageMeter: usageMeter}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/models", r.handleList)
	mux.HandleFunc("POST /api/v1/models", r.handleCreate)
	mux.HandleFunc("DELETE /api/v1/models/{id}", r.handleDelete)
	mux.HandleFunc("POST /api/v1/models/test", r.handleTest)
	mux.HandleFunc("GET /api/v1/models/{id}", r.handleGet)
	mux.HandleFunc("POST /api/v1/cache/clear", r.handleClearCache)
	mux.HandleFunc("GET /api/v1/usage/summary", r.handleUsage)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.registry.List())
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	p, ok := r.registry.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "provider not found")
		return
	}
	writeJSON(w, p)
}

func (r *Routes) handleCreate(w http.ResponseWriter, req *http.Request) {
	var p ModelProvider
	if err := json.NewDecoder(req.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	r.registry.Add(&p)
	writeJSON(w, p)
}

func (r *Routes) handleDelete(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.registry.Remove(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handleTest(w http.ResponseWriter, req *http.Request) {
	if r.client == nil {
		writeError(w, http.StatusServiceUnavailable, "no active client")
		return
	}
	ctx := req.Context()
	err := r.client.TestConnection(ctx)
	if err != nil {
		writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

func (r *Routes) handleClearCache(w http.ResponseWriter, req *http.Request) {
	if r.cache != nil {
		r.cache.Clear()
	}
	writeJSON(w, map[string]string{"status": "cleared"})
}

func (r *Routes) handleUsage(w http.ResponseWriter, req *http.Request) {
	if r.usageMeter != nil {
		writeJSON(w, r.usageMeter.Summary())
	} else {
		writeJSON(w, map[string]any{})
	}
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
