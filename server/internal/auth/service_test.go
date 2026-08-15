package auth

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"server/internal/storage"
	"server/internal/testutil"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// newLoginRouter wires the Login handler onto a Gin engine in test mode so the
// handler can be exercised end-to-end over HTTP.
func newLoginRouter(svc *Service) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/auth/login", svc.Login)
	return r
}

// doLogin posts a login request and returns the recorded response.
func doLogin(r *gin.Engine, email, password string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(LoginRequest{Email: email, Password: password})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

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
	sum := sha256.Sum256([]byte("test"))
	realHex := hex.EncodeToString(sum[:])
	tests := []struct {
		name string
		hash string
		want bool
	}{
		{"real 64-char hex", realHex, true},
		{"bcrypt format", "$2a$10$abcdefghijklmnop", false},
		{"too short", "short", false},
		{"64 chars but non-hex", string(make([]byte, 64)), false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isLegacySHA256(tc.hash); got != tc.want {
				t.Errorf("isLegacySHA256(%q) = %v, want %v", tc.hash, got, tc.want)
			}
		})
	}
}

func TestGenerateToken(t *testing.T) {
	tok := generateToken("user1", "access")
	if tok == "" {
		t.Fatal("expected non-empty token")
	}
	// Token must embed its type and owner so it can be routed back to the user.
	if got, want := tok[:12], "access_user1"; got != want {
		t.Errorf("token prefix = %q, want %q", got, want)
	}
	// Two tokens for the same user must differ (random suffix).
	if tok == generateToken("user1", "access") {
		t.Error("expected distinct tokens for repeated generation")
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
		if got := splitEmail(tc.email); got != tc.want {
			t.Errorf("splitEmail(%q) = %q, want %q", tc.email, got, tc.want)
		}
	}
}

// TestLogin_Success exercises the Login handler over HTTP with a seeded user and
// asserts the full success contract: 200, tokens issued, user echoed without the
// password hash, and both tokens persisted in the store.
func TestLogin_Success(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "test@example.com", "Test1234")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v; body: %s", err, w.Body.String())
	}

	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Fatalf("expected access and refresh tokens, got %+v", resp)
	}
	if resp.User == nil || resp.User.ID != user.ID {
		t.Fatalf("expected user %s in response, got %+v", user.ID, resp.User)
	}
	if resp.User.PasswordHash != "" {
		t.Error("password hash must not be exposed in the login response")
	}

	// Both tokens must be persisted and retrievable.
	for _, tok := range []string{resp.AccessToken, resp.RefreshToken} {
		got, err := store.GetToken(tok)
		if err != nil || got == nil {
			t.Errorf("token %q not persisted: %v", tok, err)
			continue
		}
		if got.UserID != user.ID {
			t.Errorf("token %q belongs to %q, want %q", tok, got.UserID, user.ID)
		}
	}
}

// TestLogin_WrongPassword verifies that a bad password is rejected with 401 and
// no session tokens are created.
func TestLogin_WrongPassword(t *testing.T) {
	store := testutil.NewTestStore(t)
	testutil.SeedTestUser(t, store)
	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "test@example.com", "WrongPass1")

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusUnauthorized, w.Body.String())
	}
}

// TestLogin_UserNotFound verifies that an unknown email is rejected with 401 when
// auto-registration is disabled (the default).
func TestLogin_UserNotFound(t *testing.T) {
	store := testutil.NewTestStore(t)
	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "nobody@example.com", "Test1234")

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusUnauthorized, w.Body.String())
	}
}

// TestLogin_InvalidEmail verifies that a malformed email is rejected with 400
// before any store lookup occurs.
func TestLogin_InvalidEmail(t *testing.T) {
	store := testutil.NewTestStore(t)
	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "not-an-email", "Test1234")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}

// TestLogin_AutoRegister verifies that when GEOWORK_AUTO_REGISTER_ENABLED is set,
// logging in with an unknown email creates the account and issues tokens.
func TestLogin_AutoRegister(t *testing.T) {
	t.Setenv("GEOWORK_AUTO_REGISTER_ENABLED", "true")

	store := testutil.NewTestStore(t)
	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "newuser@example.com", "StrongPass1")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.User == nil || resp.User.Email != "newuser@example.com" {
		t.Fatalf("expected auto-registered user, got %+v", resp.User)
	}
	if resp.User.Plan != "free" {
		t.Errorf("auto-registered plan = %q, want %q", resp.User.Plan, "free")
	}

	// The user must now exist in the store.
	created, err := store.GetUserByEmail("newuser@example.com")
	if err != nil || created == nil {
		t.Fatalf("auto-registered user not persisted: %v", err)
	}
}

// TestLogin_LegacyHashMigratesToBcrypt verifies that logging in with a legacy
// SHA-256 hash transparently upgrades the stored hash to bcrypt.
func TestLogin_LegacyHashMigratesToBcrypt(t *testing.T) {
	store := testutil.NewTestStore(t)

	password := "LegacyPass1"
	h := sha256.Sum256([]byte(password))
	legacyHash := hex.EncodeToString(h[:])

	user := &storage.User{
		ID:           "user_legacy_001",
		Email:        "legacy@example.com",
		Name:         "Legacy User",
		Plan:         "free",
		PasswordHash: legacyHash,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	if err := store.CreateUser(user); err != nil {
		t.Fatalf("failed to seed legacy user: %v", err)
	}

	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "legacy@example.com", password)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	// After login the stored hash should be bcrypt, not the legacy hex string.
	updated, err := store.GetUserByEmail("legacy@example.com")
	if err != nil || updated == nil {
		t.Fatalf("failed to reload user: %v", err)
	}
	if isLegacySHA256(updated.PasswordHash) {
		t.Error("expected legacy hash to be migrated to bcrypt, still legacy")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte(password)); err != nil {
		t.Errorf("migrated hash does not verify against original password: %v", err)
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
