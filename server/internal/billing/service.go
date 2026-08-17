// Package billing provides plan, credits, and invoice management.
package billing

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"server/internal/apierrors"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

// PaymentProvider is the interface for external payment integrations (e.g. Stripe).
type PaymentProvider interface {
	CreateCheckoutSession(planID string, userID string) (string, error)
	HandleWebhook(payload []byte, signature string) error
	GetSubscriptionStatus(userID string) (string, error)
}

type Service struct {
	store   *storage.Store
	payment PaymentProvider // optional, nil for mock mode
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// SetPaymentProvider sets an optional payment provider for production use.
func (s *Service) SetPaymentProvider(p PaymentProvider) {
	s.payment = p
}

// GetPlan handles GET /api/billing/plan
func (s *Service) GetPlan(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	plan := user.Plan
	planInfo := getPlanInfo(plan)
	c.JSON(http.StatusOK, planInfo)
}

// GetUsage handles GET /api/billing/usage
func (s *Service) GetUsage(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
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
		"credits":    credits,
		"plan":       plan,
		"usage":      summary,
		"speed_mult": getSpeedMultiplier(user.Plan),
		"team_seats": getTeamSeats(user.Plan),
	})
}

// GetCredits handles GET /api/billing/credits
func (s *Service) GetCredits(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
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
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	invoices, err := s.store.ListInvoicesByUser(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	// If no invoices in the new table, fall back to usage events for backward compatibility
	if len(invoices) == 0 {
		events, err := s.store.GetUsageByUser(user.ID)
		if err != nil {
			apierrors.Respond(c, apierrors.ErrInternal)
			return
		}
		var legacyInvoices []gin.H
		for _, evt := range events {
			if evt.Type == "billing" {
				legacyInvoices = append(legacyInvoices, gin.H{
					"id":        evt.ID,
					"amount":    evt.Amount,
					"type":      evt.Type,
					"timestamp": evt.Timestamp,
				})
			}
		}
		if legacyInvoices == nil {
			legacyInvoices = []gin.H{}
		}
		c.JSON(http.StatusOK, gin.H{
			"total":    len(legacyInvoices),
			"invoices": legacyInvoices,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":    len(invoices),
		"invoices": invoices,
	})
}

// GetInvoice handles GET /api/billing/invoices/:id
func (s *Service) GetInvoice(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	invoiceID := c.Param("id")
	if invoiceID == "" {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	invoice, err := s.store.GetInvoice(invoiceID, user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}
	if invoice == nil {
		apierrors.Respond(c, apierrors.ErrNotFound)
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// GenerateInvoice handles POST /api/billing/invoices/generate
func (s *Service) GenerateInvoice(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Month int `json:"month"` // 1-12, defaults to previous month
		Year  int `json:"year"`  // defaults to current year
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// Default to previous month
		now := time.Now()
		req.Month = int(now.Month()) - 1
		req.Year = now.Year()
		if req.Month <= 0 {
			req.Month = 12
			req.Year--
		}
	}

	// Calculate period
	periodStart := time.Date(req.Year, time.Month(req.Month), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0)

	// Aggregate usage events for this period
	events, err := s.store.GetUsageByUser(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	// Filter events within the period and calculate totals
	typeUsage := make(map[string]int64)
	var totalAmount int64
	for _, evt := range events {
		if evt.Timestamp.Before(periodStart) || !evt.Timestamp.Before(periodEnd) {
			continue
		}
		typeUsage[evt.Type] += evt.Amount
		totalAmount += evt.Amount
	}

	// Calculate cost based on usage (simplified: 1 credit per 100 units)
	cost := float64(totalAmount) / 100.0
	if cost < 0.01 {
		cost = 0.01 // minimum charge
	}

	lineItems, _ := json.Marshal(typeUsage)

	invoice := &storage.Invoice{
		ID:          generateID(),
		UserID:      user.ID,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		Amount:      cost,
		Currency:    "USD",
		Status:      "issued",
		LineItems:   string(lineItems),
		DueDate:     periodEnd.AddDate(0, 0, 15), // 15 days after period end
	}

	if err := s.store.CreateInvoice(invoice); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"invoice":     invoice,
		"period":      fmt.Sprintf("%d-%02d", req.Year, req.Month),
		"total_usage": totalAmount,
		"amount_due":  cost,
	})
}

// CheckCredits handles POST /api/billing/credits/check
func (s *Service) CheckCredits(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Amount float64 `json:"amount" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	billingData, err := s.store.GetBillingData(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	currentCredits := 0.0
	if billingData != nil {
		currentCredits = billingData.Credits
	}

	sufficient := currentCredits >= req.Amount

	c.JSON(http.StatusOK, gin.H{
		"sufficient":      sufficient,
		"current_credits": currentCredits,
		"requested":       req.Amount,
		"remaining":       currentCredits - req.Amount,
	})
}

// DeductCredits handles POST /api/billing/credits/deduct
func (s *Service) DeductCredits(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Amount float64 `json:"amount" binding:"required"`
		Reason string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	if req.Amount <= 0 {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "amount must be positive")
		return
	}

	billingData, err := s.store.GetBillingData(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	currentCredits := 0.0
	plan := user.Plan
	if billingData != nil {
		currentCredits = billingData.Credits
	} else {
		billingData = &storage.BillingData{
			UserID: user.ID,
			Plan:   plan,
		}
	}

	if currentCredits < req.Amount {
		apierrors.RespondWithMessage(c, apierrors.New(http.StatusPaymentRequired, "INSUFFICIENT_CREDITS", "insufficient credits"), fmt.Sprintf("need %.2f, have %.2f", req.Amount, currentCredits))
		return
	}

	billingData.Credits = currentCredits - req.Amount
	billingData.UsageCost += req.Amount
	if err := s.store.UpsertBillingData(billingData); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "credits deducted",
		"amount_deducted": req.Amount,
		"remaining":       billingData.Credits,
		"reason":          req.Reason,
	})
}

// CheckoutSession handles POST /api/billing/checkout/mock
func (s *Service) CheckoutSession(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Plan string `json:"plan" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	validPlans := map[string]bool{"free": true, "pro": true, "team": true}
	if !validPlans[req.Plan] {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid plan: "+req.Plan)
		return
	}

	// If a real payment provider is configured, use it
	if s.payment != nil {
		sessionURL, err := s.payment.CreateCheckoutSession(req.Plan, user.ID)
		if err != nil {
			apierrors.Respond(c, apierrors.ErrInternal)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"checkout_url": sessionURL,
			"plan":         req.Plan,
		})
		return
	}

	// Mock mode: directly update plan. Gated behind GEOWORK_BILLING_MOCK=1
	// (doc/25 S1): without the gate any authenticated user could self-upgrade
	// to team and mint credits. 404 (not 403) so the endpoint is invisible
	// when disabled.
	if os.Getenv("GEOWORK_BILLING_MOCK") != "1" {
		apierrors.Respond(c, apierrors.ErrNotFound)
		return
	}

	oldPlan := user.Plan
	user.Plan = req.Plan
	if err := s.store.UpdateUser(user); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	newCredits := float64(getPlanPrice(req.Plan)) * 10.0
	billing := &storage.BillingData{
		UserID:  user.ID,
		Plan:    req.Plan,
		Credits: newCredits,
	}
	if err := s.store.UpsertBillingData(billing); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
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

// generateID generates a random hex ID.
func generateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}
