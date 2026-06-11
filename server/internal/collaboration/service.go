// Package collaboration provides team collaboration endpoints.
package collaboration

import (
	"net/http"
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

// GetActivity handles GET /api/workspaces/:id/activity
func (s *Service) GetActivity(c *gin.Context) {
	workspaceID := c.Param("id")

	records, err := s.store.GetCollabRecordsByWorkspace(workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}
	if records == nil {
		records = []*storage.CollabRecord{}
	}

	result := make([]gin.H, 0, len(records))
	for _, r := range records {
		result = append(result, gin.H{
			"id":        r.ID,
			"type":      r.Type,
			"user_id":   r.UserID,
			"data":      r.Data,
			"timestamp": r.Timestamp,
		})
	}

	c.JSON(http.StatusOK, result)
}

// Share handles POST /api/workspaces/:id/share
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
	}

	if err := s.store.AppendCollabRecord(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to share"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "workspace shared",
		"shared_with": req.UserID,
		"role":        req.Role,
	})
}

// AddComment handles POST /api/tasks/:id/comments
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
	}

	if err := s.store.AppendCollabRecord(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "comment added"})
}

// AssignTask handles POST /api/tasks/:id/assign
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
	}

	if err := s.store.AppendCollabRecord(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign task"})
		return
	}

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
