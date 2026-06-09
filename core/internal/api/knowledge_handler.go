package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"geowork/core/internal/knowledge"
	"go.uber.org/zap"
)

// KnowledgeHandler handles knowledge base HTTP requests.
type KnowledgeHandler struct {
	manager *knowledge.KnowledgeManager
	logger  *zap.Logger
}

// NewKnowledgeHandler creates a new KnowledgeHandler.
func NewKnowledgeHandler(manager *knowledge.KnowledgeManager, logger *zap.Logger) *KnowledgeHandler {
	return &KnowledgeHandler{
		manager: manager,
		logger:  logger,
	}
}

// RegisterRoutes registers knowledge-related routes on the mux.
func (h *KnowledgeHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/knowledge/categories", h.handleGetCategories)
	mux.HandleFunc("GET /api/v1/knowledge/entries", h.handleGetEntries)
	mux.HandleFunc("POST /api/v1/knowledge/categories", h.handleCreateCategory)
	mux.HandleFunc("POST /api/v1/knowledge/index", h.handleIndexPaper)
	mux.HandleFunc("POST /api/v1/knowledge/import", h.handleImportFile)
	mux.HandleFunc("DELETE /api/v1/knowledge/entries/{id}", h.handleDeleteEntry)
	mux.HandleFunc("GET /api/v1/knowledge/entries/{id}", h.handleGetEntry)
}

// handleGetCategories returns all knowledge categories as a tree.
func (h *KnowledgeHandler) handleGetCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.manager.GetCategories()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, categories)
}

// handleGetEntries returns knowledge entries, optionally filtered by category and query.
func (h *KnowledgeHandler) handleGetEntries(w http.ResponseWriter, r *http.Request) {
	categoryID := r.URL.Query().Get("categoryId")
	query := r.URL.Query().Get("q")

	entries, err := h.manager.GetEntries(categoryID, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, entries)
}

// handleCreateCategory creates a new knowledge category.
func (h *KnowledgeHandler) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
		return
	}

	category, err := h.manager.CreateCategory(req.Name, req.ParentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, category)
}

// handleIndexPaper indexes a paper into the knowledge base.
func (h *KnowledgeHandler) handleIndexPaper(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PaperID string   `json:"paperId"`
		Title   string   `json:"title"`
		Content string   `json:"content"`
		Tags    []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.PaperID == "" || req.Title == "" {
		http.Error(w, `{"error":"paperId and title are required"}`, http.StatusBadRequest)
		return
	}

	err := h.manager.IndexPaper(req.PaperID, req.Title, req.Content, req.Tags)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "indexed", "paperId": req.PaperID})
}

// handleImportFile imports a file into the knowledge base.
func (h *KnowledgeHandler) handleImportFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FilePath   string `json:"filePath"`
		Title      string `json:"title"`
		Content    string `json:"content"`
		Source     string `json:"source"` // "pdf" or "manual"
		CategoryID string `json:"categoryId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.FilePath == "" || req.Title == "" || req.Content == "" {
		http.Error(w, `{"error":"filePath, title, and content are required"}`, http.StatusBadRequest)
		return
	}

	if req.Source == "" {
		req.Source = "manual"
	}

	err := h.manager.ImportFile(req.FilePath, req.Title, req.Content, req.Source, req.CategoryID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "imported", "filePath": req.FilePath})
}

// handleDeleteEntry deletes a knowledge entry by ID.
func (h *KnowledgeHandler) handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	// Extract ID from path: /api/v1/knowledge/entries/{id}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/knowledge/entries/")
	if path == "" || strings.Contains(path, "/") {
		http.Error(w, `{"error":"entry id is required"}`, http.StatusBadRequest)
		return
	}

	err := h.manager.DeleteEntry(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "deleted", "id": path})
}

// handleGetEntry returns a single knowledge entry by ID.
func (h *KnowledgeHandler) handleGetEntry(w http.ResponseWriter, r *http.Request) {
	// Extract ID from path: /api/v1/knowledge/entries/{id}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/knowledge/entries/")
	if path == "" || strings.Contains(path, "/") {
		http.Error(w, `{"error":"entry id is required"}`, http.StatusBadRequest)
		return
	}

	entry, err := h.manager.GetEntryByID(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, entry)
}
