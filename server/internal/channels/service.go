// Package channels provides webhook and channel integration endpoints.
package channels

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

// ListChannels handles GET /api/channels
func (s *Service) ListChannels(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	s.store.Mu.RLock()
	var result []gin.H
	for _, wh := range s.store.ChannelWebhooks {
		result = append(result, gin.H{
			"id":         wh.ID,
			"channel_id": wh.ChannelID,
			"url":        wh.URL,
			"team_id":    wh.TeamID,
			"active":     wh.Active,
			"created_at": wh.CreatedAt,
		})
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []gin.H{}
	}
	c.JSON(http.StatusOK, result)
}

// CreateChannel handles POST /api/channels
func (s *Service) CreateChannel(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		Name   string `json:"name" binding:"required"`
		Type   string `json:"type" binding:"required"` // feishu | dingtalk | wecom | slack
		TeamID string `json:"team_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	webhookID := generateID()
	webhookURL := "/api/channels/webhook/" + webhookID

	webhook := &storage.ChannelWebhook{
		ID:        webhookID,
		ChannelID: "ch_" + req.Type,
		URL:       webhookURL,
		TeamID:    req.TeamID,
		Active:    true,
		CreatedAt: time.Now(),
	}

	s.store.Mu.Lock()
	s.store.ChannelWebhooks = append(s.store.ChannelWebhooks, webhook)
	s.store.Mu.Unlock()

	// Placeholder webhook URL (in production, this would be a public endpoint)
	c.JSON(http.StatusCreated, gin.H{
		"id":          webhook.ID,
		"name":        req.Name,
		"type":        req.Type,
		"webhook_url": "http://127.0.0.1:8767" + webhookURL,
		"active":      true,
	})
}

// WebhookReceiver handles POST /api/channels/webhook/{channelId}
func (s *Service) WebhookReceiver(c *gin.Context) {
	channelID := c.Param("channelId")

	s.store.Mu.RLock()
	var webhook *storage.ChannelWebhook
	for _, wh := range s.store.ChannelWebhooks {
		if wh.ID == channelID && wh.Active {
			webhook = wh
			break
		}
	}
	s.store.Mu.RUnlock()

	if webhook == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	// Parse webhook payload
	var payload gin.H
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// Placeholder: create task from webhook
	// In production, parse the message and create a task
	c.JSON(http.StatusOK, gin.H{
		"message": "webhook received (task creation placeholder)",
		"channel": channelID,
		"payload": payload,
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
	return "wh_" + time.Now().Format("20060102150405")
}

// Helper to extract ID from path
func extractID(c *gin.Context, prefix string) string {
	id := c.Param("id")
	return strings.TrimPrefix(id, prefix+"/")
}
