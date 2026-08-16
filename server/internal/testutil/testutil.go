// Package testutil provides shared helpers for server unit tests.
package testutil

import (
	"testing"
	"time"

	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// NewTestStore creates a temporary in-memory SQLite store for testing.
// The store is automatically closed when the test finishes.
func NewTestStore(t testing.TB) *storage.Store {
	t.Helper()
	store := storage.NewStore("")
	if !store.DBReady() {
		t.Fatalf("failed to create test store: %v", store.DBErr())
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

// SeedTestUser inserts a test user into the store and returns it.
// The user has email "test@example.com", name "Test User", plan "free",
// and password hash for password "Test1234".
func SeedTestUser(t testing.TB, store *storage.Store) *storage.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("Test1234"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	user := &storage.User{
		ID:           "user_test_001",
		Email:        "test@example.com",
		Name:         "Test User",
		Plan:         "free",
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	if err := store.CreateUser(user); err != nil {
		t.Fatalf("failed to seed test user: %v", err)
	}
	return user
}

// SeedSecondUser inserts a second test user (useful for team tests).
func SeedSecondUser(t testing.TB, store *storage.Store) *storage.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("Test5678"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	user := &storage.User{
		ID:           "user_test_002",
		Email:        "test2@example.com",
		Name:         "Test User 2",
		Plan:         "free",
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	if err := store.CreateUser(user); err != nil {
		t.Fatalf("failed to seed second test user: %v", err)
	}
	return user
}

// NewTestRouter creates a Gin engine with standard routes wired up for HTTP testing.
// This is useful for integration-style tests that exercise handler methods.
func NewTestRouter(store *storage.Store) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	return r
}

// NewAuthedRouter creates a Gin engine whose every request is pre-authenticated
// as the given user, bypassing JWT middleware for handler-level tests.
func NewAuthedRouter(user *storage.User) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		servercontext.SetUser(c, user)
		c.Next()
	})
	return r
}
