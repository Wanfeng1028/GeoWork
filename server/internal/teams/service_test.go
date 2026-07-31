package teams

import (
	"testing"
	"time"

	"server/internal/storage"
	"server/internal/testutil"
)

func createTestTeam(t *testing.T, store *storage.Store, ownerID string) *storage.Team {
	t.Helper()
	team := &storage.Team{
		ID:        "team_test_001",
		Name:      "Test Team",
		OwnerID:   ownerID,
		CreatedAt: time.Now(),
	}
	if err := store.CreateTeam(team); err != nil {
		t.Fatalf("CreateTeam: %v", err)
	}
	return team
}

func TestCreateTeam(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	team := createTestTeam(t, store, user.ID)

	got, err := store.GetTeam(team.ID)
	if err != nil {
		t.Fatalf("GetTeam: %v", err)
	}
	if got == nil {
		t.Fatal("expected team, got nil")
	}
	if got.Name != "Test Team" {
		t.Errorf("name = %q, want %q", got.Name, "Test Team")
	}
	if got.OwnerID != user.ID {
		t.Errorf("owner = %q, want %q", got.OwnerID, user.ID)
	}
}

func TestGetTeam(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	createTestTeam(t, store, user.ID)

	got, err := store.GetTeam("team_test_001")
	if err != nil {
		t.Fatalf("GetTeam: %v", err)
	}
	if got == nil {
		t.Fatal("expected team, got nil")
	}

	// Non-existent team
	none, err := store.GetTeam("nonexistent")
	if err != nil {
		t.Fatalf("GetTeam: %v", err)
	}
	if none != nil {
		t.Error("expected nil for non-existent team")
	}
}

func TestAddAndRemoveMember(t *testing.T) {
	store := testutil.NewTestStore(t)
	user1 := testutil.SeedTestUser(t, store)
	user2 := testutil.SeedSecondUser(t, store)
	createTestTeam(t, store, user1.ID)

	// Add owner as member
	if err := store.AddTeamMember(&storage.TeamMember{
		TeamID: "team_test_001", UserID: user1.ID, Role: "owner",
	}); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}

	// Add second user as member
	if err := store.AddTeamMember(&storage.TeamMember{
		TeamID: "team_test_001", UserID: user2.ID, Role: "member",
	}); err != nil {
		t.Fatalf("AddTeamMember: %v", err)
	}

	// Verify member exists
	member, err := store.GetTeamMember("team_test_001", user2.ID)
	if err != nil {
		t.Fatalf("GetTeamMember: %v", err)
	}
	if member == nil || member.Role != "member" {
		t.Fatalf("expected member with role 'member', got %+v", member)
	}

	// Remove member
	if err := store.RemoveTeamMember("team_test_001", user2.ID); err != nil {
		t.Fatalf("RemoveTeamMember: %v", err)
	}
	member, _ = store.GetTeamMember("team_test_001", user2.ID)
	if member != nil {
		t.Error("expected nil after removal")
	}
}

func TestTransferOwnership(t *testing.T) {
	store := testutil.NewTestStore(t)
	user1 := testutil.SeedTestUser(t, store)
	user2 := testutil.SeedSecondUser(t, store)
	createTestTeam(t, store, user1.ID)

	// Add both as members
	_ = store.AddTeamMember(&storage.TeamMember{TeamID: "team_test_001", UserID: user1.ID, Role: "owner"})
	_ = store.AddTeamMember(&storage.TeamMember{TeamID: "team_test_001", UserID: user2.ID, Role: "member"})

	// Transfer ownership
	if err := store.TransferTeamOwnership("team_test_001", user1.ID, user2.ID); err != nil {
		t.Fatalf("TransferTeamOwnership: %v", err)
	}

	// Verify new owner
	team, _ := store.GetTeam("team_test_001")
	if team.OwnerID != user2.ID {
		t.Errorf("owner = %q, want %q", team.OwnerID, user2.ID)
	}

	// Verify roles updated
	m1, _ := store.GetTeamMember("team_test_001", user1.ID)
	if m1.Role != "admin" {
		t.Errorf("old owner role = %q, want 'admin'", m1.Role)
	}
	m2, _ := store.GetTeamMember("team_test_001", user2.ID)
	if m2.Role != "owner" {
		t.Errorf("new owner role = %q, want 'owner'", m2.Role)
	}
}

func TestDeleteTeam(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	createTestTeam(t, store, user.ID)
	_ = store.AddTeamMember(&storage.TeamMember{TeamID: "team_test_001", UserID: user.ID, Role: "owner"})

	if err := store.SoftDeleteTeam("team_test_001"); err != nil {
		t.Fatalf("SoftDeleteTeam: %v", err)
	}

	// Team should still exist but with deleted marker
	team, _ := store.GetTeam("team_test_001")
	if team == nil {
		t.Fatal("team should still exist after soft delete")
	}
	if team.OwnerID != "__deleted__" {
		t.Errorf("owner = %q, want '__deleted__'", team.OwnerID)
	}

	// Members should be removed
	member, _ := store.GetTeamMember("team_test_001", user.ID)
	if member != nil {
		t.Error("expected nil member after team soft delete")
	}
}

func TestListTeamsByUser(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	createTestTeam(t, store, user.ID)
	_ = store.AddTeamMember(&storage.TeamMember{TeamID: "team_test_001", UserID: user.ID, Role: "owner"})

	teams, err := store.ListTeamsByUser(user.ID)
	if err != nil {
		t.Fatalf("ListTeamsByUser: %v", err)
	}
	if len(teams) != 1 {
		t.Errorf("expected 1 team, got %d", len(teams))
	}
}
