package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{BaseURL: baseURL, HTTP: &http.Client{Timeout: 20 * time.Second}}
}

func (c *Client) Health(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	err := c.get(ctx, "/health", &out)
	return out, err
}

func (c *Client) InspectDataset(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/gdal/inspect-dataset", payload, &out)
	return out, err
}

func (c *Client) SearchOpenAlex(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/papers/openalex-search", payload, &out)
	return out, err
}

func (c *Client) ParsePDF(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/papers/parse-pdf", payload, &out)
	return out, err
}

func (c *Client) IndexKnowledge(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/knowledge/index", payload, &out)
	return out, err
}

func (c *Client) CheckQGIS(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/qgis/check", payload, &out)
	return out, err
}

// GenerateNDVI forwards an NDVI analysis request to the Python worker.
func (c *Client) GenerateNDVI(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/ndvi/analyze", payload, &out)
	return out, err
}

// WriteReport forwards a report generation request to the Python worker.
func (c *Client) WriteReport(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/office/write-report", payload, &out)
	return out, err
}

// GetNdvHistory retrieves NDVI analysis history from the Python worker.
func (c *Client) GetNdvHistory(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/ndvi/history", payload, &out)
	return out, err
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("worker returned %s", resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) post(ctx context.Context, path string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("worker returned %s", resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
