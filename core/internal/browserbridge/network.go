// GeoWork Go Core - Browser Bridge Network Logging

package browserbridge

import (
	"sync"
	"time"
)

// NetworkLog stores captured network requests.
type NetworkLog struct {
	mu       sync.Mutex
	requests []NetworkRequest
	maxSize  int
}

func NewNetworkLog() *NetworkLog {
	return &NetworkLog{maxSize: 500}
}

// AddRequest records a network request.
func (n *NetworkLog) AddRequest(req NetworkRequest) {
	n.mu.Lock()
	defer n.mu.Unlock()

	n.requests = append(n.requests, req)
	if len(n.requests) > n.maxSize {
		n.requests = n.requests[len(n.requests)-n.maxSize:]
	}
}

// GetRequests returns all recorded requests.
func (n *NetworkLog) GetRequests() []NetworkRequest {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := make([]NetworkRequest, len(n.requests))
	copy(out, n.requests)
	return out
}

// FilterByURL returns requests matching a URL pattern.
func (n *NetworkLog) FilterByURL(pattern string) []NetworkRequest {
	n.mu.Lock()
	defer n.mu.Unlock()
	var out []NetworkRequest
	for _, r := range n.requests {
		if contains(r.URL, pattern) {
			out = append(out, r)
		}
	}
	return out
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
