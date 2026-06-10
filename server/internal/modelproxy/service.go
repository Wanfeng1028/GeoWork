// Package modelproxy provides cloud model gateway proxy.
package modelproxy

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store     *storage.Store
	providers map[string]*ProviderConfig
	Mu        sync.RWMutex
}

type ProviderConfig struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	BaseURL  string `json:"base_url"`
	APIKey   string `json:"api_key"`
	Enabled  bool   `json:"enabled"`
	Fallback bool   `json:"fallback"`
}

func NewService(store *storage.Store) *Service {
	return &Service{
		store:     store,
		providers: make(map[string]*ProviderConfig),
	}
}

// AddProvider handles adding a provider config.
func (s *Service) AddProvider(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req ProviderConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	req.ID = user.ID + "_" + req.ID
	req.Enabled = true

	s.Mu.Lock()
	s.providers[req.ID] = &req
	s.Mu.Unlock()

	c.JSON(http.StatusCreated, req)
}

// ListProviders handles GET /api/model/providers
func (s *Service) ListProviders(c *gin.Context) {
	s.Mu.RLock()
	result := make([]ProviderConfig, 0, len(s.providers))
	for _, p := range s.providers {
		pCopy := *p
		pCopy.APIKey = "***" // mask key
		result = append(result, pCopy)
	}
	s.Mu.RUnlock()

	c.JSON(http.StatusOK, result)
}

// ListModels handles GET /api/model/models
func (s *Service) ListModels(c *gin.Context) {
	providerID := c.Query("provider")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider required"})
		return
	}

	s.Mu.RLock()
	provider, ok := s.providers[providerID]
	s.Mu.RUnlock()

	if !ok || !provider.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	// Proxy model list to upstream
	resp, err := http.Get(provider.BaseURL + "/v1/models")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	var modelsResp struct {
		Data []gin.H `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&modelsResp)

	c.JSON(http.StatusOK, gin.H{
		"models": modelsResp.Data,
	})
}

// Chat handles POST /api/model/chat
func (s *Service) Chat(c *gin.Context) {
	providerID := c.GetString("provider_id")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider required"})
		return
	}

	var req gin.H
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	s.Mu.RLock()
	provider, ok := s.providers[providerID]
	s.Mu.RUnlock()

	if !ok || !provider.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	// Proxy chat request
	body, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/v1/chat/completions"

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Post(upstreamURL, "application/json", bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	// Record usage
	go recordUsage(s.store, c.GetString("user_id"), "model_requests", 1, req["model"].(string))

	// Proxy response
	respBody, _ := io.ReadAll(resp.Body)
	var proxyResp gin.H
	json.Unmarshal(respBody, &proxyResp)

	c.JSON(http.StatusOK, proxyResp)
}

// Stream handles POST /api/model/stream
func (s *Service) Stream(c *gin.Context) {
	providerID := c.GetString("provider_id")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider required"})
		return
	}

	var req gin.H
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	s.Mu.RLock()
	provider, ok := s.providers[providerID]
	s.Mu.RUnlock()

	if !ok || !provider.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	// Proxy streaming request
	body, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/v1/chat/completions"

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(upstreamURL, "application/json", bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Status(http.StatusOK)

	io.Copy(c.Writer, resp.Body)
}

func getUserFromContext(c *gin.Context) *storage.User {
	val, ok := c.Get("user")
	if !ok {
		return nil
	}
	u, ok := val.(*storage.User)
	if !ok {
		return nil
	}
	return u
}

func recordUsage(store *storage.Store, userID string, eventType string, amount int64, model string) {
	event := &storage.UsageEvent{
		ID:        generateID(),
		UserID:    userID,
		Type:      eventType,
		Amount:    amount,
		Model:     model,
		Timestamp: time.Now(),
	}
	store.Mu.Lock()
	store.UsageEvents = append(store.UsageEvents, event)
	store.Mu.Unlock()
}

func generateID() string {
	return "mp_" + time.Now().Format("20060102150405")
}
