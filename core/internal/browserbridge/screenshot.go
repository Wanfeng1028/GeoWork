// GeoWork Go Core - Browser Bridge Screenshot

package browserbridge

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"go.uber.org/zap"
)

// Screenshot captures the current page view.
type Screenshot struct {
	SessionID string `json:"sessionId"`
	Data      string `json:"data"` // base64 encoded PNG
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Timestamp time.Time `json:"timestamp"`
	Format    string `json:"format"` // png | jpeg
	Quality   int    `json:"quality,omitempty"` // 1-100 for jpeg
}

// CaptureScreenshot takes a screenshot of the active tab.
func (c *Controller) CaptureScreenshot(ctx context.Context, sessionID string, format string, quality int) (*Screenshot, error) {
	c.mu.Lock()
	s, ok := c.sessions[sessionID]
	c.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	// Placeholder: In production this would call Playwright/Puppeteer
	screenshot := &Screenshot{
		SessionID: sessionID,
		Data:      base64.StdEncoding.EncodeToString([]byte("placeholder_screenshot_data")),
		Width:     1280,
		Height:    720,
		Timestamp: time.Now(),
		Format:    format,
		Quality:   quality,
	}

	s.Screenshot = screenshot.Data
	s.UpdatedAt = time.Now()

	c.log.Info("screenshot captured",
		zap.String("sessionId", sessionID),
		zap.Int("width", screenshot.Width),
	)

	return screenshot, nil
}

// ExtractText extracts visible text from the page.
func (c *Controller) ExtractText(sessionID string) (string, error) {
	c.mu.Lock()
	s, ok := c.sessions[sessionID]
	c.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("session %s not found", sessionID)
	}

	// Placeholder: In production this would use Playwright page.textContent()
	return fmt.Sprintf("Page: %s\nTitle: %s", s.URL, s.Title), nil
}
