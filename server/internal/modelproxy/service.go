// Package modelproxy provides cloud model gateway proxy.
package modelproxy

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"server/internal/crypto"
	"server/internal/idgen"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store         *storage.Store
	providers     map[string]*ProviderConfig
	mu            sync.RWMutex
	encryptionKey []byte // AES-256 key for API key encryption; nil means plaintext fallback
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
	svc := &Service{
		store:     store,
		providers: make(map[string]*ProviderConfig),
	}
	key, err := crypto.GetEncryptionKey()
	if err != nil {
		log.Printf("[modelproxy] WARNING: %v — API keys will be stored in plaintext (dev mode)", err)
	} else {
		svc.encryptionKey = key
		log.Println("[modelproxy] API key encryption enabled (AES-256-GCM)")
	}
	return svc
}

// AddProvider handles adding a provider config.
func (s *Service) AddProvider(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req ProviderConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	req.ID = user.ID + "_" + req.ID
	req.Enabled = true

	// Encrypt API key before storing
	if s.encryptionKey != nil && req.APIKey != "" {
		encrypted, err := crypto.Encrypt(req.APIKey, s.encryptionKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt API key"})
			return
		}
		req.APIKey = encrypted
	} else if s.encryptionKey == nil && req.APIKey != "" {
		log.Printf("[modelproxy] WARNING: storing API key in plaintext for provider %s", req.ID)
	}

	s.mu.Lock()
	s.providers[req.ID] = &req
	s.mu.Unlock()

	// Return response with masked key
	respCopy := req
	respCopy.APIKey = "***"
	c.JSON(http.StatusCreated, respCopy)
}

// ListProviders handles GET /api/model/providers
func (s *Service) ListProviders(c *gin.Context) {
	s.mu.RLock()
	result := make([]ProviderConfig, 0, len(s.providers))
	for _, p := range s.providers {
		pCopy := *p
		pCopy.APIKey = "***"
		result = append(result, pCopy)
	}
	s.mu.RUnlock()

	c.JSON(http.StatusOK, result)
}

// ListModels handles GET /api/model/models
func (s *Service) ListModels(c *gin.Context) {
	providerID := c.Query("provider")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider required"})
		return
	}

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok || !provider.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

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

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok || !provider.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	apiKey := s.resolveAPIKey(provider)
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "API key not available"})
		return
	}

	body, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/v1/chat/completions"

	httpReq, _ := http.NewRequest("POST", upstreamURL, bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	// Record usage asynchronously
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}
	go recordUsage(s.store, user.ID, "model_requests", 1, req["model"].(string))

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

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok || !provider.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	apiKey := s.resolveAPIKey(provider)
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "API key not available"})
		return
	}

	body, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/v1/chat/completions"

	httpReq, _ := http.NewRequest("POST", upstreamURL, bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
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

func recordUsage(store *storage.Store, userID string, eventType string, amount int64, model string) {
	if userID == "" {
		return
	}
	event := &storage.UsageEvent{
		ID:        idgen.New("mp_"),
		UserID:    userID,
		Type:      eventType,
		Amount:    amount,
		Model:     model,
	}
	store.AppendUsageEvent(event)
}

// resolveAPIKey decrypts the provider's API key. Returns plaintext key or empty string on error.
func (s *Service) resolveAPIKey(provider *ProviderConfig) string {
	if provider.APIKey == "" {
		return ""
	}
	if s.encryptionKey == nil {
		// Plaintext mode — key is stored as-is
		return provider.APIKey
	}
	decrypted, err := crypto.Decrypt(provider.APIKey, s.encryptionKey)
	if err != nil {
		log.Printf("[modelproxy] WARNING: failed to decrypt API key for provider %s: %v", provider.ID, err)
		return ""
	}
	return decrypted
}