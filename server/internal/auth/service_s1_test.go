// doc/25 S1 regression tests: soft-deleted users must lose all auth paths,
// and expired tokens must be garbage-collected.
package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"server/internal/storage"
	"server/internal/testutil"

	"github.com/gin-gonic/gin"
)

func softDelete(t *testing.T, store *storage.Store, userID string) {
	t.Helper()
	if err := store.SoftDeleteUser(userID); err != nil {
		t.Fatalf("failed to soft-delete user: %v", err)
	}
}

// loginToken issues a real token for a user before they are soft-deleted.
func loginToken(t *testing.T, store *storage.Store) string {
	t.Helper()
	svc := NewService(store)
	r := newLoginRouter(svc)
	w := doLogin(r, "test@example.com", "Test1234")
	if w.Code != http.StatusOK {
		t.Fatalf("setup login failed: %d %s", w.Code, w.Body.String())
	}
	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	return resp.AccessToken
}

func TestLogin_SoftDeletedUser_Rejected(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	softDelete(t, store, user.ID)

	svc := NewService(store)
	r := newLoginRouter(svc)

	w := doLogin(r, "test@example.com", "Test1234")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("soft-deleted user login: status = %d, want %d; body: %s",
			w.Code, http.StatusUnauthorized, w.Body.String())
	}
}

func TestMiddleware_SoftDeletedUser_Rejected(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	token := loginToken(t, store)
	softDelete(t, store, user.ID)

	svc := NewService(store)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/protected", svc.Middleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("soft-deleted user via middleware: status = %d, want %d; body: %s",
			w.Code, http.StatusUnauthorized, w.Body.String())
	}
}

func TestRefresh_SoftDeletedUser_Rejected(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	// Issue a refresh token via login, then soft-delete.
	svc := NewService(store)
	r := newLoginRouter(svc)
	w := doLogin(r, "test@example.com", "Test1234")
	if w.Code != http.StatusOK {
		t.Fatalf("setup login failed: %d", w.Code)
	}
	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	softDelete(t, store, user.ID)

	gin.SetMode(gin.TestMode)
	rr := gin.New()
	rr.POST("/api/auth/refresh", svc.Refresh)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+resp.RefreshToken)
	rw := httptest.NewRecorder()
	rr.ServeHTTP(rw, req)

	if rw.Code != http.StatusUnauthorized {
		t.Fatalf("soft-deleted user refresh: status = %d, want %d; body: %s",
			rw.Code, http.StatusUnauthorized, rw.Body.String())
	}
}

func TestDeleteExpiredTokens_PurgesOnlyExpired(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	now := time.Now()
	expired := &storage.Token{
		ID: "access_expired_1", UserID: user.ID, Type: "access",
		ExpiresAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-25 * time.Hour),
	}
	fresh := &storage.Token{
		ID: "access_fresh_1", UserID: user.ID, Type: "access",
		ExpiresAt: now.Add(24 * time.Hour), CreatedAt: now,
	}
	for _, tok := range []*storage.Token{expired, fresh} {
		if err := store.CreateToken(tok); err != nil {
			t.Fatalf("seed token: %v", err)
		}
	}

	deleted, err := store.DeleteExpiredTokens(now.Unix())
	if err != nil {
		t.Fatalf("DeleteExpiredTokens: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted = %d, want 1", deleted)
	}

	if got, _ := store.GetToken(expired.ID); got != nil {
		t.Error("expired token survived GC")
	}
	if got, _ := store.GetToken(fresh.ID); got == nil {
		t.Error("fresh token was wrongly purged")
	}
}
