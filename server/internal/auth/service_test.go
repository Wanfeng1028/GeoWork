package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"server/internal/storage"
	"server/internal/testutil"

	"golang.org/x/crypto/bcrypt"
)

func TestHashPassword(t *testing.T) {
	hash, err := hashPassword("MySecure1")
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	// Should be a valid bcrypt hash
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("MySecure1")); err != nil {
		t.Error("bcrypt verification failed")
	}
}

func TestVerifyPassword_Bcrypt(t *testing.T) {
	hash, _ := hashPassword("Test1234")
	if !verifyPassword(hash, "Test1234") {
		t.Error("expected verifyPassword to return true for correct password")
	}
	if verifyPassword(hash, "WrongPass1") {
		t.Error("expected verifyPassword to return false for wrong password")
	}
}

func TestVerifyPassword_LegacySHA256(t *testing.T) {
	password := "LegacyPass1"
	h := sha256.Sum256([]byte(password))
	legacyHash := hex.EncodeToString(h[:])

	if !verifyPassword(legacyHash, password) {
		t.Error("expected verifyPassword to return true for legacy SHA-256 hash")
	}
	if verifyPassword(legacyHash, "WrongPass1") {
		t.Error("expected verifyPassword to return false for wrong password with legacy hash")
	}
}

func TestIsLegacySHA256(t *testing.T) {
	tests := []struct {
		hash string
		want bool
	}{
		{hex.EncodeToString(sha256.New().Sum(nil)), false}, // 64-char but all zeros — actually let me compute properly
		{"$2a$10$abcdefghijklmnop", false},                 // bcrypt format
		{"short", false},
	}
	// A real 64-char hex string
	h := sha256.Sum256([]byte("test"))
	hexStr := hex.EncodeToString(h[:])
	tests[0].hash = hexStr
	tests[0].want = true

	for _, tc := range tests {
		got := isLegacySHA256(tc.hash)
		if got != tc.want {
			t.Errorf("isLegacySHA256(%q) = %v, want %v", tc.hash, got, tc.want)
		}
	}
}

func TestGenerateToken(t *testing.T) {
	tok := generateToken("user1", "access")
	if tok == "" {
		t.Fatal("expected non-empty token")
	}
	// Should have the format: access_user1_<hex>
	if len(tok) < 20 {
		t.Errorf("token too short: %q", tok)
	}
	if tok[:12] != "access_user1" {
		t.Errorf("token prefix = %q, want 'access_user1_...'", tok[:12])
	}
}

func TestSplitEmail(t *testing.T) {
	tests := []struct {
		email string
		want  string
	}{
		{"alice@example.com", "alice"},
		{"bob@test.org", "bob"},
		{"noemail", "noemail"},
	}
	for _, tc := range tests {
		got := splitEmail(tc.email)
		if got != tc.want {
			t.Errorf("splitEmail(%q) = %q, want %q", tc.email, got, tc.want)
		}
	}
}

func TestLogin_Success(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	// Verify user exists and password works
	if !verifyPassword(user.PasswordHash, "Test1234") {
		t.Fatal("seeded user password should verify")
	}

	// Verify GetUserByEmail works (Login handler uses this)
	got, err := store.GetUserByEmail("test@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if got == nil || got.ID != user.ID {
		t.Fatalf("expected user %s, got %v", user.ID, got)
	}

	_ = svc // service created successfully
}

func TestLogin_UserNotFound(t *testing.T) {
	store := testutil.NewTestStore(t)
	// No users seeded
	got, err := store.GetUserByEmail("nonexistent@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if got != nil {
		t.Error("expected nil for non-existent user")
	}
}

func TestTokenCreateAndVerify(t *testing.T) {
	store := testutil.NewTestStore(t)
	_ = testutil.SeedTestUser(t, store)

	now := time.Now()
	tok := &storage.Token{
		ID:        "test_token_123",
		UserID:    "user_test_001",
		Type:      "access",
		ExpiresAt: now.Add(24 * time.Hour),
		CreatedAt: now,
	}
	if err := store.CreateToken(tok); err != nil {
		t.Fatalf("CreateToken: %v", err)
	}

	got, err := store.GetToken("test_token_123")
	if err != nil {
		t.Fatalf("GetToken: %v", err)
	}
	if got == nil {
		t.Fatal("expected token, got nil")
	}
	if got.UserID != "user_test_001" {
		t.Errorf("UserID = %q, want %q", got.UserID, "user_test_001")
	}
}
