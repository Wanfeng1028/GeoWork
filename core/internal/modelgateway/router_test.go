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

// TestChatRoutesByContextMode pins the doc/25 R1 fix: the Router reads
// the mode from the context (WithMode), not by scanning prompt text.
// The old inferMode was dead code — no system prompt ever embedded a
// "Mode:" marker, so only wildcard rules could ever match.
func TestChatRoutesByContextMode(t *testing.T) {
	codeCalled, workCalled := 0, 0
	codeSrv := chatServer(t, "code-provider", 10, &codeCalled)
	defer codeSrv.Close()
	workSrv := chatServer(t, "work-provider", 10, &workCalled)
	defer workSrv.Close()

	router := NewRouter("work", zap.NewNop()).
		AddProvider(providerFor("code", codeSrv.URL)).
		AddProvider(providerFor("work", workSrv.URL)).
		SetRules([]RoutingRule{
			{Mode: "Code", ProviderID: "code"},
		})

	// Mode "Code" on the context hits the rule → code provider.
	ctx := WithMode(context.Background(), "Code")
	resp, err := router.Chat(ctx, []ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err != nil {
		t.Fatalf("Chat with Code mode: %v", err)
	}
	if resp.Choices[0].Message.Content != "code-provider" {
		t.Errorf("routed to %q, want code-provider", resp.Choices[0].Message.Content)
	}
	if codeCalled != 1 || workCalled != 0 {
		t.Errorf("calls: code=%d work=%d, want 1/0", codeCalled, workCalled)
	}

	// No mode on the context → no rule match → default provider.
	resp, err = router.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err != nil {
		t.Fatalf("Chat without mode: %v", err)
	}
	if resp.Choices[0].Message.Content != "work-provider" {
		t.Errorf("routed to %q, want work-provider (default)", resp.Choices[0].Message.Content)
	}
	if workCalled != 1 {
		t.Errorf("work calls = %d, want 1", workCalled)
	}
}

func TestModeFromContext(t *testing.T) {
	if got := ModeFromContext(context.Background()); got != "" {
		t.Errorf("empty ctx mode = %q, want \"\"", got)
	}
	ctx := WithMode(context.Background(), "Paper")
	if got := ModeFromContext(ctx); got != "Paper" {
		t.Errorf("mode = %q, want Paper", got)
	}
	// Empty mode is not stored — ctx stays wildcard.
	if got := ModeFromContext(WithMode(context.Background(), "")); got != "" {
		t.Errorf("empty WithMode mode = %q, want \"\"", got)
	}
	if got := ModeFromContext(nil); got != "" {
		t.Errorf("nil ctx mode = %q, want \"\"", got)
	}
}

// streamBodyWithUsage is an SSE stream whose trailing event carries usage
// (10 prompt + 5 completion tokens), mirroring the OpenAI
// stream_options.include_usage shape. Blank lines delimit SSE events —
// the parser only dispatches accumulated data: lines on a blank line.
const streamBodyWithUsage = "data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n" +
	"\n" +
	"data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5,\"total_tokens\":15}}\n" +
	"\n" +
	"data: [DONE]\n" +
	"\n"

// TestStreamChatRecordsCost pins the doc/25 R2 fix: streaming calls used
// to bypass cost recording entirely (recordCost only ran on the
// non-streaming path). The trailing usage chunk must reach the
// CostController once the stream completes.
func TestStreamChatRecordsCost(t *testing.T) {
	srv := sseServer(t, streamBodyWithUsage, nil)
	defer srv.Close()

	prov := providerFor("primary", srv.URL)
	prov.PricePer1KInput = 1.0 // $1/1K tokens → 10 tokens = $0.01
	prov.PricePer1KOutput = 2.0 // 5 tokens = $0.01

	r := NewRouter("primary", zap.NewNop()).AddProvider(prov)
	cc := NewCostController(10, 10)
	r.SetCostController(cc)

	ch, err := r.StreamChat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("StreamChat: %v", err)
	}
	for range ch {
		// drain until close
	}

	// 10*1.0/1000 + 5*2.0/1000 = 0.02
	if got := cc.DailySpend(); got != 0.02 {
		t.Errorf("daily spend after stream = %.4f, want 0.02", got)
	}
}

// TestStreamChatBudgetExceededSkipsHTTP: the budget guard must gate
// streaming calls too, not just non-streaming Chat.
func TestStreamChatBudgetExceededSkipsHTTP(t *testing.T) {
	called := 0
	srv := sseServer(t, streamBodyWithUsage, func(r *http.Request) { called++ })
	defer srv.Close()

	r := NewRouter("primary", zap.NewNop()).AddProvider(providerFor("primary", srv.URL))
	cc := NewCostController(0.05, 0)
	cc.Record(0.05) // exhaust the daily budget
	r.SetCostController(cc)

	_, err := r.StreamChat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if !errors.Is(err, ErrBudgetExceeded) {
		t.Fatalf("expected ErrBudgetExceeded, got: %v", err)
	}
	if called != 0 {
		t.Errorf("provider must not be contacted when over budget, called %d times", called)
	}
}

// TestChatWithFallbackMaxRetries pins the doc/25 R2 fix: RoutingRule.MaxRetries
// was declared but never consulted. With MaxRetries=2 a failing primary is
// attempted 3 times (1 initial + 2 retries) before the fallback is used.
func TestChatWithFallbackMaxRetries(t *testing.T) {
	primaryCalls := 0
	fallbackCalls := 0
	// 400 is non-retryable at the HTTP-client level, so each router-level
	// attempt fails fast without backoff sleeps.
	primary := failServer(t, http.StatusBadRequest, &primaryCalls)
	defer primary.Close()
	fallback := chatServer(t, "from-fallback", 50, &fallbackCalls)
	defer fallback.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.AddProvider(providerFor("fallback", fallback.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary", FallbackID: "fallback", MaxRetries: 2}})

	resp, err := r.ChatWithFallback(context.Background(), "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err != nil {
		t.Fatalf("expected fallback to succeed, got error: %v", err)
	}
	if resp.Choices[0].Message.Content != "from-fallback" {
		t.Errorf("unexpected response: %+v", resp)
	}
	if primaryCalls != 3 {
		t.Errorf("primary called %d times, want 3 (1 + MaxRetries=2)", primaryCalls)
	}
	if fallbackCalls != 1 {
		t.Errorf("fallback called %d times, want 1", fallbackCalls)
	}
}

// TestChatWithFallbackMaxRetriesStopsOnContextCancel: retries must stop
// immediately once the context is done — no point burning budget on a
// call the caller already abandoned.
func TestChatWithFallbackMaxRetriesStopsOnContextCancel(t *testing.T) {
	primaryCalls := 0
	primary := failServer(t, http.StatusBadRequest, &primaryCalls)
	defer primary.Close()

	r := NewRouter("primary", zap.NewNop())
	r.AddProvider(providerFor("primary", primary.URL))
	r.SetRules([]RoutingRule{{Mode: "work", TaskType: "", ProviderID: "primary", MaxRetries: 5}})

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already canceled before the call

	if _, err := r.ChatWithFallback(ctx, "work", "", []ChatMessage{{Role: "user", Content: "hi"}}, nil, false); err == nil {
		t.Fatalf("expected error with canceled context")
	}
	if primaryCalls > 1 {
		t.Errorf("primary called %d times, want at most 1 after cancel", primaryCalls)
	}
}
