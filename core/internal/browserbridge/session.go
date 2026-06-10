// GeoWork Go Core - Browser Bridge Session

package browserbridge

import (
	"time"
)

// Session represents a browser browsing session.
type Session struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Title     string    `json:"title"`
	Screenshot string  `json:"screenshot,omitempty"`
	Tabs      []Tab     `json:"tabs,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Tab represents a browser tab.
type Tab struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Title string `json:"title"`
	Active bool  `json:"active"`
}

// NetworkRequest logs a network request.
type NetworkRequest struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Method    string    `json:"method"`
	Status    int       `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Size      int64     `json:"size"`
}

// PaperResult stores a paper search result.
type PaperResult struct {
	Title    string   `json:"title"`
	Authors  []string `json:"authors"`
	Year     int      `json:"year"`
	URL      string   `json:"url"`
	Abstract string   `json:"abstract,omitempty"`
	Citations int    `json:"citations,omitempty"`
}
