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

func (c *Client) SearchGEEDataset(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/gee/search-dataset", payload, &out)
	return out, err
}

func (c *Client) CheckGEEAuth(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/gee/check-auth", payload, &out)
	return out, err
}

func (c *Client) CheckQGISEnv(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/qgis/check-env", payload, &out)
	return out, err
}

func (c *Client) RunQGISProcessing(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/qgis/run-processing", payload, &out)
	return out, err
}

// GenerateNDVIScript forwards a GEE NDVI script generation request to the Python worker.
func (c *Client) GenerateNDVIScript(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/gee/generate-ndvi-script", payload, &out)
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

func (c *Client) WritePPT(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/office/write-ppt", payload, &out)
	return out, err
}

func (c *Client) WriteExcel(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/office/write-excel", payload, &out)
	return out, err
}

func (c *Client) WriteNotebook(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/office/write-notebook", payload, &out)
	return out, err
}

func (c *Client) RasterMetadata(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/raster/metadata", payload, &out)
	return out, err
}

func (c *Client) RasterClip(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/raster/clip", payload, &out)
	return out, err
}

func (c *Client) RasterReproject(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/raster/reproject", payload, &out)
	return out, err
}

func (c *Client) VectorMetadata(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/vector/metadata", payload, &out)
	return out, err
}

func (c *Client) VectorBuffer(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/vector/buffer", payload, &out)
	return out, err
}

func (c *Client) VectorClip(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/vector/clip", payload, &out)
	return out, err
}

func (c *Client) VectorReproject(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/vector/reproject", payload, &out)
	return out, err
}

func (c *Client) WriteCOG(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/raster/write-cog", payload, &out)
	return out, err
}

func (c *Client) ExportMapLayout(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/tools/map/layout-export", payload, &out)
	return out, err
}

// GetNdvHistory retrieves NDVI analysis history from the Python worker.
func (c *Client) GetNdvHistory(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	err := c.post(ctx, "/ndvi/history", payload, &out)
	return out, err
}

// RunTool dispatches a registry-style tool name to the corresponding worker endpoint.
func (c *Client) RunTool(ctx context.Context, toolName string, payload map[string]any) (map[string]any, error) {
	switch toolName {
	case "geo.gee.search_dataset":
		return c.SearchGEEDataset(ctx, payload)
	case "geo.gee.check_auth":
		return c.CheckGEEAuth(ctx, payload)
	case "geo.gee.generate_ndvi_script":
		return c.GenerateNDVIScript(ctx, payload)
	case "geo.ndvi.analyze":
		return c.GenerateNDVI(ctx, payload)
	case "geo.office.write_report":
		return c.WriteReport(ctx, payload)
	case "geo.office.write_ppt":
		return c.WritePPT(ctx, payload)
	case "geo.office.write_excel":
		return c.WriteExcel(ctx, payload)
	case "geo.office.write_notebook":
		return c.WriteNotebook(ctx, payload)
	case "geo.gdal.inspect_dataset":
		return c.InspectDataset(ctx, payload)
	case "geo.raster.metadata":
		return c.RasterMetadata(ctx, payload)
	case "geo.raster.clip":
		return c.RasterClip(ctx, payload)
	case "geo.raster.reproject":
		return c.RasterReproject(ctx, payload)
	case "geo.raster.cog":
		return c.WriteCOG(ctx, payload)
	case "geo.vector.metadata":
		return c.VectorMetadata(ctx, payload)
	case "geo.vector.buffer":
		return c.VectorBuffer(ctx, payload)
	case "geo.vector.clip":
		return c.VectorClip(ctx, payload)
	case "geo.vector.reproject":
		return c.VectorReproject(ctx, payload)
	case "research.openalex.search":
		return c.SearchOpenAlex(ctx, payload)
	case "papers.parse_pdf":
		return c.ParsePDF(ctx, payload)
	case "knowledge.index":
		return c.IndexKnowledge(ctx, payload)
	case "qgis.check":
		return c.CheckQGIS(ctx, payload)
	case "qgis.check_env":
		return c.CheckQGISEnv(ctx, payload)
	case "qgis.processing.run":
		return c.RunQGISProcessing(ctx, payload)
	case "geo.map.layout_export":
		return c.ExportMapLayout(ctx, payload)
	default:
		return nil, fmt.Errorf("unsupported worker tool: %s", toolName)
	}
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
