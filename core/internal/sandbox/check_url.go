// GeoWork Go Core - Browser Sandbox URL Allowlist (P2-7 §8.7)
//
// CheckURLAllowed enforces the browser-tool sandbox boundary on the
// URL dimension. The default policy:
//   - Allow http:// and https:// schemes.
//   - Deny file://, javascript:, data:, view-source: schemes.
//   - Deny loopback / link-local / private addresses unless explicitly
//     enabled (blocks SSRF via the browser tool reaching localhost).
//
// The policy is configurable via Policy fields so deployments that
// need internal access (e.g. to a local OGC service) can opt in.

package sandbox

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// URLPolicy controls what URLs browser tools may visit.
type URLPolicy struct {
	// AllowedSchemes is the set of permitted URL schemes (lowercase).
	// Default {"http", "https"}.
	AllowedSchemes map[string]bool

	// AllowLoopback permits 127.0.0.1, ::1, localhost. Default false
	// (browser tool cannot reach local services).
	AllowLoopback bool

	// AllowPrivate permits RFC1918 / link-local addresses. Default false.
	AllowPrivate bool

	// Blocklist is a list of hostname substrings to deny outright
	// (e.g. ["metadata.google.internal"] to block cloud metadata SSRF).
	Blocklist []string
}

// DefaultURLPolicy returns the restrictive policy suitable for an agent
// running untrusted model output: only public http(s).
func DefaultURLPolicy() URLPolicy {
	return URLPolicy{
		AllowedSchemes: map[string]bool{"http": true, "https": true},
		AllowLoopback:  false,
		AllowPrivate:   false,
		Blocklist: []string{
			"metadata.google.internal",
			"169.254.169.254", // AWS / GCP metadata
			"169.254.169.253",
			"fd00:", // ULA
		},
	}
}

// CheckURLAllowed validates a URL against the policy. Returns nil if
// allowed, an error describing the violation otherwise. The error is
// surfaced to the model so it understands why the call was blocked.
func CheckURLAllowed(rawURL string) error {
	return DefaultURLPolicy().Check(rawURL)
}

// Check validates a URL against this policy.
func (p URLPolicy) Check(rawURL string) error {
	if rawURL == "" {
		return fmt.Errorf("empty URL")
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL %q: %w", rawURL, err)
	}

	scheme := strings.ToLower(u.Scheme)
	if !p.AllowedSchemes[scheme] {
		return fmt.Errorf("scheme %q not allowed (browser sandbox)", scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("URL has no host")
	}
	host = strings.ToLower(host)

	// Blocklist substring check.
	for _, bad := range p.Blocklist {
		if strings.Contains(host, bad) {
			return fmt.Errorf("host %q matches blocklist entry %q", host, bad)
		}
	}

	// Resolve and check IP ranges. We resolve once; the caller's
	// actual request will reuse DNS but for a typical host this is
	// stable enough to catch the common SSRF paths.
	ips, err := net.LookupIP(host)
	if err != nil {
		// If DNS fails, allow it — the actual request will surface
		// the DNS error too, and we don't want to over-block.
		return nil
	}
	for _, ip := range ips {
		if ip.IsLoopback() && !p.AllowLoopback {
			return fmt.Errorf("host %q resolves to loopback %s (not allowed)", host, ip)
		}
		if (ip.IsPrivate() || ip.IsLinkLocalUnicast()) && !p.AllowPrivate {
			return fmt.Errorf("host %q resolves to private %s (not allowed)", host, ip)
		}
		if ip.IsUnspecified() {
			return fmt.Errorf("host %q resolves to unspecified address %s", host, ip)
		}
	}
	return nil
}
