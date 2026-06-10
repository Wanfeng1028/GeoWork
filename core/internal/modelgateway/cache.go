// GeoWork Go Core - Model Request Cache

package modelgateway

import (
	"crypto/sha256"
	"encoding/json"
	"sync"
	"time"
)

// CacheEntry is a single cached model response.
type CacheEntry struct {
	Response    []byte    `json:"response"`
	Timestamp   time.Time `json:"timestamp"`
	PromptHash   string    `json:"promptHash"`
	Model        string    `json:"model"`
	TokenCount   int       `json:"tokenCount"`
}

// Cache is a local in-memory request cache.
type Cache struct {
	mu       sync.RWMutex
	entries  map[string]CacheEntry
	maxSize  int
	ttl      time.Duration
	enabled  bool
}

// NewCache creates a new cache with the given TTL and max size.
func NewCache(ttl time.Duration, maxSize int) *Cache {
	return &Cache{
		entries: make(map[string]CacheEntry),
		maxSize: maxSize,
		ttl:     ttl,
		enabled: true,
	}
}

// Enabled returns whether the cache is enabled.
func (c *Cache) Enabled() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.enabled
}

// SetEnabled toggles the cache on/off.
func (c *Cache) SetEnabled(enabled bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.enabled = enabled
	if !enabled {
		c.entries = make(map[string]CacheEntry)
	}
}

// Key generates a cache key from model, prompt, tools, and context.
func Key(model string, prompt string, toolsHash string, contextHash string) string {
	h := sha256.New()
	h.Write([]byte(model))
	h.Write([]byte(prompt))
	h.Write([]byte(toolsHash))
	h.Write([]byte(contextHash))
	return "mw:" + string(h.Sum(nil)[:16])
}

// Get retrieves a cached entry.
func (c *Cache) Get(k string) (*CacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.entries[k]
	if !ok {
		return nil, false
	}
	if time.Since(entry.Timestamp) > c.ttl {
		return nil, false
	}
	return &entry, true
}

// Set stores a response in the cache.
func (c *Cache) Set(k string, entry CacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.enabled {
		return
	}

	// Evict oldest if at capacity
	if len(c.entries) >= c.maxSize {
		c.evictOldest()
	}
	c.entries[k] = entry
}

// Delete removes a specific entry.
func (c *Cache) Delete(k string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, k)
}

// Clear removes all entries.
func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]CacheEntry)
}

// Size returns the current cache size.
func (c *Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

func (c *Cache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	first := true
	for k, entry := range c.entries {
		if first || entry.Timestamp.Before(oldestTime) {
			oldestKey = k
			oldestTime = entry.Timestamp
			first = false
		}
	}
	if !first {
		delete(c.entries, oldestKey)
	}
}

// HashTools serializes tool definitions to a hash string.
func HashTools(tools []ToolDef) string {
	data, _ := json.Marshal(tools)
	h := sha256.Sum256(data)
	return string(h[:])
}

// HashContext serializes messages to a hash string.
func HashContext(messages []ChatMessage) string {
	data, _ := json.Marshal(messages)
	h := sha256.Sum256(data)
	return string(h[:])
}
