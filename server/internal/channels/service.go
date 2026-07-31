// Package channels provides webhook and channel integration endpoints.
package channels

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

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

// ListChannels handles GET /api/channels
func (s *Service) ListChannels(c *gin.Context) {
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	webhooks, err := s.store.ListChannelWebhooks()
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
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
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	var req struct {
		Name   string `json:"name" binding:"required"`
		Type   string `json:"type" binding:"required"`
		TeamID string `json:"team_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	webhookID := idgen.New("ch_")
	webhookURL := "/api/channels/webhook/" + webhookID

	// Generate HMAC secret for webhook signature verification
	secret := generateSecret()

	webhook := &storage.ChannelWebhook{
		ID:        webhookID,
		ChannelID: "ch_" + req.Type,
		URL:       webhookURL,
		TeamID:    req.TeamID,
		Active:    true,
		Secret:    secret,
	}

	if err := s.store.AppendChannelWebhook(webhook); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to create channel")
		return
	}

	baseURL := "http://127.0.0.1:8767"
	publicWebhookURL := baseURL + webhookURL

	c.JSON(http.StatusCreated, gin.H{
		"id":          webhook.ID,
		"name":        req.Name,
		"type":        req.Type,
		"webhook_url": publicWebhookURL,
		"secret":      secret,
		"active":      true,
		"message":     "Channel created successfully — use webhook_url to receive events",
	})
}

// DeleteChannel handles DELETE /api/channels/:id
func (s *Service) DeleteChannel(c *gin.Context) {
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "channel id is required")
		return
	}

	webhook, err := s.store.GetChannelWebhook(channelID)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if webhook == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "channel not found")
		return
	}

	if err := s.store.DeleteChannelWebhook(channelID); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to delete channel")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "channel deleted"})
}

// ToggleChannel handles PATCH /api/channels/:id/toggle
func (s *Service) ToggleChannel(c *gin.Context) {
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "channel id is required")
		return
	}

	webhook, err := s.store.GetChannelWebhook(channelID)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if webhook == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "channel not found")
		return
	}

	newActive := !webhook.Active
	if err := s.store.UpdateChannelWebhookActive(channelID, newActive); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to toggle channel")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":     webhook.ID,
		"active": newActive,
	})
}

// ListChannelEvents handles GET /api/channels/:id/events
func (s *Service) ListChannelEvents(c *gin.Context) {
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	channelID := c.Param("id")
	if channelID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "channel id is required")
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	events, err := s.store.GetChannelEvents(channelID, limit)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if events == nil {
		events = []*storage.ChannelEvent{}
	}

	result := make([]gin.H, 0, len(events))
	for _, e := range events {
		result = append(result, gin.H{
			"id":           e.ID,
			"channel_id":   e.ChannelID,
			"payload_hash": e.PayloadHash,
			"data":         e.Data,
			"created_at":   e.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"events": result,
		"count":  len(events),
	})
}

// WebhookReceiver handles POST /api/channels/webhook/:channelId
func (s *Service) WebhookReceiver(c *gin.Context) {
	channelID := c.Param("channelId")

	webhook, err := s.store.GetChannelWebhook(channelID)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}

	if webhook == nil || !webhook.Active {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "channel not found or inactive")
		return
	}

	// Read raw body for HMAC verification
	rawBody, err := c.GetRawData()
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "failed to read request body")
		return
	}

	// HMAC-SHA256 signature verification
	if webhook.Secret != "" {
		signature := c.GetHeader("X-Webhook-Signature")
		if signature == "" {
			apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "missing X-Webhook-Signature header")
			return
		}

		mac := hmac.New(sha256.New, []byte(webhook.Secret))
		mac.Write(rawBody)
		expectedSig := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "invalid webhook signature")
			return
		}
	}

	var payload gin.H
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid payload")
		return
	}

	// Event deduplication based on payload hash
	payloadHash := computePayloadHash(rawBody)

	isDup, err := s.store.CheckDuplicateEvent(channelID, payloadHash)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if isDup {
		c.JSON(http.StatusOK, gin.H{
			"message": "duplicate event skipped",
			"channel": channelID,
			"dedup":   true,
		})
		return
	}

	// Store event for dedup and history
	eventData, _ := json.Marshal(payload)
	eventID := idgen.New("che_")
	s.store.InsertChannelEvent(&storage.ChannelEvent{
		ID:          eventID,
		ChannelID:   channelID,
		PayloadHash: payloadHash,
		Data:        string(eventData),
	})

	// Also record in collab records for workspace activity
	s.store.AppendCollabRecord(&storage.CollabRecord{
		ID:          idgen.New("ch_"),
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

// generateSecret generates a random 32-byte hex secret for HMAC signing.
func generateSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based secret (should not happen)
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// computePayloadHash computes SHA-256 hash of the raw payload for deduplication.
func computePayloadHash(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
