// Package sync provides multi-device sync endpoints.
package sync

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// PushRequest represents a sync push request.
type PushRequest struct {
	ObjectType string `json:"object_type" binding:"required"`
	ObjectID   string `json:"object_id" binding:"required"`
	Data       string `json:"data" binding:"required"`
}

// Push handles POST /api/sync/push
func (s *Service) Push(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req PushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if !isValidObjectType(req.ObjectType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid object type: %s", req.ObjectType)})
		return
	}

	if !isValidPayload(req.ObjectType, req.Data) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload contains prohibited data"})
		return
	}

	record := &storage.SyncRecord{
		ID:         generateID(),
		UserID:     user.ID,
		ObjectType: req.ObjectType,
		ObjectID:   req.ObjectID,
		Data:       req.Data,
		Cursor:     time.Now().UnixNano(),
	}

	if err := s.store.UpsertSyncRecord(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to push sync"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "synced",
		"cursor":  record.Cursor,
	})
}

// Pull handles GET /api/sync/pull
func (s *Service) Pull(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	cursorStr := c.Query("cursor")
	var cursor int64
	if cursorStr != "" {
		fmt.Sscanf(cursorStr, "%d", &cursor)
	}

	records, err := s.store.GetSyncRecordsAfter(user.ID, cursor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}
	if records == nil {
		records = []*storage.SyncRecord{}
	}

	result := make([]gin.H, 0, len(records))
	for _, r := range records {
		result = append(result, gin.H{
			"id":          r.ID,
			"object_type": r.ObjectType,
			"object_id":   r.ObjectID,
			"data":        r.Data,
			"cursor":      r.Cursor,
			"created_at":  r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"records": result,
		"cursor":  time.Now().UnixNano(),
	})
}

// GetState handles GET /api/sync/state
func (s *Service) GetState(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	cursor, err := s.store.GetSyncState(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":  user.ID,
		"cursor":   cursor,
		"modified": time.Unix(cursor, 0).UTC().Format(time.RFC3339),
	})
}

// ResolveConflict handles POST /api/sync/resolve-conflict
func (s *Service) ResolveConflict(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		ObjectType string `json:"object_type" binding:"required"`
		ObjectID   string `json:"object_id" binding:"required"`
		Winner     string `json:"winner" binding:"required"`
		Data       string `json:"data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if !isValidObjectType(req.ObjectType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object type"})
		return
	}

	if !isValidPayload(req.ObjectType, req.Data) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload contains prohibited data"})
		return
	}

	if req.Winner != "local" && req.Winner != "remote" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "winner must be 'local' or 'remote'"})
		return
	}

	record := &storage.SyncRecord{
		ID:         generateID(),
		UserID:     user.ID,
		ObjectType: req.ObjectType,
		ObjectID:   req.ObjectID,
		Data:       req.Data,
		Cursor:     time.Now().UnixNano(),
	}

	if err := s.store.UpsertSyncRecord(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve conflict"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "conflict resolved (winner: " + req.Winner + ")",
		"cursor":  record.Cursor,
	})
}

func isValidObjectType(typ string) bool {
	valid := map[string]bool{
		"settings": true, "workspace": true, "task": true,
		"artifact": true, "knowledge": true, "plugin": true,
		"mcp_config": true, "chat_summary": true,
	}
	return valid[typ]
}

func isValidPayload(typ string, data string) bool {
	// Prohibited data types — never sync these
	if strings.Contains(data, "API_KEY=") || strings.Contains(data, "api_key=") {
		return false
	}
	// Block large binary data (raw遥感, logs, raw workspace files)
	if len(data) > 5_000_000 { // 5MB limit
		return false
	}
	return true
}

func getUserFromContext(c *gin.Context) *storage.User {
	val, ok := c.Get("user")
	if !ok {
		return nil
	}
	u, ok := val.(*storage.User)
	if !ok {
		return nil
	}
	return u
}

func generateID() string {
	return "sync_" + time.Now().Format("20060102150405")
}
