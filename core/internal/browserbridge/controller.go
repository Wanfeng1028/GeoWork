// GeoWork Go Core - Browser Bridge Controller

package browserbridge

import (
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Controller manages browser bridge sessions.
type Controller struct {
	mu       sync.Mutex
	sessions map[string]*Session
	links    []NetworkRequest
	log      *zap.Logger
}

func NewController(log *zap.Logger) *Controller {
	return &Controller{
		sessions: make(map[string]*Session),
		log:      log,
	}
}

// CreateSession creates a new browser session.
func (c *Controller) CreateSession() *Session {
	c.mu.Lock()
	defer c.mu.Unlock()

	s := &Session{
		ID:        fmt.Sprintf("browser_%d", time.Now().UnixNano()),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Tabs: []Tab{
			{ID: "tab_1", URL: "about:blank", Title: "New Tab", Active: true},
		},
	}
	c.sessions[s.ID] = s
	c.log.Info("browser session created", zap.String("id", s.ID))
	return s
}

// Navigate goes to a URL in the active tab.
func (c *Controller) Navigate(sessionID, url string) error {
	c.mu.Lock()
	s, ok := c.sessions[sessionID]
	c.mu.Unlock()

	if !ok {
		return fmt.Errorf("session %s not found", sessionID)
	}

	s.URL = url
	s.Title = url
	s.UpdatedAt = time.Now()
	s.Tabs[0].URL = url
	s.Tabs[0].Title = url

	c.log.Info("browser navigated", zap.String("id", sessionID), zap.String("url", url))
	return nil
}

// GoBack goes back in history.
func (c *Controller) GoBack(sessionID string) error {
	c.mu.Lock()
	s, ok := c.sessions[sessionID]
	c.mu.Unlock()
	if !ok {
		return fmt.Errorf("session %s not found", sessionID)
	}
	s.UpdatedAt = time.Now()
	return nil
}

// GoForward goes forward in history.
func (c *Controller) GoForward(sessionID string) error {
	c.mu.Lock()
	s, ok := c.sessions[sessionID]
	c.mu.Unlock()
	if !ok {
		return fmt.Errorf("session %s not found", sessionID)
	}
	s.UpdatedAt = time.Now()
	return nil
}

// Refresh reloads the current page.
func (c *Controller) Refresh(sessionID string) error {
	return c.Navigate(sessionID, c.sessions[sessionID].URL)
}

// GetSession returns a session by ID.
func (c *Controller) GetSession(id string) (*Session, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	s, ok := c.sessions[id]
	return s, ok
}

// ListSessions returns all sessions.
func (c *Controller) ListSessions() []Session {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]Session, 0, len(c.sessions))
	for _, s := range c.sessions {
		out = append(out, *s)
	}
	return out
}

// DeleteSession removes a session.
func (c *Controller) DeleteSession(id string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.sessions[id]; !ok {
		return fmt.Errorf("session %s not found", id)
	}
	delete(c.sessions, id)
	return nil
}
