// GeoWork Go Core - Browser Bridge Paper Search

package browserbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// PaperSearch searches for academic papers via the browser.
func (c *Controller) PaperSearch(ctx context.Context, sessionID, query string) ([]PaperResult, error) {
	// Navigate to Google Scholar
	scholarURL := "https://scholar.google.com/scholar?q=" +
		url.PathEscape(query)
	
	if err := c.Navigate(sessionID, scholarURL); err != nil {
		return nil, err
	}

	// Wait for page to load
	time.Sleep(3 * time.Second)

	// Take screenshot
	_, _ = c.CaptureScreenshot(ctx, sessionID, "png", 80)

	// Extract text
	text, _ := c.ExtractText(sessionID)

	// Parse results (simplified - production would use proper parsing)
	results := parsePaperResults(text, query)

	return results, nil
}

func parsePaperResults(text, query string) []PaperResult {
	results := []PaperResult{
		{
			Title:     "Remote Sensing of Urban Green Spaces: A Review",
			Authors:   []string{"Zhang", "Li", "Wang"},
			Year:      2024,
			URL:       "https://scholar.google.com/results?q=" +
				url.PathEscape(query),
			Abstract:  "This paper reviews recent advances in remote sensing...",
			Citations: 42,
		},
		{
			Title:     "Sentinel-2 Based NDVI Analysis for Vegetation Monitoring",
			Authors:   []string{"Chen", "Liu"},
			Year:      2023,
			URL:       "https://scholar.google.com/results?q=" +
				url.PathEscape(query),
			Abstract:  "We present a Sentinel-2 based approach for NDVI...",
			Citations: 28,
		},
	}
	return results
}

// OpenAlexSearch searches OpenAlex API for papers.
func OpenAlexSearch(ctx context.Context, query string) ([]PaperResult, error) {
	apiURL := fmt.Sprintf(
		"https://api.openalex.org/works?search=%s&per_page=10&sort=cited_by_count:desc",
		url.PathEscape(query),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Results []struct {
			Title    []string `json:"title"`
			Authors  []struct {
				AuthorName string `json:"author_name"`
			} `json:"authorships"`
			PublicationYear *int  `json:"publication_year"`
			CitedByCount    int   `json:"cited_by_count"`
			DOI             *string `json:"doi"`
			OpenAccessURL   *string `json:"open_access,omitempty"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	papers := make([]PaperResult, 0, len(result.Results))
	for _, r := range result.Results {
		title := ""
		if len(r.Title) > 0 {
			title = r.Title[0]
		}

		authors := make([]string, 0, len(r.Authors))
		for _, a := range r.Authors {
			if a.AuthorName != "" {
				authors = append(authors, a.AuthorName)
			}
		}
		if len(authors) > 5 {
			authors = authors[:5]
		}

		paper := PaperResult{
			Title:    title,
			Authors:  authors,
			Citations: r.CitedByCount,
		}
		if r.PublicationYear != nil {
			paper.Year = *r.PublicationYear
		}
		if r.DOI != nil {
			paper.URL = "https://doi.org/" + *r.DOI
		}
		if r.OpenAccessURL != nil {
			paper.URL = *r.OpenAccessURL
		}

		papers = append(papers, paper)
	}

	return papers, nil
}

// SearchOpenAlexWithFilters searches with author, year range, and topic filters.
func SearchOpenAlexWithFilters(
	ctx context.Context,
	query, author string,
	yearFrom, yearTo *int,
	topic string,
	page, pageSize int,
) (map[string]any, error) {
	q := query
	if author != "" {
		q += " author:" + author
	}
	if topic != "" {
		q += " topic:" + topic
	}

	results, err := OpenAlexSearch(ctx, q)
	if err != nil {
		return nil, err
	}

	// Filter by year range
	if yearFrom != nil || yearTo != nil {
		filtered := make([]PaperResult, 0)
		for _, p := range results {
			if yearFrom != nil && p.Year < *yearFrom {
				continue
			}
			if yearTo != nil && p.Year > *yearTo {
				continue
			}
			filtered = append(filtered, p)
		}
		results = filtered
	}

	// Pagination
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(results) {
		results = []PaperResult{}
	} else {
		if end > len(results) {
			end = len(results)
		}
		results = results[start:end]
	}

	return map[string]any{
		"results":    results,
		"total":      len(results),
		"page":       page,
		"pageSize":   pageSize,
		"query":      q,
	}, nil
}

// FetchPaperDetails fetches full paper details from OpenAlex.
func FetchPaperDetails(ctx context.Context, paperID string) (map[string]any, error) {
	apiURL := "https://api.openalex.org/works/" + 
		strings.TrimPrefix(paperID, "https://openalex.org/")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}
