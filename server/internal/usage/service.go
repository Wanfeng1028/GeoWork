// Package usage provides usage tracking and summary endpoints.
package usage

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

// ReportEventRequest represents a usage event.
type ReportEventRequest struct {
	Type   string  `json:"type" binding:"required"`
	Amount int64   `json:"amount"`
	Model  string  `json:"model"`
}

// ReportEvents handles POST /api/usage/events
func (s *Service) ReportEvents(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req ReportEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	event := &storage.UsageEvent{
		ID:              generateID(),
		UserID:          user.ID,
		Type:            req.Type,
		Amount:          req.Amount,
		Model:           req.Model,
		SpeedMultiplier: getSpeedMultiplier(user.Plan),
	}

	if err := s.store.AppendUsageEvent(event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record usage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "event recorded"})
}

// GetSummary handles GET /api/usage/summary
func (s *Service) GetSummary(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	summary, err := s.store.GetUsageSummary(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
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
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	modelUsage, err := s.store.GetUsageByModel(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
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
	return "evt_" + time.Now().Format("20060102150405")
}
