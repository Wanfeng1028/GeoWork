// GeoWork Go Core - Runtime token authentication
//
// The desktop runtime serves a privileged local API (agent runs, tool
// execution, approval resolution) on 127.0.0.1. Binding to loopback
// stops remote hosts but NOT other local processes or cross-origin
// browser attacks: any web page can open a WebSocket to
// ws://127.0.0.1:8765 (CORS does not govern WS handshakes) and any
// local process can POST directly.
//
// Token contract (v1, shared with the Electron shell — see qwen/glm
// review 2026-08-15):
//
//   - Electron (the parent process) mints a random token and injects
//     it into the runtime via the GEOWORK_RUNTIME_TOKEN env var.
//   - HTTP clients send it as the X-GeoWork-Token header.
//   - WebSocket clients send it as the ?token= query parameter (the
//     browser WebSocket API cannot set custom headers).
//   - Standalone/debug runs (no env token) mint a random token and
//     print `GEOWORK_RUNTIME_TOKEN=<hex>` on stdout (logs go to
//     stderr) so curl users can pick it up.
//   - GEOWORK_INSECURE_NO_AUTH=1 disables all checks for development,
//     with a loud warning. Production never sets it.

package api

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"go.uber.org/zap"
)

const (
	// TokenHeader is the HTTP header carrying the runtime token.
	TokenHeader = "X-GeoWork-Token"
	// TokenEnvVar carries the token from the Electron parent process.
	TokenEnvVar = "GEOWORK_RUNTIME_TOKEN"
	// InsecureEnvVar disables authentication entirely (dev only).
	InsecureEnvVar = "GEOWORK_INSECURE_NO_AUTH"
)

// TokenAuth guards the API with a shared secret plus a WS origin
// allowlist. A nil token with insecure=false still enforces nothing
// (zero-value keeps legacy tests working); NewTokenAuthFromEnv always
// produces a usable token or an explicitly insecure one.
type TokenAuth struct {
	token    string
	insecure bool
}

// NewTokenAuthFromEnv builds the auth from the environment:
// env token (Electron) → generated token on stdout (standalone) →
// insecure mode only when explicitly requested.
func NewTokenAuthFromEnv(stdout io.Writer, log *zap.Logger) *TokenAuth {
	if log == nil {
		log = zap.NewNop()
	}
	a := &TokenAuth{}
	if os.Getenv(InsecureEnvVar) == "1" {
		a.insecure = true
		log.Warn("AUTH DISABLED via " + InsecureEnvVar + "=1: any local process or web page can drive the agent — dev only")
		return a
	}
	a.token = os.Getenv(TokenEnvVar)
	if a.token == "" {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			log.Fatal("generate runtime token", zap.Error(err))
		}
		a.token = hex.EncodeToString(buf)
		if stdout != nil {
			// stdout is reserved for this handshake line; zap logs to stderr.
			fmt.Fprintf(stdout, "%s=%s\n", TokenEnvVar, a.token)
		}
	}
	return a
}

// exemptPaths bypass the token: the health probe has no side effects
// and no sensitive data, and process managers poll it without tokens.
func exemptPath(method, path string) bool {
	return method == http.MethodGet && path == "/health"
}

// Middleware enforces the token on every request except /health.
// Both the header and the ?token= query parameter are accepted so a
// single middleware covers plain HTTP and WS upgrade requests.
func (a *TokenAuth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if a == nil || a.insecure || a.token == "" || exemptPath(r.Method, r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		if !a.requestAuthorized(r) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(NewApiError(ErrPermissionDenied, "missing or invalid runtime token"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requestAuthorized compares the presented token in constant time.
func (a *TokenAuth) requestAuthorized(r *http.Request) bool {
	token := r.Header.Get(TokenHeader)
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(a.token)) == 1
}

// CheckHandshake validates a WebSocket upgrade beyond the shared
// middleware: the token plus an origin allowlist. The allowlist keeps
// cross-site pages from driving the agent even if the token leaks
// into a referrer/log somewhere.
func (a *TokenAuth) CheckHandshake(r *http.Request) error {
	if a == nil || a.insecure || a.token == "" {
		return nil
	}
	if !a.requestAuthorized(r) {
		return fmt.Errorf("missing or invalid runtime token")
	}
	if origin := r.Header.Get("Origin"); origin != "" && !isLoopbackOrigin(origin) {
		return fmt.Errorf("origin %q not allowed", origin)
	}
	return nil
}

// isLoopbackOrigin allows only the origins the desktop app legitimately
// uses: the Vite dev server on loopback, and Electron renderer pages
// loaded from file:// (Chromium reports "file://" or "null" depending
// on version). Empty means a non-browser client (curl, Go tests).
func isLoopbackOrigin(origin string) bool {
	switch {
	case origin == "" || origin == "null" || origin == "file://":
		return true
	case strings.HasPrefix(origin, "http://localhost:"),
		strings.HasPrefix(origin, "http://127.0.0.1:"):
		return true
	default:
		return false
	}
}
