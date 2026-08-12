// GeoWork Go Core - Browser Tool Registration (P2-7 §8.4)
//
// RegisterBrowserTools wires the existing browserbridge.Controller into the
// ToolRegistry as three callable tools so the ReAct loop can drive a browser
// session: browser_control (navigate / session lifecycle), screenshot (capture
// + OCR), and network_request (HTTP call gated by the URL sandbox).
//
// Policies for these tools are already declared in tool_policy.go — this file
// only supplies the executable implementations. Risk levels and approval
// requirements are enforced by the registry's governance path
// (ApprovalGovernor + sandbox URL check) and the state machine whitelist in
// aiagent/state_machine.go.

package toolregistry

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"

	"geowork/core/internal/browserbridge"
	"geowork/core/internal/sandbox"

	"go.uber.org/zap"
)

// RegisterBrowserTools registers browser_control / screenshot / network_request
// against the supplied browserbridge.Controller. If ctrl is nil the function
// logs a warning and returns nil so callers without a browser (e.g. tests,
// headless deployments) still come up cleanly — the tools simply will not be
// registered, mirroring RegisterWorkerTools' non-fatal-on-failure contract.
func RegisterBrowserTools(reg *Registry, ctrl *browserbridge.Controller, log *zap.Logger) error {
	if reg == nil {
		return fmt.Errorf("registry is nil")
	}
	if ctrl == nil {
		if log != nil {
			log.Warn("browser controller not provided; skipping browser tool registration")
		}
		return nil
	}

	tools := []Tool{
		// browser_control — High risk, requires approval.
		NewBuilder("browser_control").
			Description("Control a browser session: create/delete session, navigate, go back/forward, refresh. Navigation is gated by the URL sandbox policy.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action": map[string]any{
						"type":        "string",
						"enum":        []string{"navigate", "back", "forward", "refresh", "create_session", "delete_session"},
						"description": "Browser action to perform",
					},
					"sessionId": map[string]any{"type": "string", "description": "Browser session ID (required for navigate/back/forward/refresh/delete_session)"},
					"url":       map[string]any{"type": "string", "description": "URL to navigate to (required for navigate action)"},
				},
				"required": []string{"action"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sessionId": map[string]any{"type": "string"},
					"url":       map[string]any{"type": "string"},
					"title":     map[string]any{"type": "string"},
					"action":    map[string]any{"type": "string"},
					"deleted":   map[string]any{"type": "boolean"},
				},
			}).
			Permission("exec").
			RiskLevel("high").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				action, _ := args["action"].(string)
				switch action {
				case "create_session":
					sess := ctrl.CreateSession()
					return map[string]any{"sessionId": sess.ID, "url": sess.URL}, nil
				case "navigate":
					sessionID, _ := args["sessionId"].(string)
					if sessionID == "" {
						return nil, fmt.Errorf("sessionId is required for navigate")
					}
					rawURL, _ := args["url"].(string)
					if rawURL == "" {
						return nil, fmt.Errorf("url is required for navigate")
					}
					// P2-7 §8.7: enforce browser URL sandbox.
					if err := sandbox.CheckURLAllowed(rawURL); err != nil {
						return nil, fmt.Errorf("URL blocked by sandbox: %w", err)
					}
					if err := ctrl.Navigate(sessionID, rawURL); err != nil {
						return nil, err
					}
					sess, _ := ctrl.GetSession(sessionID)
					title := ""
					if sess != nil {
						title = sess.Title
					}
					return map[string]any{"sessionId": sessionID, "url": rawURL, "title": title}, nil
				case "back":
					sessionID, _ := args["sessionId"].(string)
					if err := ctrl.GoBack(sessionID); err != nil {
						return nil, err
					}
					return map[string]any{"sessionId": sessionID, "action": "back"}, nil
				case "forward":
					sessionID, _ := args["sessionId"].(string)
					if err := ctrl.GoForward(sessionID); err != nil {
						return nil, err
					}
					return map[string]any{"sessionId": sessionID, "action": "forward"}, nil
				case "refresh":
					sessionID, _ := args["sessionId"].(string)
					if err := ctrl.Refresh(sessionID); err != nil {
						return nil, err
					}
					return map[string]any{"sessionId": sessionID, "action": "refresh"}, nil
				case "delete_session":
					sessionID, _ := args["sessionId"].(string)
					if err := ctrl.DeleteSession(sessionID); err != nil {
						return nil, err
					}
					return map[string]any{"sessionId": sessionID, "deleted": true}, nil
				default:
					return nil, fmt.Errorf("unknown browser action: %s", action)
				}
			}).
			Build(),

		// screenshot — Medium risk, no approval.
		NewBuilder("screenshot").
			Description("Capture a screenshot of the browser page and optionally extract visible text via OCR. Does not require approval.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sessionId":   map[string]any{"type": "string", "description": "Browser session ID"},
					"format":      map[string]any{"type": "string", "enum": []string{"png", "jpeg"}, "description": "Image format (default png)"},
					"extractText": map[string]any{"type": "boolean", "description": "Whether to extract visible page text"},
				},
				"required": []string{"sessionId"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sessionId":   map[string]any{"type": "string"},
					"width":       map[string]any{"type": "integer"},
					"height":      map[string]any{"type": "integer"},
					"imageBase64": map[string]any{"type": "string"},
					"text":        map[string]any{"type": "string"},
				},
			}).
			Permission("read").
			RiskLevel("medium").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				sessionID, _ := args["sessionId"].(string)
				if sessionID == "" {
					return nil, fmt.Errorf("sessionId is required")
				}
				format, _ := args["format"].(string)
				if format == "" {
					format = "png"
				}
				quality := 80
				shot, err := ctrl.CaptureScreenshot(ctx, sessionID, format, quality)
				if err != nil {
					return nil, err
				}
				result := map[string]any{
					"sessionId":   sessionID,
					"width":       shot.Width,
					"height":      shot.Height,
					"imageBase64": shot.Data,
				}
				if extract, _ := args["extractText"].(bool); extract {
					text, _ := ctrl.ExtractText(sessionID)
					result["text"] = text
				}
				return result, nil
			}).
			Build(),

		// network_request — High risk, requires approval. URL sandbox enforced.
		NewBuilder("network_request").
			Description("Send an HTTP request and return the response. The URL must pass the browser sandbox policy (http/https only, no loopback/private addresses by default).").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"url":     map[string]any{"type": "string", "description": "Request URL"},
					"method":  map[string]any{"type": "string", "enum": []string{"GET", "POST", "PUT", "DELETE"}, "description": "HTTP method"},
					"headers": map[string]any{"type": "object", "description": "Request headers"},
					"body":    map[string]any{"type": "string", "description": "Request body (for POST/PUT)"},
				},
				"required": []string{"url", "method"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"status":   map[string]any{"type": "integer"},
					"headers":  map[string]any{"type": "object"},
					"body":     map[string]any{"type": "string"},
					"bodySize": map[string]any{"type": "integer"},
				},
			}).
			Permission("exec").
			RiskLevel("high").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				rawURL, _ := args["url"].(string)
				method, _ := args["method"].(string)
				method = strings.ToUpper(method)
				if method == "" {
					method = "GET"
				}
				// Enforce browser URL sandbox.
				if err := sandbox.CheckURLAllowed(rawURL); err != nil {
					return nil, fmt.Errorf("URL blocked by sandbox: %w", err)
				}

				var bodyReader io.Reader
				if body, _ := args["body"].(string); body != "" {
					bodyReader = strings.NewReader(body)
				}
				req, err := http.NewRequestWithContext(ctx, method, rawURL, bodyReader)
				if err != nil {
					return nil, fmt.Errorf("build request: %w", err)
				}
				if headers, ok := args["headers"].(map[string]any); ok {
					for k, v := range headers {
						switch sv := v.(type) {
						case string:
							req.Header.Set(k, sv)
						case []string:
							for _, hv := range sv {
								req.Header.Add(k, hv)
							}
						default:
							req.Header.Set(k, fmt.Sprintf("%v", v))
						}
					}
				}

				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					return nil, err
				}
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)

				// Flatten response headers into a JSON-friendly map.
				flatHeaders := make(map[string]any, len(resp.Header))
				for k, vs := range resp.Header {
					if len(vs) == 1 {
						flatHeaders[k] = vs[0]
					} else {
						flatHeaders[k] = vs
					}
				}
				return map[string]any{
					"status":   resp.StatusCode,
					"headers":  flatHeaders,
					"body":     string(body),
					"bodySize": len(body),
				}, nil
			}).
			Build(),

		// paper_search — Low risk, optional. Surfaces the existing OpenAlex
		// paper search as a callable tool so the model can look up literature
		// without going through browser_control round-trips.
		NewBuilder("paper_search").
			Description("Search academic papers via OpenAlex. Returns titles, authors, year, citation count and DOI URL.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query":  map[string]any{"type": "string", "description": "Search query"},
					"limit":  map[string]any{"type": "integer", "description": "Max results (default 10)"},
				},
				"required": []string{"query"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"results": map[string]any{"type": "array"},
					"count":   map[string]any{"type": "integer"},
				},
			}).
			Permission("read").
			RiskLevel("low").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				query, _ := args["query"].(string)
				if query == "" {
					return nil, fmt.Errorf("query is required")
				}
				limit := 10
				if l, ok := args["limit"].(int); ok && l > 0 {
					limit = l
				}
				results, err := browserbridge.OpenAlexSearch(ctx, query)
				if err != nil {
					return nil, err
				}
				if limit > 0 && len(results) > limit {
					results = results[:limit]
				}
				return map[string]any{
					"results": results,
					"count":   len(results),
				}, nil
			}).
			Build(),
	}

	registered := 0
	for _, t := range tools {
		if reg.IsRegistered(t.Name()) {
			continue
		}
		if err := reg.Register(t); err != nil {
			if log != nil {
				log.Warn("failed to register browser tool",
					zap.String("tool", t.Name()),
					zap.Error(err),
				)
			}
			continue
		}
		registered++
	}
	if log != nil {
		log.Info("browser tools registered", zap.Int("count", registered))
	}
	// touch base64 to keep imports tidy if encoding branches expand later
	_ = base64.StdEncoding
	return nil
}
