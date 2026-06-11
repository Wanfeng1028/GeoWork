package storage

import (
	"testing"
	"time"
)

func TestNewStore(t *testing.T) {
	s := NewStore("")
	if s == nil {
		t.Fatal("NewStore returned nil")
	}
	if !s.DBReady() {
		t.Fatal("expected DB to be ready")
	}
	if s.DBErr() != nil {
		t.Fatalf("unexpected DB error: %v", s.DBErr())
	}
	defer s.Close()

	if err := s.EnsureDefaults(); err != nil {
		t.Fatalf("failed to ensure defaults: %v", err)
	}
}

func TestUserCRUD(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	email := "test@example.com"
	_, err := s.GetUserByEmail(email)
	if err != nil {
		t.Fatal(err)
	}

	user := &User{
		ID:           "user_test_001",
		Email:        email,
		Name:         "Test User",
		Plan:         "free",
		PasswordHash: "sha256hash",
	}
	if err := s.CreateUser(user); err != nil {
		t.Fatal(err)
	}

	found, err := s.GetUserByEmail(email)
	if err != nil {
		t.Fatal(err)
	}
	if found == nil {
		t.Fatal("user not found")
	}
	if found.Name != "Test User" {
		t.Errorf("expected name 'Test User', got %q", found.Name)
	}

	// Update user
	found.Name = "Updated Name"
	found.Plan = "pro"
	if err := s.UpdateUser(found); err != nil {
		t.Fatal(err)
	}

	found2, err := s.GetUserByEmail(email)
	if err != nil {
		t.Fatal(err)
	}
	if found2.Name != "Updated Name" || found2.Plan != "pro" {
		t.Errorf("expected updated values, got name=%q plan=%q", found2.Name, found2.Plan)
	}
}

func TestTokenCRUD(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	// Create user first
	user := &User{
		ID:           "user_tok_001",
		Email:        "tok@example.com",
		Name:         "Tok User",
		Plan:         "free",
		PasswordHash: "hash",
	}
	if err := s.CreateUser(user); err != nil {
		t.Fatal(err)
	}

	token := &Token{
		ID:        "tok_001",
		UserID:    user.ID,
		Type:      "access",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}
	if err := s.CreateToken(token); err != nil {
		t.Fatal(err)
	}

	found, err := s.GetToken("tok_001")
	if err != nil {
		t.Fatal(err)
	}
	if found == nil || found.ID != "tok_001" {
		t.Fatal("token not found")
	}

	if err := s.DeleteToken("tok_001"); err != nil {
		t.Fatal(err)
	}
	_, err = s.GetToken("tok_001")
	if err == nil {
		t.Fatal("expected error after deletion")
	}
}

func TestTeamCRUD(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	// Create user
	user := &User{
		ID:           "user_team_001",
		Email:        "team@example.com",
		Name:         "Team User",
		Plan:         "free",
		PasswordHash: "hash",
	}
	if err := s.CreateUser(user); err != nil {
		t.Fatal(err)
	}

	team := &Team{
		ID:        "team_001",
		Name:      "Test Team",
		OwnerID:   user.ID,
		CreatedAt: time.Now(),
	}
	if err := s.CreateTeam(team); err != nil {
		t.Fatal(err)
	}

	found, err := s.GetTeam("team_001")
	if err != nil {
		t.Fatal(err)
	}
	if found == nil || found.Name != "Test Team" {
		t.Fatal("team not found or mismatch")
	}

	// Add team member
	if err := s.AddTeamMember(&TeamMember{
		TeamID: "team_001",
		UserID: user.ID,
		Role:   "owner",
	}); err != nil {
		t.Fatal(err)
	}

	members, err := s.ListTeamsByUser(user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(members) == 0 {
		t.Fatal("expected at least one team for user")
	}
}

func TestUsageEvent(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	user := &User{
		ID:           "user_usage_001",
		Email:        "usage@example.com",
		Name:         "Usage User",
		Plan:         "pro",
		PasswordHash: "hash",
	}
	if err := s.CreateUser(user); err != nil {
		t.Fatal(err)
	}

	event := &UsageEvent{
		ID:              "evt_usage_001",
		UserID:          user.ID,
		Type:            "model_tokens",
		Amount:          1000,
		Model:           "gpt-4",
		SpeedMultiplier: 2.0,
	}
	if err := s.AppendUsageEvent(event); err != nil {
		t.Fatal(err)
	}

	summary, err := s.GetUsageSummary(user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if summary["model_tokens"] != 1000 {
		t.Errorf("expected 1000 model_tokens, got %d", summary["model_tokens"])
	}
}

func TestSyncRecord(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	user := &User{
		ID:           "user_sync_001",
		Email:        "sync@example.com",
		Name:         "Sync User",
		Plan:         "pro",
		PasswordHash: "hash",
	}
	if err := s.CreateUser(user); err != nil {
		t.Fatal(err)
	}

	record := &SyncRecord{
		ID:         "sync_001",
		UserID:     user.ID,
		ObjectType: "settings",
		ObjectID:   "general",
		Data:       `{"theme": "dark"}`,
		Cursor:     1000,
	}
	if err := s.UpsertSyncRecord(record); err != nil {
		t.Fatal(err)
	}

	records, err := s.GetSyncRecordsAfter(user.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) == 0 {
		t.Fatal("expected at least one sync record")
	}

	cursor, err := s.GetSyncState(user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cursor != 1000 {
		t.Errorf("expected cursor 1000, got %d", cursor)
	}

	// Upsert again with higher cursor
	record2 := &SyncRecord{
		ID:         "sync_001",
		UserID:     user.ID,
		ObjectType: "settings",
		ObjectID:   "general",
		Data:       `{"theme": "light"}`,
		Cursor:     2000,
	}
	if err := s.UpsertSyncRecord(record2); err != nil {
		t.Fatal(err)
	}

	after2000, err := s.GetSyncRecordsAfter(user.ID, 1500)
	if err != nil {
		t.Fatal(err)
	}
	if len(after2000) != 1 || after2000[0].Data != `{"theme": "light"}` {
		t.Fatal("upsert should update existing record")
	}
}

func TestMarketplaceSeed(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	items, err := s.ListMarketplaceItems()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) < 5 {
		t.Fatalf("expected at least 5 marketplace items, got %d", len(items))
	}
}

func TestTelemetryAppend(t *testing.T) {
	s := NewStore("")
	defer s.Close()
	if err := s.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}

	user := &User{
		ID:           "user_tel_001",
		Email:        "tel@example.com",
		Name:         "Tel User",
		Plan:         "free",
		PasswordHash: "hash",
	}
	if err := s.CreateUser(user); err != nil {
		t.Fatal(err)
	}

	event := &TelemetryEvent{
		ID:     "tel_001",
		UserID: user.ID,
		Type:   "fps",
		Value:  59.5,
		Metadata: map[string]interface{}{
			"gpu": "integrated",
		},
	}
	if err := s.AppendTelemetryEvent(event); err != nil {
		t.Fatal(err)
	}
}

func TestCrashReport(t *testing.T) {
	s := NewStore("")
	defer s.Close()

	report := &CrashReport{
		ID:          "crash_001",
		AppVersion:  "v0.5.0",
		OS:          "windows",
		Message:     "panic: nil pointer",
		Stacktrace:  "main.go:42",
		HasMinidump: true,
		HasLogs:     true,
	}
	if err := s.AppendCrashReport(report); err != nil {
		t.Fatal(err)
	}
}
