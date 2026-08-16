// Package ratelimit provides an in-memory token bucket rate limiter
// implemented as a Gin middleware for HTTP request throttling.
package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"server/internal/apierrors"

	"github.com/gin-gonic/gin"
)

// bucket represents a single token bucket for a given key (e.g., IP address).
type bucket struct {
	tokens   float64
	lastTime time.Time
}

// Limiter manages multiple token buckets keyed by an identifier string.
// It uses a token bucket algorithm where tokens are added at a fixed rate
// up to a maximum capacity. Each request consumes one token.
type Limiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     float64 // tokens added per second
	capacity float64 // maximum tokens in a bucket
	stopCh   chan struct{}
	stopOnce sync.Once
}

// NewLimiter creates a new rate limiter with the specified token refill rate
// (tokens per second) and maximum bucket capacity. It also starts a background
// goroutine that periodically cleans up expired buckets.
func NewLimiter(rate, capacity float64) *Limiter {
	l := &Limiter{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		capacity: capacity,
		stopCh:   make(chan struct{}),
	}
	go l.cleanup()
	return l
}

// Allow checks whether a request identified by key should be allowed.
// It returns true if a token was available (and consumes it), false otherwise.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	b, exists := l.buckets[key]
	now := time.Now()

	if !exists {
		l.buckets[key] = &bucket{
			tokens:   l.capacity - 1,
			lastTime: now,
		}
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := now.Sub(b.lastTime).Seconds()
	b.tokens += elapsed * l.rate
	if b.tokens > l.capacity {
		b.tokens = l.capacity
	}
	b.lastTime = now

	if b.tokens < 1 {
		return false
	}

	b.tokens--
	return true
}

// Stop terminates the background cleanup goroutine. Safe to call multiple times.
func (l *Limiter) Stop() {
	l.stopOnce.Do(func() {
		close(l.stopCh)
	})
}

// cleanup periodically removes buckets that have been idle for more than 10 minutes.
func (l *Limiter) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			l.mu.Lock()
			now := time.Now()
			for key, b := range l.buckets {
				if now.Sub(b.lastTime) > 10*time.Minute {
					delete(l.buckets, key)
				}
			}
			l.mu.Unlock()
		case <-l.stopCh:
			return
		}
	}
}

// Middleware returns a Gin middleware that applies the given rate limiter.
// It uses the client's IP address as the bucket key. When the limit is exceeded,
// it responds with HTTP 429 Too Many Requests.
func Middleware(limiter *Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()
		if !limiter.Allow(key) {
			apierrors.RespondWithMessage(c, apierrors.New(http.StatusTooManyRequests, "RATE_LIMITED", "too many requests"), "too many requests, please try again later")
			c.Abort()
			return
		}
		c.Next()
	}
}
