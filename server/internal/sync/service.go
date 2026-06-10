// Package sync provides multi-device sync endpoints.
package sync

import (
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

	// Validate object type
	validTypes := map[string]bool{
		"settings": true, "workspace": true, "task": true,
		"artifact": true, "knowledge": true, "plugin": true,
		"mcp_config": true, "chat_summary": true,
	}
	if !validTypes[req.ObjectType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object type"})
		return
	}

	s.store.Mu.Lock()
	key := user.ID + "_" + req.ObjectType + "_" + req.ObjectID
	record := &storage.SyncRecord{
		ID:         generateID(),
		UserID:     user.ID,
		ObjectType: req.ObjectType,
		ObjectID:   req.ObjectID,
		Data:       req.Data,
		Cursor:     time.Now().UnixNano(),
		CreatedAt:  time.Now(),
	}
	s.store.SyncRecords[key] = record
	s.store.Mu.Unlock()

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
		for _, r := range cursorStr {
			if r >= '0' && r <= '9' {
				cursor = cursor*10 + int64(r-'0')
			}
		}
	}

	s.store.Mu.RLock()
	var result []gin.H
	for _, record := range s.store.SyncRecords {
		if record.UserID != user.ID {
			continue
		}
		if record.Cursor > cursor {
			result = append(result, gin.H{
				"id":          record.ID,
				"object_type": record.ObjectType,
				"object_id":   record.ObjectID,
				"data":        record.Data,
				"cursor":      record.Cursor,
				"created_at":  record.CreatedAt,
			})
		}
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{
		"records": result,
		"cursor":  time.Now().UnixNano(),
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
		Winner     string `json:"winner" binding:"required"` // local | remote
		Data       string `json:"data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	s.store.Mu.Lock()
	key := user.ID + "_" + req.ObjectType + "_" + req.ObjectID
	record := &storage.SyncRecord{
		ID:         generateID(),
		UserID:     user.ID,
		ObjectType: req.ObjectType,
		ObjectID:   req.ObjectID,
		Data:       req.Data,
		Cursor:     time.Now().UnixNano(),
		CreatedAt:  time.Now(),
	}
	s.store.SyncRecords[key] = record
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "conflict resolved (winner: " + req.Winner + ")",
		"cursor":  record.Cursor,
	})
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

// Helper to extract object ID from path
func extractObjectID(c *gin.Context) string {
	id := c.Param("id")
	return strings.TrimPrefix(id, "sync/")
}
