// doc/25 S1 regression tests: CORS file:// origins must only be accepted in
// dev mode (GEOWORK_DEV=1), not blanket-allowed in production.
package main

import (
	"testing"
)

func TestIsOriginAllowed_FileDevMode(t *testing.T) {
	whitelist := []string{"https://app.geowork.example"}

	t.Run("file origin allowed in dev", func(t *testing.T) {
		t.Setenv("GEOWORK_DEV", "1")
		if !isOriginAllowed("file://", whitelist) {
			t.Error("file:// origin should be allowed when GEOWORK_DEV=1")
		}
	})

	t.Run("file origin blocked in production", func(t *testing.T) {
		t.Setenv("GEOWORK_DEV", "")
		if isOriginAllowed("file://", whitelist) {
			t.Error("file:// origin must NOT be blanket-allowed in production (doc/25 S1)")
		}
	})

	t.Run("whitelisted origin always allowed", func(t *testing.T) {
		t.Setenv("GEOWORK_DEV", "")
		if !isOriginAllowed("https://app.geowork.example", whitelist) {
			t.Error("whitelisted origin should be allowed")
		}
	})

	t.Run("unknown origin blocked", func(t *testing.T) {
		t.Setenv("GEOWORK_DEV", "")
		if isOriginAllowed("https://evil.example", whitelist) {
			t.Error("unknown origin should be blocked")
		}
	})
}
