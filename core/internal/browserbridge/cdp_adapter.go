// GeoWork Go Core - CDP Adapter (P2-7 §8.6)
//
// CDPAdapter implements browserbridge.BrowserInterface against a real
// browser via the Chrome DevTools Protocol. The struct is the integration
// point for a future chromedp / rod dependency; for now the adapter ships
// in a disconnected state that surfaces clear errors so the screenshot.go
// fallback path (returning page metadata) is exercised instead.
//
// Why a stub today: pulling chromedp would add a non-trivial dependency
// tree and require a Chromium binary at runtime. The rest of the P2-7
// surface (tool registration, state-machine whitelist, URL sandbox,
// approval routing) is independent of whether a real browser is attached,
// so we land the wiring now and flip the implementation over when chromedp
// is added to go.mod.

package browserbridge

import (
	"context"
	"errors"
	"fmt"

	"go.uber.org/zap"
)

// ErrCDPNotConnected is returned by every CDPAdapter method when the
// adapter has no live browser context attached. Callers (notably
// screenshot.go) detect this and fall back to the page-metadata path.
var ErrCDPNotConnected = errors.New("cdp adapter is not connected to a real browser; configure chromedp/rod before use")

// CDPAdapter drives a real browser through Chrome DevTools Protocol.
//
// The fields are intentionally minimal so future code can extend them
// without changing the public surface:
//
//	type CDPAdapter struct {
//	    alloc  chromedp.Allocator
//	    ctx    context.Context
//	    cancel context.CancelFunc
//	    log    *zap.Logger
//	    headless bool
//	}
type CDPAdapter struct {
	log       *zap.Logger
	connected bool
}

// NewCDPAdapter returns an unconnected adapter. Use Connect to attach a
// real browser (not yet implemented — pending chromedp dependency).
func NewCDPAdapter(log *zap.Logger) *CDPAdapter {
	return &CDPAdapter{log: log}
}

// Connect is the future hook for establishing a real CDP session.
// Until chromedp is added to go.mod, this returns ErrCDPNotConnected.
func (a *CDPAdapter) Connect(_ context.Context) error {
	if a == nil {
		return ErrCDPNotConnected
	}
	if a.log != nil {
		a.log.Warn("cdp adapter connect requested but no chromedp dependency is present; remaining in stub mode")
	}
	return ErrCDPNotConnected
}

// CaptureScreenshot implements BrowserInterface. Without a real browser
// it returns ErrCDPNotConnected so the caller (screenshot.go) falls back
// to the page-metadata snapshot path.
func (a *CDPAdapter) CaptureScreenshot(_ context.Context, _ any, _ string, _ int) ([]byte, int, int, error) {
	if a == nil || !a.connected {
		return nil, 0, 0, ErrCDPNotConnected
	}
	// Future implementation:
	//   var buf []byte
	//   if err := chromedp.Run(ctx, chromedp.CaptureScreenshot(&buf)); err != nil {
	//       return nil, 0, 0, err
	//   }
	//   w, h := parseImageSize(buf, format)
	//   return buf, w, h, nil
	return nil, 0, 0, fmt.Errorf("cdp adapter connected state not implemented yet")
}

// ExtractText implements BrowserInterface. Without a real browser it
// returns ErrCDPNotConnected so the caller falls back to metadata.
func (a *CDPAdapter) ExtractText(_ any) (string, error) {
	if a == nil || !a.connected {
		return "", ErrCDPNotConnected
	}
	// Future implementation:
	//   var text string
	//   if err := chromedp.Run(ctx, chromedp.Text("body", &text)); err != nil {
	//       return "", err
	//   }
	//   return text, nil
	return "", fmt.Errorf("cdp adapter connected state not implemented yet")
}
