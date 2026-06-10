// Package collaboration provides team collaboration endpoints.
package collaboration

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

// GetActivity handles GET /api/workspaces/{id}/activity
func (s *Service) GetActivity(c *gin.Context) {
	workspaceID := c.Param("id")

	s.store.Mu.RLock()
	var result []gin.H
	for _, record := range s.store.CollabRecords {
		if record.WorkspaceID == workspaceID {
			result = append(result, gin.H{
				"id":        record.ID,
				"type":      record.Type,
				"user_id":   record.UserID,
				"data":      record.Data,
				"timestamp": record.Timestamp,
			})
		}
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, result)
}

// Share handles POST /api/workspaces/{id}/share
func (s *Service) Share(c *gin.Context) {
	workspaceID := c.Param("id")
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"oneof=viewer editor admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	record := &storage.CollabRecord{
		ID:          generateID(),
		WorkspaceID: workspaceID,
		Type:        "share",
		UserID:      user.ID,
		Data:        `{"shared_with": "` + req.UserID + `", "role": "` + req.Role + `"}`,
		Timestamp:   time.Now(),
	}

	s.store.Mu.Lock()
	s.store.CollabRecords = append(s.store.CollabRecords, record)
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":     "workspace shared",
		"shared_with": req.UserID,
		"role":        req.Role,
	})
}

// AddComment handles POST /api/tasks/{id}/comments
func (s *Service) AddComment(c *gin.Context) {
	taskID := c.Param("id")
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	record := &storage.CollabRecord{
		ID:        generateID(),
		Type:      "comment",
		UserID:    user.ID,
		Data:      `{"task_id": "` + taskID + `", "content": "` + req.Content + `"}`,
		Timestamp: time.Now(),
	}

	s.store.Mu.Lock()
	s.store.CollabRecords = append(s.store.CollabRecords, record)
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "comment added",
	})
}

// AssignTask handles POST /api/tasks/{id}/assign
func (s *Service) AssignTask(c *gin.Context) {
	taskID := c.Param("id")
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	record := &storage.CollabRecord{
		ID:        generateID(),
		Type:      "assign",
		UserID:    user.ID,
		Data:      `{"task_id": "` + taskID + `", "assigned_to": "` + req.UserID + `"}`,
		Timestamp: time.Now(),
	}

	s.store.Mu.Lock()
	s.store.CollabRecords = append(s.store.CollabRecords, record)
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":     "task assigned",
		"assigned_to": req.UserID,
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
	return "collab_" + time.Now().Format("20060102150405")
}

// Helper to extract ID from path
func extractID(c *gin.Context, prefix string) string {
	id := c.Param("id")
	return strings.TrimPrefix(id, prefix+"/")
}
