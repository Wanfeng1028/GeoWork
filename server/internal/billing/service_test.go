package billing

import (
	"testing"
	"time"

	"server/internal/storage"
	"server/internal/testutil"
)

func seedBillingData(t *testing.T, store *storage.Store, userID string, credits float64) {
	t.Helper()
	bd := &storage.BillingData{
		UserID:  userID,
		Plan:    "free",
		Credits: credits,
	}
	if err := store.UpsertBillingData(bd); err != nil {
		t.Fatalf("UpsertBillingData: %v", err)
	}
}

func TestGetPlanInfo(t *testing.T) {
	tests := []struct {
		plan        string
		wantName    string
		wantCredits float64
	}{
		{"free", "Free", 10.0},
		{"pro", "Pro", 100.0},
		{"team", "Team", 500.0},
		{"unknown", "Free", 10.0}, // fallback to free
	}
	for _, tc := range tests {
		info := getPlanInfo(tc.plan)
		if info["name"] != tc.wantName {
			t.Errorf("getPlanInfo(%q)[name] = %v, want %q", tc.plan, info["name"], tc.wantName)
		}
		if info["credits"] != tc.wantCredits {
			t.Errorf("getPlanInfo(%q)[credits] = %v, want %v", tc.plan, info["credits"], tc.wantCredits)
		}
	}
}

func TestGetPlanPrice(t *testing.T) {
	tests := []struct {
		plan string
		want int
	}{
		{"free", 0},
		{"pro", 19},
		{"team", 49},
		{"unknown", 0},
	}
	for _, tc := range tests {
		got := getPlanPrice(tc.plan)
		if got != tc.want {
			t.Errorf("getPlanPrice(%q) = %d, want %d", tc.plan, got, tc.want)
		}
	}
}

func TestGetSpeedMultiplier(t *testing.T) {
	if m := getSpeedMultiplier("free"); m != 1.0 {
		t.Errorf("free speed = %f, want 1.0", m)
	}
	if m := getSpeedMultiplier("pro"); m != 2.0 {
		t.Errorf("pro speed = %f, want 2.0", m)
	}
	if m := getSpeedMultiplier("team"); m != 2.0 {
		t.Errorf("team speed = %f, want 2.0", m)
	}
}

func TestGetTeamSeats(t *testing.T) {
	if s := getTeamSeats("free"); s != 1 {
		t.Errorf("free seats = %d, want 1", s)
	}
	if s := getTeamSeats("team"); s != 10 {
		t.Errorf("team seats = %d, want 10", s)
	}
}

func TestCheckCredits_Sufficient(t *testing.T) {
	store := testutil.NewTestStore(t)
	_ = testutil.SeedTestUser(t, store)
	seedBillingData(t, store, "user_test_001", 100.0)

	billingData, err := store.GetBillingData("user_test_001")
	if err != nil {
		t.Fatalf("GetBillingData: %v", err)
	}
	if billingData == nil {
		t.Fatal("expected billing data")
	}

	sufficient := billingData.Credits >= 50.0
	if !sufficient {
		t.Error("expected sufficient credits")
	}
}

func TestCheckCredits_Insufficient(t *testing.T) {
	store := testutil.NewTestStore(t)
	_ = testutil.SeedTestUser(t, store)
	seedBillingData(t, store, "user_test_001", 10.0)

	billingData, _ := store.GetBillingData("user_test_001")
	sufficient := billingData.Credits >= 50.0
	if sufficient {
		t.Error("expected insufficient credits")
	}
}

func TestDeductCredits(t *testing.T) {
	store := testutil.NewTestStore(t)
	_ = testutil.SeedTestUser(t, store)
	seedBillingData(t, store, "user_test_001", 100.0)

	billingData, _ := store.GetBillingData("user_test_001")
	billingData.Credits -= 30.0
	billingData.UsageCost += 30.0
	if err := store.UpsertBillingData(billingData); err != nil {
		t.Fatalf("UpsertBillingData: %v", err)
	}

	updated, _ := store.GetBillingData("user_test_001")
	if updated.Credits != 70.0 {
		t.Errorf("credits = %f, want 70.0", updated.Credits)
	}
	if updated.UsageCost != 30.0 {
		t.Errorf("usage_cost = %f, want 30.0", updated.UsageCost)
	}
}

func TestGenerateInvoice(t *testing.T) {
	store := testutil.NewTestStore(t)
	_ = testutil.SeedTestUser(t, store)

	// Add usage events
	evt := &storage.UsageEvent{
		ID:     "evt1",
		UserID: "user_test_001",
		Type:   "model_tokens",
		Amount: 1000,
	}
	if err := store.AppendUsageEvent(evt); err != nil {
		t.Fatalf("AppendUsageEvent: %v", err)
	}

	// Create invoice
	now := time.Now()
	inv := &storage.Invoice{
		ID:          "inv_test_001",
		UserID:      "user_test_001",
		PeriodStart: now.AddDate(0, -1, 0),
		PeriodEnd:   now,
		Amount:      10.0,
		Currency:    "USD",
		Status:      "issued",
		LineItems:   `{"model_tokens":1000}`,
		DueDate:     now.AddDate(0, 0, 15),
	}
	if err := store.CreateInvoice(inv); err != nil {
		t.Fatalf("CreateInvoice: %v", err)
	}

	// Get invoice
	got, err := store.GetInvoice("inv_test_001", "user_test_001")
	if err != nil {
		t.Fatalf("GetInvoice: %v", err)
	}
	if got == nil {
		t.Fatal("expected invoice, got nil")
	}
	if got.Amount != 10.0 {
		t.Errorf("amount = %f, want 10.0", got.Amount)
	}
	if got.Status != "issued" {
		t.Errorf("status = %q, want 'issued'", got.Status)
	}
}

func TestGetInvoice_NotFound(t *testing.T) {
	store := testutil.NewTestStore(t)
	_ = testutil.SeedTestUser(t, store)

	got, err := store.GetInvoice("nonexistent", "user_test_001")
	if err != nil {
		t.Fatalf("GetInvoice: %v", err)
	}
	if got != nil {
		t.Error("expected nil for non-existent invoice")
	}
}

func TestGenerateID(t *testing.T) {
	id1 := generateID()
	id2 := generateID()
	if id1 == "" {
		t.Error("expected non-empty ID")
	}
	if id1 == id2 {
		t.Error("expected unique IDs")
	}
}
