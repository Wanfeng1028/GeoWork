// Package billing provides plan, credits, and invoice management.
package billing

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

	// Placeholder: credits based on plan
	var credits float64
	switch user.Plan {
	case "pro":
		credits = 100.0
	case "team":
		credits = 500.0
	default:
		credits = 10.0
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

	// Placeholder: no real invoices yet
	c.JSON(http.StatusOK, []gin.H{})
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

	// Placeholder: update user plan
	s.store.Mu.Lock()
	if user.Plan != req.Plan {
		user.Plan = req.Plan
		user.UpdatedAt = time.Now()
	}
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "checkout placeholder - plan updated to " + req.Plan,
		"plan":    req.Plan,
	})
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
