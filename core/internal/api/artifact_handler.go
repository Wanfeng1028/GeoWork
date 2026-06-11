// GeoWork Go Core - Artifact Handler

package api

import (
	"net/http"
	"os"

	gruntime "geowork/core/internal/runtime"
)

type artifactHandler struct {
	app    *gruntime.App
	bridge *EventBridge
}

func newArtifactHandler(app *gruntime.App, bridge *EventBridge) *artifactHandler {
	return &artifactHandler{app: app, bridge: bridge}
}

func (h *artifactHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/artifacts", h.handleList)
	mux.HandleFunc("GET /api/artifacts/{id}", h.handleGet)
	mux.HandleFunc("POST /api/artifacts/{id}/open", h.handleOpen)
}

// GET /api/artifacts
func (h *artifactHandler) handleList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.AllArtifacts())
}

// GET /api/artifacts/{id}
func (h *artifactHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	artifacts := h.app.AllArtifacts()
	for _, art := range artifacts {
		if art.ID == id {
			content, err := os.ReadFile(art.Path)
			if err == nil {
				resp := map[string]any{
					"id":       art.ID,
					"taskId":   art.TaskID,
					"type":     art.Type,
					"name":     art.Name,
					"path":     art.Path,
					"mimeType": art.MimeType,
				}
				if len(content) > 100*1024 {
					resp["content"] = string(content[:100*1024])
					resp["isTruncated"] = true
				} else {
					resp["content"] = string(content)
					resp["isTruncated"] = false
				}
				writeJSON(w, resp)
				return
			}
			writeJSON(w, art)
			return
		}
	}
	http.NotFound(w, r)
}

// POST /api/artifacts/{id}/open
func (h *artifactHandler) handleOpen(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	artifacts := h.app.AllArtifacts()
	for _, art := range artifacts {
		if art.ID == id {
			resp := map[string]any{
				"status":   "opened",
				"artifact": art,
				"path":     art.Path,
				"message":  "Artifact opened for viewing",
			}
			if h.bridge != nil {
				h.bridge.Publish(TaskEventPayload{
					Type:    StepDelta,
					TaskID:  art.TaskID,
					Message: "Artifact opened: " + art.Name,
					Data: map[string]any{
						"artifactId": id,
						"path":       art.Path,
						"type":       art.Type,
					},
				})
			}
			writeJSON(w, resp)
			return
		}
	}
	http.NotFound(w, r)
}
