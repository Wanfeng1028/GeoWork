// doc/25 S2 regression tests: modelproxy providers must persist to SQLite
// (survive restart) and Chat/Stream must read provider_id from the body.
package modelproxy

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"server/internal/storage"
	"server/internal/testutil"
)

func addProviderViaHandler(t *testing.T, svc *Service, user *storage.User, id, name, baseURL string) *httptest.ResponseRecorder {
	t.Helper()
	r := testutil.NewAuthedRouter(user)
	r.POST("/api/model/providers", svc.AddProvider)

	body, _ := json.Marshal(ProviderConfig{ID: id, Name: name, BaseURL: baseURL, APIKey: "sk-test"})
	req := httptest.NewRequest(http.MethodPost, "/api/model/providers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// TestAddProvider_PersistsToSQLite pins the doc/25 S2 fix: a provider added
// through the API must land in the model_providers table, so a fresh
// NewService (simulating a restart) can reload it.
func TestAddProvider_PersistsToSQLite(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	w := addProviderViaHandler(t, svc, user, "openai", "OpenAI", "https://api.openai.com")
	if w.Code != http.StatusCreated {
		t.Fatalf("AddProvider: status = %d, body = %s", w.Code, w.Body.String())
	}

	// Row must exist in SQLite.
	row, err := store.GetModelProvider(user.ID + "_openai")
	if err != nil {
		t.Fatalf("GetModelProvider: %v", err)
	}
	if row == nil {
		t.Fatal("provider not persisted to SQLite — restart would lose it (doc/25 S2 regression)")
	}
	if row.BaseURL != "https://api.openai.com" {
		t.Errorf("persisted base_url = %q", row.BaseURL)
	}

	// Simulate a restart: a brand-new service must reload the provider.
	svc2 := NewService(store)
	svc2.mu.RLock()
	_, ok := svc2.providers[user.ID+"_openai"]
	svc2.mu.RUnlock()
	if !ok {
		t.Error("fresh NewService did not reload persisted provider")
	}
}

// TestDeleteProvider_RemovesFromSQLite verifies delete also clears the row.
func TestDeleteProvider_RemovesFromSQLite(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	addProviderViaHandler(t, svc, user, "openai", "OpenAI", "https://api.openai.com")

	r := testutil.NewAuthedRouter(user)
	r.DELETE("/api/model/providers/:id", svc.DeleteProvider)
	req := httptest.NewRequest(http.MethodDelete, "/api/model/providers/"+user.ID+"_openai", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteProvider: status = %d, body = %s", w.Code, w.Body.String())
	}

	row, _ := store.GetModelProvider(user.ID + "_openai")
	if row != nil {
		t.Error("provider row survived delete")
	}
}

// TestChat_MissingProviderID pins the doc/25 S2 fix: Chat must reject a
// request lacking provider_id in the body with 400 (previously it read a
// context key nothing ever set, so EVERY request was a 400).
func TestChat_MissingProviderID(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	r := testutil.NewAuthedRouter(user)
	r.POST("/api/model/chat", svc.Chat)

	body, _ := json.Marshal(map[string]any{"model": "gpt-4"}) // no provider_id
	req := httptest.NewRequest(http.MethodPost, "/api/model/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Chat without provider_id: status = %d, want %d; body = %s",
			w.Code, http.StatusBadRequest, w.Body.String())
	}
}

// TestChat_UnknownProvider verifies a provider_id that names no registered
// provider yields 404 (routing works; the provider just doesn't exist).
func TestChat_UnknownProvider(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	r := testutil.NewAuthedRouter(user)
	r.POST("/api/model/chat", svc.Chat)

	body, _ := json.Marshal(map[string]any{"model": "gpt-4", "provider_id": "nope"})
	req := httptest.NewRequest(http.MethodPost, "/api/model/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("Chat with unknown provider: status = %d, want %d; body = %s",
			w.Code, http.StatusNotFound, w.Body.String())
	}
}
