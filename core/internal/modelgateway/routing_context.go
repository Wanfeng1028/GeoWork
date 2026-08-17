// GeoWork Go Core - routing context keys (doc/25 R1)
//
// The ModelGateway interface (Chat/StreamChat) carries no mode or task
// type, so the Router used to guess the mode by scanning prompt text
// (inferMode) — dead code in practice, since no system prompt ever
// embedded a "Mode:" marker. Mode now rides on the context, set by the
// orchestrator from run.Mode before each model call. This keeps the
// interface unchanged (zero-intrusion, same pattern as
// toolregistry.WithRunID).

package modelgateway

import "context"

type modeContextKey struct{}

// WithMode attaches the agent mode (Work | Code | Paper | Analysis) to
// the context so a Router can select a provider per mode. An empty mode
// routes to wildcard rules.
func WithMode(ctx context.Context, mode string) context.Context {
	if mode == "" {
		return ctx
	}
	return context.WithValue(ctx, modeContextKey{}, mode)
}

// ModeFromContext returns the mode attached by WithMode, or "" when
// absent (wildcard routing).
func ModeFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	mode, _ := ctx.Value(modeContextKey{}).(string)
	return mode
}
