package modelgateway

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.uber.org/zap"
)

// chatServer returns an httptest server that answers /v1/chat/completions
// with a fixed 200 response carrying the given content and token usage.
func chatServer(t *testing.T, content string, totalTokens int, called *int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if called != nil {
			*called++
		}
		w.Header().Set("Content-Type", "application/json")
		resp := ChatCompletionResponse{
			ID:    "cmpl-test",
			Model: "test-model",
			Choices: []Choice{{
				Index:        0,
				Message:      ResponseMessage{Role: "assistant", Content: content},
				FinishReason: "stop",
			}},
			Usage: &UsageInfo{TotalTokens: totalTokens},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
}

// failServer returns an httptest server that always responds with the given
// status code. A 4xx code is non-retryable, so the client fails fast without
// burning the retry backoff sleeps.
func failServer(t *testing.T, status int, called *int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if called != nil {
			*called++
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"error":"boom"}`))
	}))
}

func providerFor(id, baseURL string) *ModelProvider {
	return &ModelProvider{
		ID:           id,
		Name:         id,
		Kind:         "openai_compatible",
		BaseURL:      baseURL,
		DefaultModel: "test-model",
		Enabled:      true,
	}
}

func TestRouteRuleMatching(t *testing.T) {
	build := func() *Router {
		r := NewRouter("default-prov", zap.NewNop())
		r.AddProvider(providerFor("default-prov", "http://default"))
		r.AddProvider(providerFor("fast", "http://fast"))
		r.AddProvider(providerFor("smart", "http://smart"))
		return r
	}

	cases := []struct {
		name     string
		rules    []RoutingRule
		mode     string
		taskType string
		wantID   string
		wantErr  bool
	}{
		{
			name:     "exact mode+taskType match",
			rules:    []RoutingRule{{Mode: "work", TaskType: "planning", ProviderID: "smart"}},
			mode:     "work",
			taskType: "planning",
			wantID:   "smart",
		},
		{
			name:     "empty TaskType is wildcard",
			rules:    []RoutingRule{{Mode: "work", TaskType: "", ProviderID: "fast"}},
			mode:     "work",
			taskType: "anything",
			wantID:   "fast",
		},
		{
			name:     "empty Mode is wildcard",
			rules:    []RoutingRule{{Mode: "", TaskType: "summary", ProviderID: "fast"}},
			mode:     "code",
			taskType: "summary",
			wantID:   "fast",
		},
		{
			name: "first matching rule wins",
			rules: []RoutingRule{
				{Mode: "work", TaskType: "", ProviderID: "fast"},
				{Mode: "work", TaskType: "planning", ProviderID: "smart"},
			},
			mode:     "work",
			taskType: "planning",
			wantID:   "fast",
		},
		{
			name:     "no rule matches falls back to default",
			rules:    []RoutingRule{{Mode: "code", TaskType: "", ProviderID: "smart"}},
			mode:     "work",
			taskType: "",
			wantID:   "default-prov",
		},
		{
			name:     "rule provider missing and no fallback errors",
			rules:    []RoutingRule{{Mode: "work", TaskType: "", ProviderID: "ghost"}},
			mode:     "work",
			taskType: "",
			wantErr:  true,
		},
		{
			name:     "rule provider missing uses fallback",
			rules:    []RoutingRule{{Mode: "work", TaskType: "", ProviderID: "ghost", FallbackID: "fast"}},
			mode:     "work",
			taskType: "",
			wantID:   "fast",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := build()
			r.SetRules(tc.rules)
			p, err := r.Route(tc.mode, tc.taskType)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got provider %v", p)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if p.ID != tc.wantID {
				t.Errorf("Route returned %q, want %q", p.ID, tc.wantID)
			}
		})
	}
}

func TestRouteNoProviders(t *testing.T) {
	r := NewRouter("", zap.NewNop())
	if _, err := r.Route("work", ""); err == nil {
		t.Fatalf("expected error when no providers registered")
	}
}

func TestRouteDefaultIDUnregisteredReturnsSomeProvider(t *testing.T) {
	// When defaultID is empty/unregistered, Route falls back to "some"
	// registered provider. Map iteration order is nondeterministic, so we only
	// assert a registered provider is returned, not which one.
	r := NewRouter("missing-default", zap.NewNop())
	r.AddProvider(providerFor("a", "http://a"))
	r.AddProvider(providerFor("b", "http://b"))
	p, err := r.Route("work", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.ID != "a" && p.ID != "b" {
		t.Errorf("expected a registered provider, got %q", p.ID)
	}
}

func TestChatWithFallbackPrimarySuccess(t *testing.T) {
	primaryCalls := 0
	primary := chatServer(t, "from-primary", 100, &primaryCalls)
	defer primary.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary"}})

	resp, err := r.ChatWithFallback(context.Background(), "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content != "from-primary" {
		t.Errorf("unexpected response: %+v", resp)
	}
	if primaryCalls != 1 {
		t.Errorf("primary called %d times, want 1", primaryCalls)
	}
}

func TestChatWithFallbackPrimaryFailsUsesFallback(t *testing.T) {
	primaryCalls := 0
	fallbackCalls := 0
	// 400 is non-retryable so the primary fails fast (no backoff sleeps).
	primary := failServer(t, http.StatusBadRequest, &primaryCalls)
	defer primary.Close()
	fallback := chatServer(t, "from-fallback", 50, &fallbackCalls)
	defer fallback.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.AddProvider(providerFor("fallback", fallback.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary", FallbackID: "fallback"}})

	resp, err := r.ChatWithFallback(context.Background(), "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err != nil {
		t.Fatalf("expected fallback to succeed, got error: %v", err)
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content != "from-fallback" {
		t.Errorf("expected fallback response, got %+v", resp)
	}
	if fallbackCalls != 1 {
		t.Errorf("fallback called %d times, want 1", fallbackCalls)
	}
}

func TestChatWithFallbackBothFail(t *testing.T) {
	primary := failServer(t, http.StatusBadRequest, nil)
	defer primary.Close()
	fallback := failServer(t, http.StatusBadRequest, nil)
	defer fallback.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.AddProvider(providerFor("fallback", fallback.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary", FallbackID: "fallback"}})

	if _, err := r.ChatWithFallback(context.Background(), "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false); err == nil {
		t.Fatalf("expected error when both primary and fallback fail")
	}
}

func TestChatWithFallbackNoFallbackConfigured(t *testing.T) {
	primary := failServer(t, http.StatusBadRequest, nil)
	defer primary.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary"}})

	if _, err := r.ChatWithFallback(context.Background(), "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false); err == nil {
		t.Fatalf("expected primary error when no fallback configured")
	}
}

func TestChatWithFallbackBudgetExceededSkipsHTTP(t *testing.T) {
	called := 0
	primary := chatServer(t, "should-not-reach", 10, &called)
	defer primary.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary"}})

	// Exhaust the daily budget so the guard trips before any HTTP call.
	cc := NewCostController(0.05, 0)
	cc.Record(0.05)
	r.SetCostController(cc)

	_, err := r.ChatWithFallback(context.Background(), "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err == nil {
		t.Fatalf("expected ErrBudgetExceeded")
	}
	if !errors.Is(err, ErrBudgetExceeded) {
		t.Errorf("expected budget error, got: %v", err)
	}
	if called != 0 {
		t.Errorf("provider must not be contacted when over budget, called %d times", called)
	}
}

func TestInferMode(t *testing.T) {
	cases := []struct {
		name     string
		messages []ChatMessage
		want     string
	}{
		{
			name:     "mode in system message",
			messages: []ChatMessage{{Role: "system", Content: "You are helpful. Mode: code"}},
			want:     "code",
		},
		{
			name:     "mode with tabs and extra spaces",
			messages: []ChatMessage{{Role: "system", Content: "Mode:\t  research now"}},
			want:     "research",
		},
		{
			name:     "no system message",
			messages: []ChatMessage{{Role: "user", Content: "Mode: code"}},
			want:     "",
		},
		{
			name:     "mode token in user message ignored",
			messages: []ChatMessage{{Role: "system", Content: "hello"}, {Role: "user", Content: "Mode: code"}},
			want:     "",
		},
		{
			name:     "mode at exact string end returns empty",
			messages: []ChatMessage{{Role: "system", Content: "Mode:"}},
			want:     "",
		},
		{
			name:     "mode followed immediately by newline returns empty",
			messages: []ChatMessage{{Role: "system", Content: "Mode:\ncode"}},
			want:     "",
		},
		{
			name:     "empty messages",
			messages: nil,
			want:     "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := inferMode(tc.messages); got != tc.want {
				t.Errorf("inferMode = %q, want %q", got, tc.want)
			}
		})
	}
}
