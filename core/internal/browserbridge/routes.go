// GeoWork Go Core - Browser Bridge Routes

package browserbridge

import (
	"encoding/json"
	"net/http"

	"go.uber.org/zap"
)

type Routes struct {
	controller *Controller
	network    *NetworkLog
	log        *zap.Logger
}

func NewRoutes(controller *Controller, network *NetworkLog, log *zap.Logger) *Routes {
	return &Routes{controller: controller, network: network, log: log}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/browser/sessions", r.handleList)
	mux.HandleFunc("POST /api/browser/sessions", r.handleCreate)
	mux.HandleFunc("DELETE /api/browser/sessions/{id}", r.handleDelete)
	mux.HandleFunc("POST /api/browser/sessions/{id}/navigate", r.handleNavigate)
	mux.HandleFunc("GET /api/browser/sessions/{id}/screenshot", r.handleScreenshot)
	mux.HandleFunc("GET /api/browser/sessions/{id}/text", r.handleText)
	mux.HandleFunc("POST /api/browser/paper/search", r.handlePaperSearch)
	mux.HandleFunc("POST /api/browser/paper/openalex", r.handleOpenAlexSearch)
	mux.HandleFunc("POST /api/browser/network/log", r.handleNetworkLog)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.controller.ListSessions())
}

func (r *Routes) handleCreate(w http.ResponseWriter, req *http.Request) {
	s := r.controller.CreateSession()
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, s)
}

func (r *Routes) handleDelete(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.controller.DeleteSession(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handleNavigate(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	var in struct {
		URL string `json:"url"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	if err := r.controller.Navigate(id, in.URL); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "navigated", "url": in.URL})
}

func (r *Routes) handleScreenshot(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	ss, err := r.controller.CaptureScreenshot(req.Context(), id, "png", 80)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, ss)
}

func (r *Routes) handleText(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	text, err := r.controller.ExtractText(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"text": text})
}

func (r *Routes) handlePaperSearch(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	var in struct {
		Query string `json:"query"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	results, err := r.controller.PaperSearch(req.Context(), id, in.Query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, results)
}

func (r *Routes) handleOpenAlexSearch(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Query    string `json:"query"`
		Author   string `json:"author,omitempty"`
		YearFrom *int   `json:"yearFrom,omitempty"`
		YearTo   *int   `json:"yearTo,omitempty"`
		Topic    string `json:"topic,omitempty"`
		Page     int    `json:"page"`
		PageSize int    `json:"pageSize"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	if in.Page <= 0 {
		in.Page = 1
	}
	if in.PageSize <= 0 {
		in.PageSize = 20
	}
	result, err := SearchOpenAlexWithFilters(req.Context(), in.Query, in.Author, in.YearFrom, in.YearTo, in.Topic, in.Page, in.PageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, result)
}

func (r *Routes) handleNetworkLog(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.network.GetRequests())
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
