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

	// Attempt to capture screenshot via Playwright if available.
	// The playwright bridge is configured when the controller is created.
	// If no browser is configured, return page metadata as fallback.
	if s.Browser != nil && s.Page != nil {
		imgData, pwWidth, pwHeight, err := s.Browser.CaptureScreenshot(ctx, s.Page, format, quality)
		if err == nil {
			screenshot := &Screenshot{
				SessionID: sessionID,
				Data:      base64.StdEncoding.EncodeToString(imgData),
				Width:     pwWidth,
				Height:    pwHeight,
				Timestamp: time.Now(),
				Format:    format,
				Quality:   quality,
			}
			s.Screenshot = screenshot.Data
			s.UpdatedAt = time.Now()
			c.log.Info("screenshot captured via Playwright",
				zap.String("sessionId", sessionID),
				zap.Int("width", pwWidth),
				zap.Int("height", pwHeight),
			)
			return screenshot, nil
		}
		c.log.Warn("Playwright screenshot failed, falling back to page metadata",
			zap.String("sessionId", sessionID),
			zap.Error(err),
		)
	}

	// Fallback: return page info as a text-based response
	screenshot := &Screenshot{
		SessionID: sessionID,
		Data:      base64.StdEncoding.EncodeToString([]byte("Page: " + s.URL + "\nTitle: " + s.Title)),
		Width:     1280,
		Height:    720,
		Timestamp: time.Now(),
		Format:    format,
		Quality:   quality,
	}

	s.Screenshot = screenshot.Data
	s.UpdatedAt = time.Now()

	c.log.Info("screenshot captured (fallback: page metadata)",
		zap.String("sessionId", sessionID),
		zap.String("url", s.URL),
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

	// Attempt to extract text via Playwright if available.
	if s.Browser != nil && s.Page != nil {
		text, err := s.Browser.ExtractText(s.Page)
		if err == nil {
			s.LastText = text
			s.UpdatedAt = time.Now()
			c.log.Info("text extracted via Playwright",
				zap.String("sessionId", sessionID),
				zap.Int("length", len(text)),
			)
			return text, nil
		}
		c.log.Warn("Playwright text extraction failed, falling back to page metadata",
			zap.String("sessionId", sessionID),
			zap.Error(err),
		)
	}

	// Fallback: return page metadata
	text := fmt.Sprintf("Page: %s\nTitle: %s\nLast updated: %s", s.URL, s.Title, s.UpdatedAt.Format(time.RFC3339))
	s.LastText = text
	s.UpdatedAt = time.Now()
	return text, nil
}
