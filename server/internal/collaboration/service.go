// Package collaboration provides team collaboration endpoints.
package collaboration

import (
	"encoding/json"
	"net/http"
	"strconv"

	"server/internal/apierrors"
	"server/internal/idgen"
	"server/internal/servercontext"
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
		apierrors.RespondError(c, apierrors.ErrInternal)
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
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	// Permission check: only workspace owner/admin can share
	isPrivileged, err := s.store.IsUserOwnerOrAdmin(user.ID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if !isPrivileged {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only workspace owner or admin can share")
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"oneof=viewer editor admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondError(c, apierrors.ErrBadRequest)
		return
	}

	// Use json.Marshal to prevent JSON injection
	data, err := json.Marshal(map[string]string{
		"shared_with": req.UserID,
		"role":        req.Role,
	})
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	record := &storage.CollabRecord{
		ID:          idgen.New("collab_"),
		WorkspaceID: workspaceID,
		Type:        "share",
		UserID:      user.ID,
		Data:        string(data),
	}

	if err := s.store.AppendCollabRecord(record); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
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
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondError(c, apierrors.ErrBadRequest)
		return
	}

	// Use json.Marshal to prevent JSON injection
	data, err := json.Marshal(map[string]string{
		"task_id": taskID,
		"content": req.Content,
	})
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	record := &storage.CollabRecord{
		ID:     idgen.New("collab_"),
		Type:   "comment",
		UserID: user.ID,
		Data:   string(data),
	}

	if err := s.store.AppendCollabRecord(record); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "comment added",
		"comment_id": record.ID,
	})
}

// EditComment handles PUT /api/comments/:id
// Only the comment author can edit their own comment.
func (s *Service) EditComment(c *gin.Context) {
	commentID := c.Param("id")
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondError(c, apierrors.ErrBadRequest)
		return
	}

	// Fetch existing record
	record, err := s.store.GetCollabRecord(commentID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if record == nil || record.Type != "comment" {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "comment not found")
		return
	}

	// Only author can edit
	if record.UserID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only the author can edit this comment")
		return
	}

	// Parse existing data to preserve task_id
	var existingData map[string]string
	if err := json.Unmarshal([]byte(record.Data), &existingData); err != nil {
		existingData = make(map[string]string)
	}
	existingData["content"] = req.Content

	updatedData, err := json.Marshal(existingData)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	if err := s.store.UpdateCollabRecordData(commentID, string(updatedData)); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "comment updated"})
}

// DeleteComment handles DELETE /api/comments/:id
// Only the comment author or an admin can delete.
func (s *Service) DeleteComment(c *gin.Context) {
	commentID := c.Param("id")
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	// Fetch existing record
	record, err := s.store.GetCollabRecord(commentID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if record == nil || record.Type != "comment" {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "comment not found")
		return
	}

	// Only author or admin can delete
	isAdmin, err := s.store.IsUserOwnerOrAdmin(user.ID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if record.UserID != user.ID && !isAdmin {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only the author or admin can delete this comment")
		return
	}

	if err := s.store.DeleteCollabRecord(commentID); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "comment deleted"})
}

// ListComments handles GET /api/workspaces/:id/comments
// Lists comments for a workspace with pagination (limit + offset).
func (s *Service) ListComments(c *gin.Context) {
	workspaceID := c.Param("id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	records, err := s.store.ListCollabComments(workspaceID, limit, offset)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	type commentItem struct {
		ID        string `json:"id"`
		UserID    string `json:"user_id"`
		UserName  string `json:"user_name"`
		Data      string `json:"data"`
		Timestamp string `json:"timestamp"`
	}

	result := make([]commentItem, 0, len(records))
	for _, r := range records {
		// Resolve author name
		authorName := ""
		if author, err := s.store.GetUserByID(r.UserID); err == nil && author != nil {
			authorName = author.Name
		}
		result = append(result, commentItem{
			ID:        r.ID,
			UserID:    r.UserID,
			UserName:  authorName,
			Data:      r.Data,
			Timestamp: r.Timestamp.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"comments": result,
		"limit":    limit,
		"offset":   offset,
	})
}

// AssignTask handles POST /api/tasks/:id/assign
func (s *Service) AssignTask(c *gin.Context) {
	taskID := c.Param("id")
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondError(c, apierrors.ErrBadRequest)
		return
	}

	// Use json.Marshal to prevent JSON injection
	data, err := json.Marshal(map[string]string{
		"task_id":     taskID,
		"assigned_to": req.UserID,
	})
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	record := &storage.CollabRecord{
		ID:     idgen.New("collab_"),
		Type:   "assign",
		UserID: user.ID,
		Data:   string(data),
	}

	if err := s.store.AppendCollabRecord(record); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "task assigned",
		"assigned_to": req.UserID,
	})
}
