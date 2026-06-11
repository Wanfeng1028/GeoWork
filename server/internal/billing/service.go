// Package billing provides plan, credits, and invoice management.
package billing

import (
	"fmt"
	"net/http"

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

// GetUsage handles GET /api/billing/usage
func (s *Service) GetUsage(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	// Get usage summary
	summary, _ := s.store.GetUsageSummary(user.ID)

	// Get billing data
	billingData, _ := s.store.GetBillingData(user.ID)
	credits := 0.0
	plan := user.Plan
	if billingData != nil {
		credits = billingData.Credits
		plan = billingData.Plan
	}

	c.JSON(http.StatusOK, gin.H{
		"credits":     credits,
		"plan":        plan,
		"usage":       summary,
		"speed_mult":  getSpeedMultiplier(user.Plan),
		"team_seats":  getTeamSeats(user.Plan),
	})
}

// GetCredits handles GET /api/billing/credits
func (s *Service) GetCredits(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	billingData, _ := s.store.GetBillingData(user.ID)
	credits := 0.0
	if billingData != nil {
		credits = billingData.Credits
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

	events, err := s.store.GetUsageByUser(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	var invoices []gin.H
	for _, evt := range events {
		if evt.Type == "billing" {
			invoices = append(invoices, gin.H{
				"id":        evt.ID,
				"amount":    evt.Amount,
				"type":      evt.Type,
				"timestamp": evt.Timestamp,
			})
		}
	}
	if invoices == nil {
		invoices = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{
		"total":    len(invoices),
		"invoices": invoices,
	})
}

// CheckoutSession handles POST /api/billing/checkout/mock
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

	validPlans := map[string]bool{"free": true, "pro": true, "team": true}
	if !validPlans[req.Plan] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan: " + req.Plan})
		return
	}

	oldPlan := user.Plan
	user.Plan = req.Plan
	if err := s.store.UpdateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update plan"})
		return
	}

	newCredits := float64(getPlanPrice(req.Plan)) * 10.0
	billing := &storage.BillingData{
		UserID:  user.ID,
		Plan:    req.Plan,
		Credits: newCredits,
	}
	if err := s.store.UpsertBillingData(billing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update billing"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       fmt.Sprintf("Plan updated from %s to %s", oldPlan, req.Plan),
		"plan":          req.Plan,
		"credits":       newCredits,
		"previous_plan": oldPlan,
	})
}

func getPlanPrice(plan string) int {
	prices := map[string]int{"free": 0, "pro": 19, "team": 49}
	if p, ok := prices[plan]; ok {
		return p
	}
	return 0
}

func getSpeedMultiplier(plan string) float64 {
	switch plan {
	case "pro", "team":
		return 2.0
	default:
		return 1.0
	}
}

func getTeamSeats(plan string) int {
	switch plan {
	case "team":
		return 10
	default:
		return 1
	}
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
