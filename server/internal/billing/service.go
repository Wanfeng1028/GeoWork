// Package billing provides plan, credits, and invoice management.
package billing

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

// GetPlan handles GET /api/billing/plan
func (s *Service) GetPlan(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	plan := user.Plan
	planInfo := getPlanInfo(plan)

	c.JSON(http.StatusOK, planInfo)
}

// GetCredits handles GET /api/billing/credits
func (s *Service) GetCredits(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	s.store.Mu.RLock()
	var credits float64
	for _, bd := range []*storage.BillingData{s.store.BillingData} {
		if bd.UserID == user.ID {
			credits = bd.Credits
			break
		}
	}
	s.store.Mu.RUnlock()

	// Default credits based on plan if no billing record exists
	if credits == 0 {
		switch user.Plan {
		case "pro":
			credits = 100.0
		case "team":
			credits = 500.0
		default:
			credits = 10.0
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"credits": credits,
		"plan":    user.Plan,
	})
}

// GetInvoices handles GET /api/billing/invoices
func (s *Service) GetInvoices(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	// Return billing history for the user
	s.store.Mu.RLock()
	var invoices []gin.H
	for _, evt := range s.store.UsageEvents {
		if evt.UserID == user.ID && evt.Type == "billing" {
			invoices = append(invoices, gin.H{
				"id":        evt.ID,
				"amount":    evt.Amount,
				"type":      evt.Type,
				"timestamp": evt.Timestamp,
			})
		}
	}
	s.store.Mu.RUnlock()

	if invoices == nil {
		invoices = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{
		"total":    len(invoices),
		"invoices": invoices,
	})
}

// CheckoutSession handles POST /api/billing/checkout-session
func (s *Service) CheckoutSession(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		Plan string `json:"plan" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Validate plan
	validPlans := map[string]bool{"free": true, "pro": true, "team": true}
	if !validPlans[req.Plan] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan: " + req.Plan})
		return
	}

	// Update user plan and credits
	s.store.Mu.Lock()
	oldPlan := user.Plan
	user.Plan = req.Plan
	user.UpdatedAt = time.Now()

	// Update credits based on new plan
	var newCredits float64
	switch req.Plan {
	case "pro":
		newCredits = 100.0
	case "team":
		newCredits = 500.0
	default:
		newCredits = 10.0
	}

	// Update or create billing record
	if s.store.BillingData == nil {
		s.store.BillingData = &storage.BillingData{
			UserID:  user.ID,
			Plan:    req.Plan,
			Credits: newCredits,
		}
	} else {
		s.store.BillingData.Plan = req.Plan
		s.store.BillingData.Credits = newCredits
	}

	// Record billing event
	s.store.UsageEvents = append(s.store.UsageEvents, &storage.UsageEvent{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		UserID:    user.ID,
		Type:      "billing",
		Amount:    int64(getPlanPrice(req.Plan)),
		Timestamp: time.Now(),
	})
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":       fmt.Sprintf("Plan updated from %s to %s", oldPlan, req.Plan),
		"plan":          req.Plan,
		"credits":       newCredits,
		"previous_plan": oldPlan,
	})
}

func getPlanPrice(plan string) int {
	prices := map[string]int{
		"free": 0,
		"pro":  19,
		"team": 49,
	}
	if p, ok := prices[plan]; ok {
		return p
	}
	return 0
}

func getPlanInfo(plan string) gin.H {
	plans := map[string]gin.H{
		"free": {
			"name":         "Free",
			"price":        0,
			"currency":     "USD",
			"credits":      10.0,
			"features":     []string{"local_mode", "basic_tools"},
			"limit_tokens": 100000,
		},
		"pro": {
			"name":         "Pro",
			"price":        19,
			"currency":     "USD",
			"credits":      100.0,
			"features":     []string{"local_mode", "advanced_tools", "cloud_sync", "priority_support"},
			"limit_tokens": 1000000,
		},
		"team": {
			"name":         "Team",
			"price":        49,
			"currency":     "USD",
			"credits":      500.0,
			"features":     []string{"local_mode", "all_tools", "cloud_sync", "team_collab", "priority_support"},
			"limit_tokens": 5000000,
		},
	}

	if info, ok := plans[plan]; ok {
		return info
	}
	return plans["free"]
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
