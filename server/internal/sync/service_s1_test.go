// doc/25 S1 regression tests: sync cleanup must be strictly user-scoped,
// billing mock checkout must be env-gated, crash IDs must not collide.
package sync

import (
	"net/http"
	"testing"

	"server/internal/testutil"
)

// TestCleanup_UserScoped pins the doc/25 S1 fix: cleanup called by user A
// must never touch user B's stale records. The previous implementation ran
// an unscoped DELETE, so any authenticated caller wiped everyone's data.
func TestCleanup_UserScoped(t *testing.T) {
	store := testutil.NewTestStore(t)
	userA := testutil.SeedTestUser(t, store)
	userB := testutil.SeedSecondUser(t, store)
	rA := newSyncRouter(t, store, userA)

	// Both users have a stale record (created_at far in the past).
	for _, u := range []string{userA.ID, userB.ID} {
		if _, err := store.DB().Exec(`
			INSERT INTO sync_records (id, user_id, object_type, object_id, data, cursor, created_at)
			VALUES (?, ?, 'settings', 'stale', '{}', 1, '1000')`,
			"stale_"+u, u); err != nil {
			t.Fatal(err)
		}
	}

	w, out := doSync(t, rA, http.MethodPost, "/api/sync/cleanup?ttl_days=30", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if deleted := int(out["deleted"].(float64)); deleted != 1 {
		t.Fatalf("deleted = %d, want 1 (only caller's stale record)", deleted)
	}

	// Caller's stale record is gone.
	if rec, _ := store.GetSyncRecordByObject(userA.ID, "settings", "stale"); rec != nil {
		t.Error("caller's stale record survived cleanup")
	}
	// Other user's stale record must be untouched.
	if rec, _ := store.GetSyncRecordByObject(userB.ID, "settings", "stale"); rec == nil {
		t.Error("cleanup deleted ANOTHER user's record — privilege escalation regression")
	}
}
