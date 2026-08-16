// Package ratelimit tests for the token bucket limiter and Gin middleware.
package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestAllowConsumesTokens(t *testing.T) {
	l := NewLimiter(0, 2) // rate 0: no refill, pure capacity test
	defer l.Stop()

	if !l.Allow("a") {
		t.Fatal("first request should be allowed")
	}
	if !l.Allow("a") {
		t.Fatal("second request should be allowed (capacity 2)")
	}
	if l.Allow("a") {
		t.Fatal("third request should be rejected (bucket empty, no refill)")
	}
}

func TestAllowIndependentKeys(t *testing.T) {
	l := NewLimiter(0, 1)
	defer l.Stop()

	if !l.Allow("a") {
		t.Fatal("key a first request should pass")
	}
	if !l.Allow("b") {
		t.Fatal("key b should have its own bucket")
	}
	if l.Allow("a") {
		t.Fatal("key a should still be exhausted")
	}
}

func TestAllowRefillsOverTime(t *testing.T) {
	l := NewLimiter(10, 1) // 10 tokens/sec
	defer l.Stop()

	if !l.Allow("a") {
		t.Fatal("first request should pass")
	}
	if l.Allow("a") {
		t.Fatal("immediate second request should be rejected")
	}
	time.Sleep(150 * time.Millisecond) // ~1.5 tokens refilled
	if !l.Allow("a") {
		t.Fatal("request after refill should pass")
	}
}

func TestAllowCapacityIsCeiling(t *testing.T) {
	l := NewLimiter(10, 2)
	defer l.Stop()

	l.Allow("a")
	time.Sleep(300 * time.Millisecond) // refills past capacity
	// Bucket capped at 2: at most two more requests before rejection.
	if !l.Allow("a") {
		t.Fatal("first after refill should pass")
	}
	if !l.Allow("a") {
		t.Fatal("second after refill should pass (capacity 2)")
	}
	if l.Allow("a") {
		t.Fatal("third should be rejected; refill between back-to-back calls is negligible")
	}
}

func TestMiddlewareReturns429WhenExhausted(t *testing.T) {
	l := NewLimiter(0, 1)
	defer l.Stop()

	r := gin.New()
	r.Use(Middleware(l))
	r.GET("/ping", func(c *gin.Context) { c.String(http.StatusOK, "pong") })

	do := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	if w := do(); w.Code != http.StatusOK {
		t.Fatalf("first request = %d, want 200", w.Code)
	}
	w := do()
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("second request = %d, want 429", w.Code)
	}
	if w.Body.String() == "" {
		t.Fatal("429 response should carry an error body")
	}
}

func TestMiddlewareLetsDistinctClientsThrough(t *testing.T) {
	l := NewLimiter(0, 1)
	defer l.Stop()

	r := gin.New()
	r.Use(Middleware(l))
	r.GET("/ping", func(c *gin.Context) { c.String(http.StatusOK, "pong") })

	do := func(ip string) int {
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		req.RemoteAddr = ip + ":12345"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	if code := do("10.0.0.1"); code != http.StatusOK {
		t.Fatalf("client 1 = %d, want 200", code)
	}
	if code := do("10.0.0.2"); code != http.StatusOK {
		t.Fatalf("client 2 = %d, want 200", code)
	}
}

func TestStopIsIdempotent(t *testing.T) {
	l := NewLimiter(1, 1)
	l.Allow("a")
	l.Stop()
	l.Stop() // second call must not panic (close of closed channel)
}
