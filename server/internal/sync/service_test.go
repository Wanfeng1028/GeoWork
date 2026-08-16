// Package sync tests for the multi-device sync protocol handlers.
package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"server/internal/storage"
	"server/internal/testutil"

	"github.com/gin-gonic/gin"
)

func newSyncRouter(t *testing.T, store *storage.Store, user *storage.User) *gin.Engine {
	t.Helper()
	r := testutil.NewAuthedRouter(user)
	s := NewService(store)
	r.POST("/api/sync/push", s.Push)
	r.GET("/api/sync/pull", s.Pull)
	r.GET("/api/sync/state", s.GetState)
	r.POST("/api/sync/resolve-conflict", s.ResolveConflict)
	r.POST("/api/sync/cleanup", s.Cleanup)
	r.GET("/api/sync/history", s.GetSyncHistory)
	return r
}

func doSync(t *testing.T, r *gin.Engine, method, path, cursorHeader string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if cursorHeader != "" {
		req.Header.Set("X-Sync-Cursor", cursorHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]any
	if w.Body.Len() > 0 {
		_ = json.Unmarshal(w.Body.Bytes(), &out)
	}
	return w, out
}

func pushObject(t *testing.T, r *gin.Engine, typ, id, data string) int64 {
	t.Helper()
	w, out := doSync(t, r, http.MethodPost, "/api/sync/push", "", map[string]string{
		"object_type": typ, "object_id": id, "data": data,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("push %s/%s: status = %d, body = %s", typ, id, w.Code, w.Body.String())
	}
	cursor, ok := out["cursor"].(float64)
	if !ok {
		t.Fatalf("push response missing numeric cursor: %v", out)
	}
	return int64(cursor)
}

func TestIsValidObjectType(t *testing.T) {
	valid := []string{"settings", "workspace", "task", "artifact", "knowledge",
		"plugin", "mcp_config", "chat_summary", "conversation", "message"}
	for _, typ := range valid {
		if !isValidObjectType(typ) {
			t.Errorf("isValidObjectType(%q) = false, want true", typ)
		}
	}
	for _, typ := range []string{"", "file", "secret", "SETTINGS", "task "} {
		if isValidObjectType(typ) {
			t.Errorf("isValidObjectType(%q) = true, want false", typ)
		}
	}
}

func TestIsValidPayload(t *testing.T) {
	tests := []struct {
		name string
		data string
		want bool
	}{
		{"normal json", `{"theme":"dark"}`, true},
		{"uppercase api key", `config API_KEY=abc123 end`, false},
		{"lowercase api key", `api_key=abc123`, false},
		{"oversized payload", strings.Repeat("x", 5_000_001), false},
		{"exactly at size limit", strings.Repeat("x", 5_000_000), true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isValidPayload("settings", tt.data); got != tt.want {
				t.Fatalf("isValidPayload = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPushPullRoundTrip(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	cursor := pushObject(t, r, "settings", "obj1", `{"theme":"dark"}`)
	if cursor <= 0 {
		t.Fatalf("cursor = %d, want > 0", cursor)
	}

	// Pull from the beginning returns the record.
	w, out := doSync(t, r, http.MethodGet, "/api/sync/pull?cursor=0", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("pull status = %d", w.Code)
	}
	records, _ := out["records"].([]any)
	if len(records) != 1 {
		t.Fatalf("records = %d, want 1 (resp=%v)", len(records), out)
	}
	rec := records[0].(map[string]any)
	if rec["object_type"] != "settings" || rec["object_id"] != "obj1" || rec["data"] != `{"theme":"dark"}` {
		t.Fatalf("record fields wrong: %v", rec)
	}
	// A just-pushed record is flagged as conflict (within 1s of now).
	if rec["conflict"] != true {
		t.Errorf("fresh record should carry conflict=true, got %v", rec)
	}

	// Pulling with the returned cursor yields nothing new.
	serverCursor := fmt.Sprintf("%.0f", out["cursor"].(float64))
	w, out = doSync(t, r, http.MethodGet, "/api/sync/pull?cursor="+serverCursor, "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("pull status = %d", w.Code)
	}
	records, _ = out["records"].([]any)
	if len(records) != 0 {
		t.Fatalf("records after cursor = %d, want 0", len(records))
	}
}

func TestPushValidation(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	t.Run("invalid object type", func(t *testing.T) {
		w, _ := doSync(t, r, http.MethodPost, "/api/sync/push", "", map[string]string{
			"object_type": "executable", "object_id": "x", "data": "{}",
		})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("prohibited payload", func(t *testing.T) {
		w, _ := doSync(t, r, http.MethodPost, "/api/sync/push", "", map[string]string{
			"object_type": "settings", "object_id": "x", "data": "API_KEY=secret",
		})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		w, _ := doSync(t, r, http.MethodPost, "/api/sync/push", "", map[string]string{
			"object_type": "settings",
		})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})
}

func TestPushConflictDetection(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	first := pushObject(t, r, "settings", "obj1", `{"v":1}`)

	// Client cursor older than the server record -> conflict flagged.
	w, out := doSync(t, r, http.MethodPost, "/api/sync/push",
		fmt.Sprintf("%d", first-1_000_000_000), map[string]string{
			"object_type": "settings", "object_id": "obj1", "data": `{"v":2}`,
		})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if out["conflict"] != true {
		t.Fatalf("conflict = %v, want true (resp=%v)", out["conflict"], out)
	}
	details, _ := out["conflict_details"].(map[string]any)
	if details == nil || details["strategy"] != "last-write-wins" {
		t.Fatalf("conflict_details = %v, want last-write-wins strategy", details)
	}

	// Client cursor up to date -> no conflict.
	w, out = doSync(t, r, http.MethodPost, "/api/sync/push",
		fmt.Sprintf("%d", first+1_000_000_000_000), map[string]string{
			"object_type": "settings", "object_id": "obj1", "data": `{"v":3}`,
		})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if _, has := out["conflict"]; has {
		t.Fatalf("unexpected conflict on up-to-date push: %v", out)
	}

	// Last write still wins: stored data is the latest push.
	rec, err := store.GetSyncRecordByObject(user.ID, "settings", "obj1")
	if err != nil || rec == nil {
		t.Fatalf("GetSyncRecordByObject: %v, %v", rec, err)
	}
	if rec.Data != `{"v":3}` {
		t.Fatalf("stored data = %s, want last write", rec.Data)
	}
}

func TestPullTypesFilter(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	pushObject(t, r, "settings", "s1", `{"a":1}`)
	pushObject(t, r, "task", "t1", `{"b":2}`)
	pushObject(t, r, "workspace", "w1", `{"c":3}`)

	w, out := doSync(t, r, http.MethodGet, "/api/sync/pull?cursor=0&types=settings,task", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	records, _ := out["records"].([]any)
	if len(records) != 2 {
		t.Fatalf("records = %d, want 2 (settings+task)", len(records))
	}
	for _, item := range records {
		typ := item.(map[string]any)["object_type"].(string)
		if typ != "settings" && typ != "task" {
			t.Fatalf("unexpected type %q in filtered pull", typ)
		}
	}

	// Invalid types in the list are dropped; all-invalid falls back to no filter.
	w, out = doSync(t, r, http.MethodGet, "/api/sync/pull?cursor=0&types=bogus", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	records, _ = out["records"].([]any)
	if len(records) != 3 {
		t.Fatalf("all-invalid types: records = %d, want 3 (unfiltered fallback)", len(records))
	}
}

func TestGetState(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	w, out := doSync(t, r, http.MethodGet, "/api/sync/state", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if cursor := int64(out["cursor"].(float64)); cursor != 0 {
		t.Fatalf("empty state cursor = %d, want 0", cursor)
	}

	pushed := pushObject(t, r, "settings", "obj1", `{"v":1}`)

	w, out = doSync(t, r, http.MethodGet, "/api/sync/state", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if cursor := int64(out["cursor"].(float64)); cursor != pushed {
		t.Fatalf("state cursor = %d, want %d (max pushed)", cursor, pushed)
	}
	if out["modified"] == "" {
		t.Error("modified timestamp missing")
	}
}

func TestResolveConflict(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	resolve := func(body map[string]string) int {
		w, _ := doSync(t, r, http.MethodPost, "/api/sync/resolve-conflict", "", body)
		return w.Code
	}

	if code := resolve(map[string]string{
		"object_type": "settings", "object_id": "o1", "winner": "local", "data": `{"v":1}`,
	}); code != http.StatusOK {
		t.Fatalf("winner=local: status = %d, want 200", code)
	}
	if code := resolve(map[string]string{
		"object_type": "settings", "object_id": "o1", "winner": "remote", "data": `{"v":2}`,
	}); code != http.StatusOK {
		t.Fatalf("winner=remote: status = %d, want 200", code)
	}
	if code := resolve(map[string]string{
		"object_type": "settings", "object_id": "o1", "winner": "server", "data": `{"v":3}`,
	}); code != http.StatusBadRequest {
		t.Fatalf("winner=server: status = %d, want 400", code)
	}
	if code := resolve(map[string]string{
		"object_type": "bogus", "object_id": "o1", "winner": "local", "data": `{}`,
	}); code != http.StatusBadRequest {
		t.Fatalf("invalid type: status = %d, want 400", code)
	}
	if code := resolve(map[string]string{
		"object_type": "settings", "object_id": "o1", "winner": "local", "data": "api_key=leak",
	}); code != http.StatusBadRequest {
		t.Fatalf("prohibited payload: status = %d, want 400", code)
	}

	// Winning data is what ends up stored.
	rec, err := store.GetSyncRecordByObject(user.ID, "settings", "o1")
	if err != nil || rec == nil {
		t.Fatalf("record after resolve: %v, %v", rec, err)
	}
	if rec.Data != `{"v":2}` {
		t.Fatalf("stored data = %s, want last successful resolve", rec.Data)
	}
}

func TestCleanup(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	pushObject(t, r, "settings", "fresh", `{"v":1}`)

	// Insert a stale record directly: created_at far in the past (unix seconds).
	if _, err := store.DB().Exec(`
		INSERT INTO sync_records (id, user_id, object_type, object_id, data, cursor, created_at)
		VALUES (?, ?, 'settings', 'stale', '{}', 1, '1000')`,
		"stale_"+user.ID, user.ID); err != nil {
		t.Fatal(err)
	}

	w, out := doSync(t, r, http.MethodPost, "/api/sync/cleanup?ttl_days=30", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if deleted := int(out["deleted"].(float64)); deleted != 1 {
		t.Fatalf("deleted = %d, want 1 (only the stale record)", deleted)
	}

	// Fresh record survived.
	rec, err := store.GetSyncRecordByObject(user.ID, "settings", "fresh")
	if err != nil || rec == nil {
		t.Fatalf("fresh record lost in cleanup: %v, %v", rec, err)
	}

	// Invalid ttl falls back to 30 days.
	w, out = doSync(t, r, http.MethodPost, "/api/sync/cleanup?ttl_days=-5", "", nil)
	if w.Code != http.StatusOK || int(out["ttl_days"].(float64)) != 30 {
		t.Fatalf("invalid ttl: status=%d ttl_days=%v, want 200/30", w.Code, out["ttl_days"])
	}
}

func TestGetSyncHistory(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	for i := 0; i < 3; i++ {
		pushObject(t, r, "task", fmt.Sprintf("t%d", i), `{"i":1}`)
	}

	w, out := doSync(t, r, http.MethodGet, "/api/sync/history", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if count := int(out["count"].(float64)); count != 3 {
		t.Fatalf("count = %d, want 3", count)
	}
	history, _ := out["history"].([]any)
	if len(history) != 3 {
		t.Fatalf("history len = %d, want 3", len(history))
	}
	// History entries must not leak payload data.
	for _, item := range history {
		if _, has := item.(map[string]any)["data"]; has {
			t.Fatal("history entries must not include data payloads")
		}
	}

	w, out = doSync(t, r, http.MethodGet, "/api/sync/history?limit=2", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if count := int(out["count"].(float64)); count != 2 {
		t.Fatalf("limited count = %d, want 2", count)
	}

	// Out-of-range limit falls back to default.
	w, out = doSync(t, r, http.MethodGet, "/api/sync/history?limit=99999", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if count := int(out["count"].(float64)); count != 3 {
		t.Fatalf("fallback count = %d, want 3", count)
	}
}

func TestSyncRequiresAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := testutil.NewTestStore(t)
	r := gin.New() // no auth middleware -> no user in context
	s := NewService(store)
	r.POST("/api/sync/push", s.Push)
	r.GET("/api/sync/pull", s.Pull)

	req := httptest.NewRequest(http.MethodGet, "/api/sync/pull", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("pull without auth = %d, want 401", w.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/sync/push",
		strings.NewReader(`{"object_type":"settings","object_id":"x","data":"{}"}`))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("push without auth = %d, want 401", w.Code)
	}
}

func TestGenerateIDIsUnique(t *testing.T) {
	// Regression: the old "sync_" + second-resolution timestamp collided
	// when distinct objects were pushed within the same second.
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		id := generateID()
		if !strings.HasPrefix(id, "sync_") {
			t.Fatalf("id %q missing sync_ prefix", id)
		}
		if seen[id] {
			t.Fatalf("duplicate id generated: %s", id)
		}
		seen[id] = true
	}
}

func TestPushDistinctObjectsSameSecond(t *testing.T) {
	// Regression for the second-resolution ID collision: pushing several
	// distinct objects back-to-back must all succeed.
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	r := newSyncRouter(t, store, user)

	for i := 0; i < 5; i++ {
		pushObject(t, r, "task", fmt.Sprintf("t%d", i), `{"i":1}`)
	}
	w, out := doSync(t, r, http.MethodGet, "/api/sync/pull?cursor=0", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("pull status = %d", w.Code)
	}
	records, _ := out["records"].([]any)
	if len(records) != 5 {
		t.Fatalf("records = %d, want 5", len(records))
	}
}
