// Package telemetry provides performance monitoring endpoints.
package telemetry

import (
	"net/http"
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

// ReportEvent handles POST /api/telemetry/events
func (s *Service) ReportEvent(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	if !isTelemetryEnabled(c) {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "telemetry disabled by user")
		return
	}

	var req struct {
		Type     string                 `json:"type" binding:"required"`
		Value    float64                `json:"value"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	event := &storage.TelemetryEvent{
		ID:       idgen.New("tel_"),
		UserID:   user.ID,
		Type:     req.Type,
		Value:    req.Value,
		Metadata: req.Metadata,
	}

	if err := s.store.AppendTelemetryEvent(event); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to record telemetry")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "event recorded"})
}

// ReportBatch handles POST /api/telemetry/batch
func (s *Service) ReportBatch(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	if !isTelemetryEnabled(c) {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "telemetry disabled by user")
		return
	}

	var req []struct {
		Type     string                 `json:"type" binding:"required"`
		Value    float64                `json:"value"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	now := time.Now()
	_ = now
	for _, item := range req {
		event := &storage.TelemetryEvent{
			ID:       idgen.New("tel_"),
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

func isTelemetryEnabled(c *gin.Context) bool {
	return c.GetHeader("X-Telemetry-Opt-In") == "true"
}
