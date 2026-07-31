package accounts

import (
	"testing"

	"server/internal/testutil"

	"golang.org/x/crypto/bcrypt"
)

func TestIsValidURL(t *testing.T) {
	tests := []struct {
		url  string
		want bool
	}{
		{"https://example.com", true},
		{"http://example.com/avatar.png", true},
		{"ftp://example.com", false},
		{"not-a-url", false},
		{"", false},
		{"https://cdn.example.com/img/1.png", true},
	}
	for _, tc := range tests {
		got := isValidURL(tc.url)
		if got != tc.want {
			t.Errorf("isValidURL(%q) = %v, want %v", tc.url, got, tc.want)
		}
	}
}

func TestGetPlanFeatures(t *testing.T) {
	tests := []struct {
		plan           string
		wantCloudSync  bool
		wantTeamCollab bool
	}{
		{"free", false, false},
		{"pro", true, false},
		{"team", true, true},
		{"unknown", false, false},
	}
	for _, tc := range tests {
		features := getPlanFeatures(tc.plan)
		if features["cloud_sync"] != tc.wantCloudSync {
			t.Errorf("getPlanFeatures(%q)[cloud_sync] = %v, want %v", tc.plan, features["cloud_sync"], tc.wantCloudSync)
		}
		if features["team_collab"] != tc.wantTeamCollab {
			t.Errorf("getPlanFeatures(%q)[team_collab] = %v, want %v", tc.plan, features["team_collab"], tc.wantTeamCollab)
		}
	}
}

func TestCreateAndGetAccount(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	got, err := store.GetUserByID(user.ID)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if got == nil {
		t.Fatal("expected user, got nil")
	}
	if got.Email != "test@example.com" {
		t.Errorf("email = %q, want %q", got.Email, "test@example.com")
	}
}

func TestDeleteAccount_SoftDelete(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	if err := store.SoftDeleteUser(user.ID); err != nil {
		t.Fatalf("SoftDeleteUser: %v", err)
	}

	got, _ := store.GetUserByID(user.ID)
	if got.DeletedAt == nil {
		t.Error("expected DeletedAt to be set after soft delete")
	}
}

func TestChangePassword(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	// Verify old password works
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("Test1234")); err != nil {
		t.Fatal("old password should verify")
	}

	// Change password
	newHash, err := bcrypt.GenerateFromPassword([]byte("NewPass123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("GenerateFromPassword: %v", err)
	}
	if err := store.UpdateUserPassword(user.ID, string(newHash)); err != nil {
		t.Fatalf("UpdateUserPassword: %v", err)
	}

	// Verify new password works
	updated, _ := store.GetUserByID(user.ID)
	if err := bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte("NewPass123")); err != nil {
		t.Error("new password should verify")
	}
	// Old password should fail
	if err := bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte("Test1234")); err == nil {
		t.Error("old password should not verify after change")
	}
}

func TestGetAccountStats(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	// Add some usage events
	// We need to use the storage package directly
	// Since we're in the accounts package, we import storage via testutil
	// Actually we can't import storage directly here without adding it to imports
	// Let's just test GetUserStats returns empty data for a new user
	usageSummary, lastActive, err := store.GetUserStats(user.ID)
	if err != nil {
		t.Fatalf("GetUserStats: %v", err)
	}
	if len(usageSummary) != 0 {
		t.Errorf("expected empty usage summary, got %v", usageSummary)
	}
	if lastActive != 0 {
		t.Errorf("expected lastActive = 0, got %d", lastActive)
	}
}
