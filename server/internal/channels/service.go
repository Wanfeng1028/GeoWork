// Package channels provides webhook and channel integration endpoints.
package channels

import (
	"fmt"
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

// ListChannels handles GET /api/channels
func (s *Service) ListChannels(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	webhooks, err := s.store.ListChannelWebhooks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	result := make([]gin.H, 0, len(webhooks))
	for _, wh := range webhooks {
		result = append(result, gin.H{
			"id":         wh.ID,
			"channel_id": wh.ChannelID,
			"url":        wh.URL,
			"team_id":    wh.TeamID,
			"active":     wh.Active,
			"created_at": wh.CreatedAt,
		})
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
		Type   string `json:"type" binding:"required"`
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
	}

	if err := s.store.AppendChannelWebhook(webhook); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create channel"})
		return
	}

	baseURL := "http://127.0.0.1:8767"
	publicWebhookURL := baseURL + webhookURL

	c.JSON(http.StatusCreated, gin.H{
		"id":          webhook.ID,
		"name":        req.Name,
		"type":        req.Type,
		"webhook_url": publicWebhookURL,
		"active":      true,
		"message":     "Channel created successfully — use webhook_url to receive events",
	})
}

// WebhookReceiver handles POST /api/channels/webhook/:channelId
func (s *Service) WebhookReceiver(c *gin.Context) {
	channelID := c.Param("channelId")

	webhooks, err := s.store.ListChannelWebhooks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	var webhook *storage.ChannelWebhook
	for _, wh := range webhooks {
		if wh.ID == channelID && wh.Active {
			webhook = wh
			break
		}
	}

	if webhook == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	var payload gin.H
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	eventID := generateID()
	s.store.AppendCollabRecord(&storage.CollabRecord{
		ID:          eventID,
		WorkspaceID: webhook.TeamID,
		Type:        "webhook_event",
		UserID:      webhook.ID,
		Data:        fmt.Sprintf(`{"channel": %q, "payload": %v}`, channelID, payload),
	})

	c.JSON(http.StatusOK, gin.H{
		"message":  "webhook received and recorded",
		"channel":  channelID,
		"event_id": eventID,
		"payload":  payload,
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
