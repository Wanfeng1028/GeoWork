// doc/25 S3 regression tests: usage reporting must reject obviously broken
// amounts (negative / absurdly large) even though metering is client-trusted.
package usage

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"server/internal/testutil"
)

func doReport(t *testing.T, svc *Service, typ string, amount int64) *httptest.ResponseRecorder {
	t.Helper()
	store := svc.store
	user, _ := store.GetUserByEmail("test@example.com")
	r := testutil.NewAuthedRouter(user)
	r.POST("/api/usage/events", svc.ReportEvents)

	body, _ := json.Marshal(ReportEventRequest{Type: typ, Amount: amount, Model: "gpt-4"})
	req := httptest.NewRequest(http.MethodPost, "/api/usage/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestReportEvents_RejectsNegativeAmount(t *testing.T) {
	store := testutil.NewTestStore(t)
	testutil.SeedTestUser(t, store)
	svc := NewService(store)

	w := doReport(t, svc, "model_tokens", -100)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("negative amount: status = %d, want %d; body = %s",
			w.Code, http.StatusBadRequest, w.Body.String())
	}
}

func TestReportEvents_RejectsAbsurdAmount(t *testing.T) {
	store := testutil.NewTestStore(t)
	testutil.SeedTestUser(t, store)
	svc := NewService(store)

	w := doReport(t, svc, "model_tokens", maxReportAmount+1)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("absurd amount: status = %d, want %d; body = %s",
			w.Code, http.StatusBadRequest, w.Body.String())
	}
}

func TestReportEvents_AcceptsValidAmount(t *testing.T) {
	store := testutil.NewTestStore(t)
	testutil.SeedTestUser(t, store)
	svc := NewService(store)

	w := doReport(t, svc, "model_tokens", 1500)
	if w.Code != http.StatusOK {
		t.Fatalf("valid amount: status = %d, want %d; body = %s",
			w.Code, http.StatusOK, w.Body.String())
	}
}
