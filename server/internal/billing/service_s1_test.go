// doc/25 S1 regression tests: the mock checkout endpoint must be gated
// behind GEOWORK_BILLING_MOCK=1 so users cannot self-upgrade in production.
package billing

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"server/internal/storage"
	"server/internal/testutil"
)

func doCheckout(t *testing.T, svc *Service, user *storage.User, plan string) *httptest.ResponseRecorder {
	t.Helper()
	r := testutil.NewAuthedRouter(user)
	r.POST("/api/billing/checkout/mock", svc.CheckoutSession)

	body, _ := json.Marshal(map[string]string{"plan": plan})
	req := httptest.NewRequest(http.MethodPost, "/api/billing/checkout/mock", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestCheckoutMock_GatedOff_Returns404(t *testing.T) {
	// Ensure the gate is off for this test regardless of host env.
	t.Setenv("GEOWORK_BILLING_MOCK", "")

	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	w := doCheckout(t, svc, user, "team")
	if w.Code != http.StatusNotFound {
		t.Fatalf("mock checkout with gate off: status = %d, want %d; body: %s",
			w.Code, http.StatusNotFound, w.Body.String())
	}

	// Plan must NOT have been upgraded.
	got, err := store.GetUserByID(user.ID)
	if err != nil || got == nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if got.Plan != "free" {
		t.Errorf("plan = %q, want %q (self-upgrade regression)", got.Plan, "free")
	}
}

func TestCheckoutMock_GatedOn_StillWorks(t *testing.T) {
	t.Setenv("GEOWORK_BILLING_MOCK", "1")

	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	svc := NewService(store)

	w := doCheckout(t, svc, user, "pro")
	if w.Code != http.StatusOK {
		t.Fatalf("mock checkout with gate on: status = %d, want %d; body: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	got, _ := store.GetUserByID(user.ID)
	if got == nil || got.Plan != "pro" {
		t.Errorf("plan after gated checkout = %+v, want pro", got)
	}
}
