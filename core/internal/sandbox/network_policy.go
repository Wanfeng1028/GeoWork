// GeoWork Go Core - Network Access Policy

package sandbox

import (
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// NetworkPolicy defines network access rules for sandboxed processes.
type NetworkPolicy struct {
	// AllowInternet controls whether internet access is permitted.
	AllowInternet bool `json:"allowInternet"`
	// AllowLocalhost controls whether localhost/127.0.0.1 access is permitted.
	AllowLocalhost bool `json:"allowLocalhost"`
	// AllowLAN controls whether LAN/private IP access is permitted.
	AllowLAN bool `json:"allowLAN"`
	// AllowedDomains is a whitelist of allowed domain names (if not empty).
	AllowedDomains []string `json:"allowedDomains,omitempty"`
	// BlockedDomains is a blacklist of blocked domain names.
	BlockedDomains []string `json:"blockedDomains,omitempty"`
	// AllowedPorts restricts which TCP/UDP ports can be accessed.
	AllowedPorts []int `json:"allowedPorts,omitempty"`
	// BlockedPorts are ports that cannot be accessed.
	BlockedPorts []int `json:"blockedPorts,omitempty"`
	// MaxRequestBodyBytes limits the size of outgoing HTTP request bodies.
	MaxRequestBodyBytes int64 `json:"maxRequestBodyBytes"`
	// MaxResponseBodyBytes limits the size of received HTTP response bodies.
	MaxResponseBodyBytes int64 `json:"maxResponseBodyBytes"`
	// Timeout controls connection and read timeouts.
	Timeout time.Duration `json:"timeout"`
	// AllowDNS specifies if DNS lookups are allowed.
	AllowDNS bool `json:"allowDNS"`
}

// DefaultNetworkPolicy returns a policy that only allows localhost.
func DefaultNetworkPolicy() *NetworkPolicy {
	return &NetworkPolicy{
		AllowInternet:        false,
		AllowLocalhost:       true,
		AllowLAN:             false,
		AllowedDomains:       []string{}, // empty means allow if internet is on
		BlockedDomains:       []string{"*.internal.*", "*.local.*"},
		AllowedPorts:         []int{80, 443, 8765, 8766, 8767},
		BlockedPorts:         []int{22, 23, 3389}, // block SSH, Telnet, RDP
		MaxRequestBodyBytes:  10 * 1024 * 1024,    // 10MB
		MaxResponseBodyBytes: 100 * 1024 * 1024,   // 100MB
		Timeout:              30 * time.Second,
		AllowDNS:             true,
	}
}

// StrictNetworkPolicy returns a policy that blocks all network access.
func StrictNetworkPolicy() *NetworkPolicy {
	return &NetworkPolicy{
		AllowInternet:        false,
		AllowLocalhost:       false,
		AllowLAN:             false,
		AllowedDomains:       []string{},
		BlockedDomains:       []string{"*"},
		AllowedPorts:         []int{},
		BlockedPorts:         []int{0, 1, 65535}, // block all ports
		MaxRequestBodyBytes:  0,
		MaxResponseBodyBytes: 0,
		Timeout:              1 * time.Second,
		AllowDNS:             false,
	}
}

// PermissiveNetworkPolicy returns a policy that allows most network access.
func PermissiveNetworkPolicy() *NetworkPolicy {
	return &NetworkPolicy{
		AllowInternet:        true,
		AllowLocalhost:       true,
		AllowLAN:             true,
		AllowedDomains:       []string{}, // allow all
		BlockedDomains:       []string{"*.internal.*"},
		AllowedPorts:         []int{},   // allow all
		BlockedPorts:         []int{23}, // only block Telnet
		MaxRequestBodyBytes:  50 * 1024 * 1024,
		MaxResponseBodyBytes: 500 * 1024 * 1024,
		Timeout:              60 * time.Second,
		AllowDNS:             true,
	}
}

// NetworkValidator enforces network access rules.
type NetworkValidator struct {
	policy *NetworkPolicy
	log    *zap.Logger
	mu     sync.RWMutex
}

// NewNetworkValidator creates a new validator with the given policy.
func NewNetworkValidator(policy *NetworkPolicy, log *zap.Logger) *NetworkValidator {
	return &NetworkValidator{policy: policy, log: log}
}

// UpdatePolicy atomically replaces the network policy.
func (v *NetworkValidator) UpdatePolicy(policy *NetworkPolicy) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.policy = policy
}

// GetPolicy returns a copy of the current policy.
func (v *NetworkValidator) GetPolicy() *NetworkPolicy {
	v.mu.RLock()
	defer v.mu.RUnlock()
	cp := *v.policy
	return &cp
}

// ValidateConnection checks if a connection to the given address is allowed.
func (v *NetworkValidator) ValidateConnection(addr string) error {
	v.mu.RLock()
	defer v.mu.RUnlock()

	policy := v.policy

	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		// Try to parse as host:port anyway
		host = addr
		portStr = "0"
	}

	port, _ := parsePort(portStr)

	// Check blocked ports first
	if isPortBlocked(port, policy.BlockedPorts) {
		return &ErrPortBlocked{
			Port:    port,
			Message: fmt.Sprintf("Connection to port %d is blocked", port),
		}
	}

	// Check if any port restrictions exist
	if len(policy.AllowedPorts) > 0 && !isPortAllowed(port, policy.AllowedPorts) {
		return &ErrPortNotAllowed{
			Port:    port,
			Message: fmt.Sprintf("Port %d is not in the allowed ports list", port),
		}
	}

	// If no internet access, reject everything except localhost
	if !policy.AllowInternet && !policy.AllowLocalhost {
		if isLocalhost(host) {
			if !policy.AllowLocalhost {
				return &ErrNetworkBlocked{
					Reason:  "all network access is disabled",
					Host:    host,
					Port:    port,
					Message: "All network access is disabled by sandbox policy",
				}
			}
		} else {
			return &ErrNetworkBlocked{
				Reason:  "internet access is disabled",
				Host:    host,
				Port:    port,
				Message: "Internet access is disabled by sandbox policy",
			}
		}
	}

	// Check if internet is allowed but we have a domain whitelist
	if policy.AllowInternet && len(policy.AllowedDomains) > 0 {
		if !isDomainAllowed(host, policy.AllowedDomains) {
			return &ErrDomainBlocked{
				Domain:  host,
				Message: fmt.Sprintf("Domain %s is not in the allowed domains list", host),
			}
		}
	}

	// Check blocked domains
	if isDomainBlocked(host, policy.BlockedDomains) {
		return &ErrDomainBlocked{
			Domain:  host,
			Message: fmt.Sprintf("Domain %s is blocked by sandbox policy", host),
		}
	}

	// Validate DNS if needed
	if !policy.AllowDNS && !isLocalhost(host) {
		return &ErrDNSBlocked{
			Message: "DNS lookups are disabled by sandbox policy",
		}
	}

	return nil
}

// ValidateHTTPResponse checks if an HTTP response body size is within limits.
func (v *NetworkValidator) ValidateHTTPResponse(size int64) error {
	v.mu.RLock()
	defer v.mu.RUnlock()

	if size > v.policy.MaxResponseBodyBytes {
		return &ErrResponseBodyTooLarge{
			Size:    size,
			Limit:   v.policy.MaxResponseBodyBytes,
			Message: fmt.Sprintf("Response body size %d bytes exceeds limit of %d bytes", size, v.policy.MaxResponseBodyBytes),
		}
	}
	return nil
}

// ValidateHTTPRequest checks if an HTTP request body size is within limits.
func (v *NetworkValidator) ValidateHTTPRequest(size int64) error {
	v.mu.RLock()
	defer v.mu.RUnlock()

	if size > v.policy.MaxRequestBodyBytes {
		return &ErrRequestBodyTooLarge{
			Size:    size,
			Limit:   v.policy.MaxRequestBodyBytes,
			Message: fmt.Sprintf("Request body size %d bytes exceeds limit of %d bytes", size, v.policy.MaxRequestBodyBytes),
		}
	}
	return nil
}

// isLocalhost checks if a host is a localhost address.
func isLocalhost(host string) bool {
	if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "0.0.0.0" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// isPrivateIP checks if an IP address is in a private range.
func isPrivateIP(host string) bool {
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsPrivate()
}

// isPortBlocked checks if a port is in the blocked list.
func isPortBlocked(port int, blockedPorts []int) bool {
	for _, p := range blockedPorts {
		if p == port || p == 0 || port == 0 {
			return true
		}
	}
	return false
}

// isPortAllowed checks if a port is in the allowed list (or if no list exists).
func isPortAllowed(port int, allowedPorts []int) bool {
	if len(allowedPorts) == 0 {
		return true // no restriction
	}
	for _, p := range allowedPorts {
		if p == port {
			return true
		}
	}
	return false
}

// isDomainBlocked checks if a domain matches any blocked pattern.
func isDomainBlocked(domain string, blockedDomains []string) bool {
	for _, pattern := range blockedDomains {
		if matchDomain(domain, pattern) {
			return true
		}
	}
	return false
}

// isDomainAllowed checks if a domain is in the allowed list.
func isDomainAllowed(domain string, allowedDomains []string) bool {
	if len(allowedDomains) == 0 {
		return true // no restriction
	}
	for _, allowed := range allowedDomains {
		if matchDomain(domain, allowed) {
			return true
		}
	}
	return false
}

// matchDomain checks if a domain matches a pattern with wildcard support.
func matchDomain(domain, pattern string) bool {
	if domain == pattern {
		return true
	}
	if strings.HasPrefix(pattern, "*.") {
		suffix := pattern[1:]
		return strings.HasSuffix(domain, suffix) || domain == suffix[1:]
	}
	return false
}

// parsePort extracts a port number from a string.
func parsePort(s string) (int, error) {
	if s == "" {
		return 0, nil
	}
	var port int
	_, err := fmt.Sscanf(s, "%d", &port)
	if err != nil {
		return 0, fmt.Errorf("invalid port: %s", s)
	}
	if port < 0 || port > 65535 {
		return 0, fmt.Errorf("port out of range: %d", port)
	}
	return port, nil
}

// ErrNetworkBlocked is returned when network access is denied.
type ErrNetworkBlocked struct {
	Reason  string
	Host    string
	Port    int
	Message string
}

func (e *ErrNetworkBlocked) Error() string { return e.Message }

// ErrPortBlocked is returned when a port is blocked.
type ErrPortBlocked struct {
	Port    int
	Message string
}

func (e *ErrPortBlocked) Error() string { return e.Message }

// ErrPortNotAllowed is returned when a port is not whitelisted.
type ErrPortNotAllowed struct {
	Port    int
	Message string
}

func (e *ErrPortNotAllowed) Error() string { return e.Message }

// ErrDomainBlocked is returned when a domain is blocked.
type ErrDomainBlocked struct {
	Domain  string
	Message string
}

func (e *ErrDomainBlocked) Error() string { return e.Message }

// ErrDNSBlocked is returned when DNS is blocked.
type ErrDNSBlocked struct {
	Message string
}

func (e *ErrDNSBlocked) Error() string { return e.Message }

// ErrResponseBodyTooLarge is returned when response exceeds size limit.
type ErrResponseBodyTooLarge struct {
	Size    int64
	Limit   int64
	Message string
}

func (e *ErrResponseBodyTooLarge) Error() string { return e.Message }

// ErrRequestBodyTooLarge is returned when request exceeds size limit.
type ErrRequestBodyTooLarge struct {
	Size    int64
	Limit   int64
	Message string
}

func (e *ErrRequestBodyTooLarge) Error() string { return e.Message }
