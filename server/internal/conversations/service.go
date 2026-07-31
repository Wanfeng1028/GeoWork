// Package conversations provides cloud-side conversation storage endpoints for
// multi-device sync. The desktop Core remains the source of truth; this service
// stores conversation/message snapshots pushed by clients so other devices can
// pull them.
package conversations

import (
	"net/http"
	"strconv"

	"server/internal/apierrors"
	"server/internal/idgen"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

// Service provides conversation + message HTTP handlers.
type Service struct {
	store *storage.Store
}

// NewService creates a new conversations Service.
func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// RegisterRoutes attaches conversation routes to the given Gin router group.
// All routes require auth middleware applied by the caller.
func (s *Service) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", s.List)
	rg.POST("", s.Create)
	rg.GET("/:id", s.Get)
	rg.DELETE("/:id", s.Delete)
	rg.GET("/:id/messages", s.ListMessages)
	rg.POST("/:id/messages", s.AppendMessage)
	rg.GET("/:id/usage", s.TokenUsage)
}

// List handles GET /api/conversations?before=&limit=
func (s *Service) List(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var before int64
	if bs := c.Query("before"); bs != "" {
		if v, err := strconv.ParseInt(bs, 10, 64); err == nil {
			before = v
		}
	}
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	convs, err := s.store.ListConversationsByUser(user.ID, before, limit)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if convs == nil {
		convs = []*storage.Conversation{}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":         len(convs),
		"conversations": convs,
	})
}

// Create handles POST /api/conversations
func (s *Service) Create(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		ID          string `json:"id"`           // optional: client-supplied id (for sync)
		WorkspaceID string `json:"workspace_id"`
		Title       string `json:"title"`
		Mode        string `json:"mode"`
		Status      string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	conv := &storage.Conversation{
		ID:          req.ID,
		UserID:      user.ID,
		WorkspaceID: req.WorkspaceID,
		Title:       req.Title,
		Mode:        req.Mode,
		Status:      req.Status,
	}
	if conv.ID == "" {
		conv.ID = idgen.New("conv_")
	}

	if err := s.store.CreateConversation(conv); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to create conversation")
		return
	}

	c.JSON(http.StatusCreated, conv)
}

// Get handles GET /api/conversations/:id
func (s *Service) Get(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	id := c.Param("id")
	conv, err := s.store.GetConversation(id)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if conv == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "conversation not found")
		return
	}
	// Ownership check: only the owner can read a conversation.
	if conv.UserID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "conversation not accessible")
		return
	}

	c.JSON(http.StatusOK, conv)
}

// Delete handles DELETE /api/conversations/:id
func (s *Service) Delete(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	id := c.Param("id")
	conv, err := s.store.GetConversation(id)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if conv == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "conversation not found")
		return
	}
	if conv.UserID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "conversation not accessible")
		return
	}

	if err := s.store.DeleteConversation(id); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to delete conversation")
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ListMessages handles GET /api/conversations/:id/messages?before=&limit=
func (s *Service) ListMessages(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	id := c.Param("id")
	conv, err := s.store.GetConversation(id)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if conv == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "conversation not found")
		return
	}
	if conv.UserID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "conversation not accessible")
		return
	}

	var before int64
	if bs := c.Query("before"); bs != "" {
		if v, err := strconv.ParseInt(bs, 10, 64); err == nil {
			before = v
		}
	}
	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	msgs, err := s.store.ListMessages(id, before, limit)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if msgs == nil {
		msgs = []*storage.Message{}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":    len(msgs),
		"messages": msgs,
	})
}

// AppendMessage handles POST /api/conversations/:id/messages
//
// This is a pure storage endpoint — it appends a message snapshot pushed by a
// client. It does NOT trigger any orchestrator/LLM execution (that happens in
// the desktop Core). The Server is a passive sync target.
func (s *Service) AppendMessage(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	id := c.Param("id")
	conv, err := s.store.GetConversation(id)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if conv == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "conversation not found")
		return
	}
	if conv.UserID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "conversation not accessible")
		return
	}

	var req struct {
		ID         string `json:"id"` // optional: client-supplied id (for sync)
		Role       string `json:"role" binding:"required"`
		Content    string `json:"content"`
		ToolCalls  string `json:"tool_calls"`
		Metadata   string `json:"metadata"`
		TokenCount int    `json:"token_count"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	msg := &storage.Message{
		ID:             req.ID,
		ConversationID: id,
		Role:           req.Role,
		Content:        req.Content,
		ToolCalls:      req.ToolCalls,
		Metadata:       req.Metadata,
		TokenCount:     req.TokenCount,
	}
	if msg.ID == "" {
		msg.ID = idgen.New("msg_")
	}

	if err := s.store.AppendMessage(msg); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to append message")
		return
	}

	c.JSON(http.StatusCreated, msg)
}

// TokenUsage handles GET /api/conversations/:id/usage
func (s *Service) TokenUsage(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	id := c.Param("id")
	conv, err := s.store.GetConversation(id)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if conv == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "conversation not found")
		return
	}
	if conv.UserID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "conversation not accessible")
		return
	}

	total, err := s.store.GetConversationTokenUsage(id)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"conversation_id": id,
		"token_count":     total,
	})
}
