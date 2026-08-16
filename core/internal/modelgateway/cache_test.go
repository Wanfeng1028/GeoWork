package modelgateway

import (
	"testing"
	"time"
)

func entryAt(ts time.Time) CacheEntry {
	return CacheEntry{Response: []byte("resp"), Timestamp: ts, Model: "m"}
}

func TestCacheSetGet(t *testing.T) {
	c := NewCache(time.Minute, 10)
	c.Set("k1", entryAt(time.Now()))

	got, ok := c.Get("k1")
	if !ok {
		t.Fatalf("expected cache hit")
	}
	if string(got.Response) != "resp" {
		t.Errorf("response mismatch: %q", got.Response)
	}
}

func TestCacheMiss(t *testing.T) {
	c := NewCache(time.Minute, 10)
	if _, ok := c.Get("absent"); ok {
		t.Fatalf("expected cache miss for absent key")
	}
}

func TestCacheTTLExpiry(t *testing.T) {
	c := NewCache(time.Minute, 10)
	// Backdate the entry beyond the TTL; Get compares time.Since(timestamp),
	// so no real sleep is needed.
	c.Set("old", entryAt(time.Now().Add(-2*time.Minute)))
	if _, ok := c.Get("old"); ok {
		t.Fatalf("expected expired entry to miss")
	}
}

func TestCacheEvictsOldestAtCapacity(t *testing.T) {
	c := NewCache(time.Minute, 2)
	c.Set("a", entryAt(time.Now().Add(-3*time.Second)))
	c.Set("b", entryAt(time.Now().Add(-2*time.Second)))
	// At capacity: inserting c must evict the oldest (a).
	c.Set("c", entryAt(time.Now()))

	if _, ok := c.Get("a"); ok {
		t.Fatalf("oldest entry must be evicted")
	}
	if _, ok := c.Get("b"); !ok {
		t.Fatalf("newer entry b must survive")
	}
	if _, ok := c.Get("c"); !ok {
		t.Fatalf("newly inserted entry must be present")
	}
	if c.Size() != 2 {
		t.Errorf("size = %d, want 2", c.Size())
	}
}

func TestCacheDisabledStoresNothing(t *testing.T) {
	c := NewCache(time.Minute, 10)
	c.SetEnabled(false)
	c.Set("k", entryAt(time.Now()))
	if c.Size() != 0 {
		t.Fatalf("disabled cache must not store entries, size=%d", c.Size())
	}
	if c.Enabled() {
		t.Fatalf("Enabled() must be false")
	}
}

func TestCacheSetEnabledClearsEntries(t *testing.T) {
	c := NewCache(time.Minute, 10)
	c.Set("k", entryAt(time.Now()))
	c.SetEnabled(false)
	if c.Size() != 0 {
		t.Fatalf("disabling must clear entries, size=%d", c.Size())
	}
	c.SetEnabled(true)
	c.Set("k2", entryAt(time.Now()))
	if c.Size() != 1 {
		t.Fatalf("re-enabled cache must store entries, size=%d", c.Size())
	}
}

func TestCacheDeleteAndClear(t *testing.T) {
	c := NewCache(time.Minute, 10)
	c.Set("a", entryAt(time.Now()))
	c.Set("b", entryAt(time.Now()))

	c.Delete("a")
	if _, ok := c.Get("a"); ok {
		t.Fatalf("deleted key must be gone")
	}
	if c.Size() != 1 {
		t.Errorf("size after delete = %d, want 1", c.Size())
	}

	c.Clear()
	if c.Size() != 0 {
		t.Errorf("size after clear = %d, want 0", c.Size())
	}
}

func TestKeyDeterministicAndDistinct(t *testing.T) {
	k1 := Key("model", "prompt", "tools", "ctx")
	k2 := Key("model", "prompt", "tools", "ctx")
	if k1 != k2 {
		t.Fatalf("Key must be deterministic")
	}
	if k1 == Key("model", "different", "tools", "ctx") {
		t.Fatalf("different prompts must produce different keys")
	}
	if len(k1) < 3 || k1[:3] != "mw:" {
		t.Errorf("key must carry the mw: prefix, got %q", k1)
	}
}

func TestHashToolsAndContext(t *testing.T) {
	toolsA := []ToolDef{{Type: "function", Function: ToolFunction{Name: "read_file"}}}
	toolsB := []ToolDef{{Type: "function", Function: ToolFunction{Name: "write_file"}}}
	if HashTools(toolsA) == HashTools(toolsB) {
		t.Fatalf("different tool sets must hash differently")
	}
	if HashTools(toolsA) != HashTools(toolsA) {
		t.Fatalf("HashTools must be deterministic")
	}

	msgsA := []ChatMessage{{Role: "user", Content: "a"}}
	msgsB := []ChatMessage{{Role: "user", Content: "b"}}
	if HashContext(msgsA) == HashContext(msgsB) {
		t.Fatalf("different contexts must hash differently")
	}
}
