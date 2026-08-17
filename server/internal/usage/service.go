// Package usage provides usage tracking and summary endpoints.
package usage

import (
	"net/http"

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

// ReportEventRequest represents a usage event.
type ReportEventRequest struct {
	Type   string `json:"type" binding:"required"`
	Amount int64  `json:"amount"`
	Model  string `json:"model"`
}

// maxReportAmount caps a single reported amount (doc/25 S3). Metering is
// client-trusted (honor system — plan limits are informational, not
// enforced server-side), but obviously broken values are rejected so a
// buggy or hostile client cannot poison the aggregates.
const maxReportAmount = int64(1_000_000_000)

// ReportEvents handles POST /api/usage/events
func (s *Service) ReportEvents(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req ReportEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	if req.Amount < 0 {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "amount must be non-negative")
		return
	}
	if req.Amount > maxReportAmount {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "amount exceeds single-report limit")
		return
	}

	event := &storage.UsageEvent{
		ID:              idgen.New("usage_"),
		UserID:          user.ID,
		Type:            req.Type,
		Amount:          req.Amount,
		Model:           req.Model,
		SpeedMultiplier: getSpeedMultiplier(user.Plan),
	}

	if err := s.store.AppendUsageEvent(event); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to record usage")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "event recorded"})
}

// GetSummary handles GET /api/usage/summary
func (s *Service) GetSummary(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	summary, err := s.store.GetUsageSummary(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"model_tokens":     summary["model_tokens"],
		"model_requests":   summary["model_requests"],
		"tool_calls":       summary["tool_calls"],
		"browser_usage":    summary["browser_usage"],
		"sync_storage":     summary["sync_storage"],
		"speed_multiplier": getSpeedMultiplier(user.Plan),
	})
}

// GetModels handles GET /api/usage/models
func (s *Service) GetModels(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	modelUsage, err := s.store.GetUsageByModel(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	result := make([]gin.H, 0, len(modelUsage))
	for model, tokens := range modelUsage {
		result = append(result, gin.H{
			"model":  model,
			"tokens": tokens,
		})
	}

	c.JSON(http.StatusOK, result)
}

func getSpeedMultiplier(plan string) float64 {
	switch plan {
	case "pro", "team":
		return 2.0
	default:
		return 1.0
	}
}
