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
	Type   string `json:"type" binding:"required"`
	Amount int64  `json:"amount"`
	Model  string `json:"model"`
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
		ID:        generateID(),
		UserID:    user.ID,
		Type:      req.Type,
		Amount:    req.Amount,
		Model:     req.Model,
		Timestamp: time.Now(),
	}

	s.store.Mu.Lock()
	s.store.UsageEvents = append(s.store.UsageEvents, event)
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "event recorded"})
}

// GetSummary handles GET /api/usage/summary
func (s *Service) GetSummary(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	s.store.Mu.RLock()
	var summary gin.H
	totalTokens := int64(0)
	totalRequests := int64(0)
	totalToolCalls := int64(0)
	totalBrowserUsage := int64(0)

	for _, e := range s.store.UsageEvents {
		if e.UserID != user.ID {
			continue
		}
		switch e.Type {
		case "model_tokens":
			totalTokens += e.Amount
		case "model_requests":
			totalRequests += e.Amount
		case "tool_calls":
			totalToolCalls += e.Amount
		case "browser_usage":
			totalBrowserUsage += e.Amount
		}
	}
	s.store.Mu.RUnlock()

	summary = gin.H{
		"model_tokens":     totalTokens,
		"model_requests":   totalRequests,
		"tool_calls":       totalToolCalls,
		"browser_usage":    totalBrowserUsage,
		"speed_multiplier": 1.0,
	}

	c.JSON(http.StatusOK, summary)
}

// GetModels handles GET /api/usage/models
func (s *Service) GetModels(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	s.store.Mu.RLock()
	modelUsage := make(map[string]int64)
	for _, e := range s.store.UsageEvents {
		if e.UserID != user.ID || e.Model == "" {
			continue
		}
		modelUsage[e.Model] += e.Amount
	}
	s.store.Mu.RUnlock()

	result := make([]gin.H, 0, len(modelUsage))
	for model, Tokens := range modelUsage {
		result = append(result, gin.H{
			"model":  model,
			"Tokens": Tokens,
		})
	}

	c.JSON(http.StatusOK, result)
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
