package modelgateway

import (
	"errors"
	"testing"
)

func TestCostControllerCheckBudget(t *testing.T) {
	cases := []struct {
		name          string
		dailyBudget   float64
		monthlyBudget float64
		recorded      float64
		estimated     float64
		wantErr       bool
	}{
		{
			name:        "under budget allowed",
			dailyBudget: 1.0,
			recorded:    0.1,
			estimated:   0.1,
			wantErr:     false,
		},
		{
			name:        "estimate pushes over daily",
			dailyBudget: 1.0,
			recorded:    0.95,
			estimated:   0.1,
			wantErr:     true,
		},
		{
			name:        "exactly at daily limit allowed",
			dailyBudget: 1.0,
			recorded:    0.9,
			estimated:   0.1,
			wantErr:     false,
		},
		{
			name:          "over monthly budget",
			dailyBudget:   10.0,
			monthlyBudget: 0.5,
			recorded:      0.5,
			estimated:     0.1,
			wantErr:       true,
		},
		{
			name:        "zero daily budget disables daily check",
			dailyBudget: 0,
			recorded:    100.0,
			estimated:   1.0,
			wantErr:     false,
		},
		{
			name:          "zero monthly budget disables monthly check",
			dailyBudget:   0,
			monthlyBudget: 0,
			recorded:      100.0,
			estimated:     1.0,
			wantErr:       false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := NewCostController(tc.dailyBudget, tc.monthlyBudget)
			if tc.recorded > 0 {
				c.Record(tc.recorded)
			}
			err := c.CheckBudget(tc.estimated)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected budget error")
				}
				if !errors.Is(err, ErrBudgetExceeded) {
					t.Errorf("expected ErrBudgetExceeded, got %v", err)
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestCostControllerNilReceiver(t *testing.T) {
	var c *CostController
	if err := c.CheckBudget(1.0); err != nil {
		t.Errorf("nil receiver CheckBudget must return nil, got %v", err)
	}
	c.Record(1.0) // must not panic
	if got := c.DailySpend(); got != 0 {
		t.Errorf("nil receiver DailySpend = %v, want 0", got)
	}
	if got := c.MonthlySpend(); got != 0 {
		t.Errorf("nil receiver MonthlySpend = %v, want 0", got)
	}
}

func TestCostControllerRecordIgnoresNonPositive(t *testing.T) {
	c := NewCostController(1.0, 1.0)
	c.Record(0)
	c.Record(-5)
	if got := c.DailySpend(); got != 0 {
		t.Errorf("DailySpend = %v, want 0 after non-positive records", got)
	}
}

func TestCostControllerResetDailyKeepsMonthly(t *testing.T) {
	c := NewCostController(1.0, 10.0)
	c.Record(0.5)
	if c.DailySpend() != 0.5 || c.MonthlySpend() != 0.5 {
		t.Fatalf("spend not recorded: daily=%v monthly=%v", c.DailySpend(), c.MonthlySpend())
	}
	c.ResetDaily()
	if got := c.DailySpend(); got != 0 {
		t.Errorf("DailySpend after ResetDaily = %v, want 0", got)
	}
	if got := c.MonthlySpend(); got != 0.5 {
		t.Errorf("MonthlySpend must survive ResetDaily, got %v", got)
	}
}

func TestCostControllerResetMonthly(t *testing.T) {
	c := NewCostController(1.0, 10.0)
	c.Record(0.5)
	c.ResetMonthly()
	if got := c.MonthlySpend(); got != 0 {
		t.Errorf("MonthlySpend after ResetMonthly = %v, want 0", got)
	}
}
