package modelgateway

import (
	"testing"
	"time"
)

func TestRateLimiterProviderBurst(t *testing.T) {
	rl := NewRateLimiter()
	// qps=1 with the 1x profile yields a 1-token bucket.
	rl.ConfigureProvider("p1", 1, GetSpeedProfile("1x"))

	if !rl.AcquireProvider("p1") {
		t.Fatalf("first acquire must succeed")
	}
	if rl.AcquireProvider("p1") {
		t.Fatalf("second acquire must fail: bucket exhausted")
	}
}

func TestRateLimiterUnconfiguredProviderAllowed(t *testing.T) {
	rl := NewRateLimiter()
	if !rl.AcquireProvider("unknown") {
		t.Fatalf("unconfigured provider must not be limited")
	}
}

func TestRateLimiterIndependentKeys(t *testing.T) {
	rl := NewRateLimiter()
	rl.ConfigureProvider("p1", 1, GetSpeedProfile("1x"))
	rl.ConfigureProvider("p2", 1, GetSpeedProfile("1x"))

	rl.AcquireProvider("p1")
	if !rl.AcquireProvider("p2") {
		t.Fatalf("p2 bucket must be independent of p1")
	}
}

func TestRateLimiterRefill(t *testing.T) {
	rl := NewRateLimiter()
	rl.ConfigureProvider("p1", 1, GetSpeedProfile("1x"))

	rl.AcquireProvider("p1")
	if rl.AcquireProvider("p1") {
		t.Fatalf("bucket must be exhausted")
	}
	// refillRate is 1 token/second; wait just over a second for one token.
	time.Sleep(1100 * time.Millisecond)
	if !rl.AcquireProvider("p1") {
		t.Fatalf("token must refill after elapsed time")
	}
}

func TestRateLimiterSpeedProfileMultiplier(t *testing.T) {
	rl := NewRateLimiter()
	// qps=2 with the 2x profile (RateLimitMul 1.5) yields 3 tokens.
	rl.ConfigureProvider("p2x", 2, GetSpeedProfile("2x"))

	for i := 0; i < 3; i++ {
		if !rl.AcquireProvider("p2x") {
			t.Fatalf("acquire %d must succeed within the multiplied budget", i+1)
		}
	}
	if rl.AcquireProvider("p2x") {
		t.Fatalf("fourth acquire must fail")
	}
}

func TestRateLimiterTaskConcurrency(t *testing.T) {
	rl := NewRateLimiter()
	rl.ConfigureTask("task-1", 2)

	if !rl.AcquireTask("task-1") {
		t.Fatalf("first slot must be granted")
	}
	if !rl.AcquireTask("task-1") {
		t.Fatalf("second slot must be granted")
	}
	if rl.AcquireTask("task-1") {
		t.Fatalf("third slot must be denied at maxActive=2")
	}

	rl.ReleaseTask("task-1")
	if !rl.AcquireTask("task-1") {
		t.Fatalf("slot must be available after release")
	}
}

func TestRateLimiterUnconfiguredTaskAllowed(t *testing.T) {
	rl := NewRateLimiter()
	if !rl.AcquireTask("unknown") {
		t.Fatalf("unconfigured task must not be limited")
	}
}

func TestRateLimiterReset(t *testing.T) {
	rl := NewRateLimiter()
	rl.ConfigureProvider("p1", 1, GetSpeedProfile("1x"))
	rl.ConfigureTask("task-1", 1)
	rl.AcquireProvider("p1")
	rl.AcquireTask("task-1")

	rl.Reset()

	if !rl.AcquireProvider("p1") {
		t.Fatalf("provider limit must be cleared after Reset")
	}
	if !rl.AcquireTask("task-1") {
		t.Fatalf("task limit must be cleared after Reset")
	}
}
