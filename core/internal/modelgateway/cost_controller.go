// GeoWork Go Core - Cost Controller (P2-5 §6.4)
//
// CostController tracks daily + monthly spend against configurable
// budgets. CheckBudget is called before a model call to gate it;
// Record is called after a successful call to accrue the actual cost.
//
// The budgets reset on a calendar-day / calendar-month boundary. This
// is approximate (we don't track the timezone of "daily"); production
// deployments that need precise reset windows should wrap this with a
// scheduler that calls ResetDaily at local midnight.

package modelgateway

import (
	"fmt"
	"sync"
	"time"
)

// CostController enforces daily + monthly token-cost budgets.
type CostController struct {
	mu sync.Mutex

	dailyBudget   float64
	monthlyBudget float64

	currentDaily   float64
	currentMonthly float64

	dayReset   time.Time // when currentDaily was last reset
	monthReset time.Time // when currentMonthly was last reset
}

// NewCostController constructs a controller. Pass 0 for a budget to
// disable that check (a 0 daily budget means "no daily limit").
func NewCostController(dailyBudget, monthlyBudget float64) *CostController {
	now := time.Now()
	return &CostController{
		dailyBudget:   dailyBudget,
		monthlyBudget: monthlyBudget,
		dayReset:      now,
		monthReset:    now,
	}
}

// CheckBudget returns ErrBudgetExceeded if adding `estimated` dollars
// to the running daily total would exceed the daily budget (when set),
// or if the monthly total already exceeds the monthly budget (when set).
// A nil error means the call is allowed.
func (c *CostController) CheckBudget(estimated float64) error {
	if c == nil {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	c.maybeResetLocked()

	if c.dailyBudget > 0 && c.currentDaily+estimated > c.dailyBudget {
		return fmt.Errorf("%w: daily %.2f + %.4f > %.2f",
			ErrBudgetExceeded, c.currentDaily, estimated, c.dailyBudget)
	}
	if c.monthlyBudget > 0 && c.currentMonthly+estimated > c.monthlyBudget {
		return fmt.Errorf("%w: monthly %.2f + %.4f > %.2f",
			ErrBudgetExceeded, c.currentMonthly, estimated, c.monthlyBudget)
	}
	return nil
}

// Record accrues actual cost from a completed call. Called by the
// router after a successful Chat/StreamChat.
func (c *CostController) Record(cost float64) {
	if c == nil || cost <= 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.maybeResetLocked()
	c.currentDaily += cost
	c.currentMonthly += cost
}

// DailySpend returns the current daily total (since last reset).
func (c *CostController) DailySpend() float64 {
	if c == nil {
		return 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.maybeResetLocked()
	return c.currentDaily
}

// MonthlySpend returns the current monthly total.
func (c *CostController) MonthlySpend() float64 {
	if c == nil {
		return 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.maybeResetLocked()
	return c.currentMonthly
}

// ResetDaily zeroes the daily counter. Exposed so a scheduler can call
// it at local midnight; also called internally when a day has elapsed.
func (c *CostController) ResetDaily() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.currentDaily = 0
	c.dayReset = time.Now()
}

// ResetMonthly zeroes the monthly counter.
func (c *CostController) ResetMonthly() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.currentMonthly = 0
	c.monthReset = time.Now()
}

// maybeResetLocked auto-resets counters when their window has elapsed.
// Must be called with c.mu held.
func (c *CostController) maybeResetLocked() {
	now := time.Now()
	if now.Sub(c.dayReset) >= 24*time.Hour {
		c.currentDaily = 0
		c.dayReset = now
	}
	// Approximate month as 30 days for the auto-reset; the scheduler
	// is expected to call ResetMonthly on the 1st for precision.
	if now.Sub(c.monthReset) >= 30*24*time.Hour {
		c.currentMonthly = 0
		c.monthReset = now
	}
}
