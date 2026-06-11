// Package telemetry provides performance monitoring endpoints.
package telemetry

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

// ReportEvent handles POST /api/telemetry/events
func (s *Service) ReportEvent(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	if !isTelemetryEnabled(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "telemetry disabled by user"})
		return
	}

	var req struct {
		Type     string                 `json:"type" binding:"required"`
		Value    float64                `json:"value"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	event := &storage.TelemetryEvent{
		ID:       generateID(),
		UserID:   user.ID,
		Type:     req.Type,
		Value:    req.Value,
		Metadata: req.Metadata,
	}

	if err := s.store.AppendTelemetryEvent(event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record telemetry"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "event recorded"})
}

// ReportBatch handles POST /api/telemetry/batch
func (s *Service) ReportBatch(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	if !isTelemetryEnabled(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "telemetry disabled by user"})
		return
	}

	var req []struct {
		Type     string                 `json:"type" binding:"required"`
		Value    float64                `json:"value"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	now := time.Now()
	_ = now
	for _, item := range req {
		event := &storage.TelemetryEvent{
			ID:       generateID(),
			UserID:   user.ID,
			Type:     item.Type,
			Value:    item.Value,
			Metadata: item.Metadata,
		}
		s.store.AppendTelemetryEvent(event) // fire-and-forget in batch
	}

	_ = time.Now // keep time package used

	c.JSON(http.StatusOK, gin.H{
		"message": "batch recorded",
		"count":   len(req),
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

func isTelemetryEnabled(c *gin.Context) bool {
	return c.GetHeader("X-Telemetry-Opt-In") == "true"
}

func generateID() string {
	return "tel_" + time.Now().Format("20060102150405")
}
