package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// PaperHandler handles paper search and indexing HTTP requests.
type PaperHandler struct {
	Worker *worker.Client
	Logger *zap.Logger
}

// NewPaperHandler creates a new paper handler.
func NewPaperHandler(workerClient *worker.Client, logger *zap.Logger) *PaperHandler {
	return &PaperHandler{
		Worker: workerClient,
		Logger: logger,
	}
}

// RegisterRoutes registers paper-related HTTP routes on the given mux.
func (h *PaperHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/papers/search", h.handleSearch)
	mux.HandleFunc("POST /api/v1/papers/{id}/index", h.handleIndex)
}

// paperSearchRequest represents the JSON body of a paper search request.
type paperSearchRequest struct {
	Query     string `json:"query"`
	Author    string `json:"author,omitempty"`
	YearFrom  *int   `json:"yearFrom,omitempty"`
	YearTo    *int   `json:"yearTo,omitempty"`
	Topic     string `json:"topic,omitempty"`
	Page      int    `json:"page"`
	PageSize  int    `json:"pageSize"`
}

// paperResult represents a single paper result in the response.
type paperResult struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Authors  []string `json:"authors"`
	Journal  string   `json:"journal"`
	Year     int      `json:"year"`
	Citations int    `json:"citations"`
	Abstract string   `json:"abstract"`
	DOI      string   `json:"doi"`
	Keywords []string `json:"keywords"`
	BibTeX   string   `json:"bibtex"`
}

// paperSearchResponse represents the JSON response of a paper search.
type paperSearchResponse struct {
	Status  string          `json:"status"`
	Results []paperResult   `json:"results"`
	Total   int             `json:"total"`
	Page    int             `json:"page"`
	PageSize int            `json:"pageSize"`
	Message string          `json:"message"`
}

// handleSearch processes a paper search request and forwards it to the Python worker.
func (h *PaperHandler) handleSearch(w http.ResponseWriter, r *http.Request) {
	var req paperSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Query == "" {
		http.Error(w, `{"error":"query is required"}`, http.StatusBadRequest)
		return
	}

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}

	h.Logger.Info("Paper search request",
		zap.String("query", req.Query),
		zap.String("author", req.Author),
		zap.Int("page", req.Page),
		zap.Int("pageSize", req.PageSize),
	)

	// Forward to Python worker's /papers/search endpoint
	workerPayload := map[string]any{
		"query":     req.Query,
		"author":    req.Author,
		"page":      req.Page,
		"page_size": req.PageSize,
	}
	if req.YearFrom != nil {
		workerPayload["year_from"] = *req.YearFrom
	}
	if req.YearTo != nil {
		workerPayload["year_to"] = *req.YearTo
	}
	if req.Topic != "" {
		workerPayload["topic"] = req.Topic
	}

	result, err := h.Worker.SearchOpenAlex(r.Context(), workerPayload)
	if err != nil {
		h.Logger.Error("Paper search worker call failed", zap.Error(err))
		http.Error(w, `{"error":"paper search failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	// Marshal the worker response and send it back
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// handleIndex processes a paper indexing request.
func (h *PaperHandler) handleIndex(w http.ResponseWriter, r *http.Request) {
	// Extract paper_id from the URL path: /api/v1/papers/{id}/index
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/papers/")
	paperID := strings.TrimSuffix(path, "/index")

	if paperID == "" {
		http.Error(w, `{"error":"paper_id is required"}`, http.StatusBadRequest)
		return
	}

	h.Logger.Info("Paper index request", zap.String("paperId", paperID))

	// Forward to Python worker's /papers/index endpoint
	workerPayload := map[string]any{
		"paper_id": paperID,
	}

	result, err := h.Worker.IndexKnowledge(r.Context(), workerPayload)
	if err != nil {
		h.Logger.Error("Paper index worker call failed", zap.Error(err))
		http.Error(w, `{"error":"paper index failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}
