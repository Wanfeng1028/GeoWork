package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// NdvHandler handles NDVI analysis HTTP requests.
type NdvHandler struct {
	Worker *worker.Client
	Logger *zap.Logger
}

// NewNdvHandler creates a new NDVI handler.
func NewNdvHandler(workerClient *worker.Client, logger *zap.Logger) *NdvHandler {
	return &NdvHandler{
		Worker: workerClient,
		Logger: logger,
	}
}

// RegisterRoutes registers NDVI-related HTTP routes on the given mux.
func (h *NdvHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/ndvi/analyze", h.handleAnalyze)
	mux.HandleFunc("GET /api/v1/ndvi/history/", h.handleHistory)
}

// analyzeRequest represents the JSON body of an NDVI analysis request.
type analyzeRequest struct {
	ProjectID  string `json:"projectId"`
	DataSource string `json:"dataSource"`
	Bands      struct {
		Red string `json:"red"`
		NIR string `json:"nir"`
	} `json:"bands"`
	Thresholds struct {
		Min float64 `json:"min"`
		Max float64 `json:"max"`
	} `json:"thresholds"`
	Workspace string `json:"workspace"`
}

// analyzeResponse represents the JSON response of an NDVI analysis.
type analyzeResponse struct {
	Status        string         `json:"status"`
	NdviImagePath string         `json:"ndviImagePath"`
	Statistics    map[string]any `json:"statistics"`
	Message       string         `json:"message"`
	RequestID     string         `json:"requestId"`
	Timestamp     string         `json:"timestamp"`
}

// handleAnalyze processes an NDVI analysis request and forwards it to the Python worker.
func (h *NdvHandler) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	var req analyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" {
		http.Error(w, `{"error":"projectId is required"}`, http.StatusBadRequest)
		return
	}
	if req.Bands.Red == "" || req.Bands.NIR == "" {
		http.Error(w, `{"error":"red and nir bands are required"}`, http.StatusBadRequest)
		return
	}

	h.Logger.Info("NDVI analyze request",
		zap.String("projectId", req.ProjectID),
		zap.String("dataSource", req.DataSource),
		zap.String("redBand", req.Bands.Red),
		zap.String("nirBand", req.Bands.NIR),
	)

	// Forward to Python worker
	workerPayload := map[string]any{
		"project_id":  req.ProjectID,
		"data_source": req.DataSource,
		"red_band":    req.Bands.Red,
		"nir_band":    req.Bands.NIR,
		"min_value":   req.Thresholds.Min,
		"max_value":   req.Thresholds.Max,
		"workspace":   req.Workspace,
	}

	result, err := h.Worker.GenerateNDVI(r.Context(), workerPayload)
	if err != nil {
		h.Logger.Error("NDVI worker call failed", zap.Error(err))
		http.Error(w, `{"error":"NDVI analysis failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	// Marshal the worker response and send it back
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// handleHistory returns NDVI analysis history for a project.
func (h *NdvHandler) handleHistory(w http.ResponseWriter, r *http.Request) {
	// Extract project_id from the URL path: /api/v1/ndvi/history/{project_id}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/ndvi/history/")
	projectID := strings.Trim(path, "/")

	if projectID == "" {
		http.Error(w, `{"error":"project_id is required"}`, http.StatusBadRequest)
		return
	}

	h.Logger.Info("NDVI history request", zap.String("projectId", projectID))

	// Call Python worker's GET /ndvi/history/{project_id}
	workerURL := h.Worker.BaseURL + "/ndvi/history/" + projectID
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, workerURL, nil)
	if err != nil {
		h.Logger.Error("NDVI history request creation failed", zap.Error(err))
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	resp, err := h.Worker.HTTP.Do(req)
	if err != nil {
		h.Logger.Error("NDVI history worker call failed", zap.Error(err))
		http.Error(w, `{"error":"NDVI history failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		h.Logger.Error("NDVI history worker returned error", zap.Int("status", resp.StatusCode))
		http.Error(w, `{"error":"NDVI history worker error"}`, http.StatusInternalServerError)
		return
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		h.Logger.Error("NDVI history decode failed", zap.Error(err))
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}
