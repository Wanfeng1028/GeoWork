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

	"server/internal/apierrors"
	"server/internal/crypto"
	"server/internal/idgen"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

const maxRequestBodySize = 10 * 1024 * 1024 // 10MB

type Service struct {
	store         *storage.Store
	providers     map[string]*ProviderConfig
	mu            sync.RWMutex
	encryptionKey []byte // AES-256 key for API key encryption; nil means plaintext fallback
	httpClient    *http.Client
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
		store:      store,
		providers:  make(map[string]*ProviderConfig),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	key, err := crypto.GetEncryptionKey()
	if err != nil {
		log.Printf("[modelproxy] WARNING: %v — API keys will be stored in plaintext (dev mode)", err)
	} else {
		svc.encryptionKey = key
		log.Println("[modelproxy] API key encryption enabled (AES-256-GCM)")
	}

	// doc/25 S2: providers were previously an in-memory map only, so every
	// restart lost all configs including encrypted API keys. Load persisted
	// rows into the map at startup; writes go to both map and SQLite.
	if store != nil {
		rows, err := store.ListModelProviders()
		if err != nil {
			log.Printf("[modelproxy] WARNING: failed to load persisted providers: %v", err)
		}
		for _, row := range rows {
			svc.providers[row.ID] = &ProviderConfig{
				ID:       row.ID,
				Name:     row.Name,
				BaseURL:  row.BaseURL,
				APIKey:   row.APIKey,
				Enabled:  row.Enabled,
				Fallback: row.Fallback,
			}
		}
		if len(rows) > 0 {
			log.Printf("[modelproxy] loaded %d persisted provider(s)", len(rows))
		}
	}
	return svc
}

// persistProvider writes a provider config to SQLite (doc/25 S2).
// Best-effort: the in-memory map stays authoritative for the process
// lifetime, so a persistence failure is logged, not fatal.
func (s *Service) persistProvider(p *ProviderConfig) {
	if s.store == nil {
		return
	}
	err := s.store.UpsertModelProvider(&storage.ModelProvider{
		ID:       p.ID,
		Name:     p.Name,
		BaseURL:  p.BaseURL,
		APIKey:   p.APIKey,
		Enabled:  p.Enabled,
		Fallback: p.Fallback,
	})
	if err != nil {
		log.Printf("[modelproxy] WARNING: failed to persist provider %s: %v", p.ID, err)
	}
}

// AddProvider handles adding a provider config.
func (s *Service) AddProvider(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req ProviderConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request body")
		return
	}

	req.ID = user.ID + "_" + req.ID
	req.Enabled = true

	// Encrypt API key before storing
	if s.encryptionKey != nil && req.APIKey != "" {
		encrypted, err := crypto.Encrypt(req.APIKey, s.encryptionKey)
		if err != nil {
			apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to encrypt API key")
			return
		}
		req.APIKey = encrypted
	} else if s.encryptionKey == nil && req.APIKey != "" {
		log.Printf("[modelproxy] WARNING: storing API key in plaintext for provider %s", req.ID)
	}

	s.mu.Lock()
	s.providers[req.ID] = &req
	s.mu.Unlock()
	s.persistProvider(&req)

	// Return response with masked key
	respCopy := req
	respCopy.APIKey = "***"
	c.JSON(http.StatusCreated, respCopy)
}

// DeleteProvider handles DELETE /api/model/providers/:id
func (s *Service) DeleteProvider(c *gin.Context) {
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	providerID := c.Param("id")
	if providerID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "provider id is required")
		return
	}

	s.mu.Lock()
	_, exists := s.providers[providerID]
	if exists {
		delete(s.providers, providerID)
	}
	s.mu.Unlock()

	if !exists {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "provider not found")
		return
	}

	if s.store != nil {
		if err := s.store.DeleteModelProvider(providerID); err != nil {
			log.Printf("[modelproxy] WARNING: failed to delete persisted provider %s: %v", providerID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "provider deleted"})
}

// TestProvider handles POST /api/model/providers/:id/test
func (s *Service) TestProvider(c *gin.Context) {
	if _, ok := servercontext.RequireUser(c); !ok {
		return
	}

	providerID := c.Param("id")
	if providerID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "provider id is required")
		return
	}

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "provider not found")
		return
	}

	apiKey := s.resolveAPIKey(provider)
	if apiKey == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "API key not available")
		return
	}

	// Send a simple request to test connectivity
	testReq, _ := http.NewRequest("GET", provider.BaseURL+"/v1/models", nil)
	testReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.httpClient.Do(testReq)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.New(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "upstream unreachable"), err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		apierrors.RespondWithDetails(c, apierrors.ErrInternal, gin.H{
			"upstream_status": resp.StatusCode,
			"message":         "authentication failed or upstream error",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "provider connectivity test passed",
	})
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
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "provider required")
		return
	}

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok || !provider.Enabled {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "provider not found")
		return
	}

	apiKey := s.resolveAPIKey(provider)
	httpReq, _ := http.NewRequest("GET", provider.BaseURL+"/v1/models", nil)
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		apierrors.Respond(c, apierrors.New(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "upstream unavailable"))
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
	// Limit request body size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBodySize)

	var req gin.H
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	// doc/25 S2: provider_id comes from the request body. The previous code
	// read c.GetString("provider_id"), a context key nothing ever set, so
	// this endpoint always returned 400.
	providerID, _ := req["provider_id"].(string)
	if providerID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "provider_id is required")
		return
	}

	// Type assertion safety for model field
	model, ok := req["model"].(string)
	if !ok || model == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "model field is required and must be a string")
		return
	}

	// provider_id is a routing field, not part of the upstream OpenAI payload.
	delete(req, "provider_id")

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok || !provider.Enabled {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "provider not found")
		return
	}

	apiKey := s.resolveAPIKey(provider)
	if apiKey == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "API key not available")
		return
	}

	body, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/v1/chat/completions"

	httpReq, _ := http.NewRequest("POST", upstreamURL, bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		apierrors.Respond(c, apierrors.New(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "upstream unavailable"))
		return
	}
	defer resp.Body.Close()

	// Record usage asynchronously
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}
	go recordUsage(s.store, user.ID, "model_requests", 1, model)

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, maxRequestBodySize))
	var proxyResp gin.H
	json.Unmarshal(respBody, &proxyResp)

	c.JSON(http.StatusOK, proxyResp)
}

// Stream handles POST /api/model/stream
func (s *Service) Stream(c *gin.Context) {
	// Limit request body size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBodySize)

	var req gin.H
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	// doc/25 S2: provider_id comes from the request body (same fix as Chat).
	providerID, _ := req["provider_id"].(string)
	if providerID == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "provider_id is required")
		return
	}

	// Type assertion safety for model field
	_, ok := req["model"].(string)
	if !ok {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "model field is required and must be a string")
		return
	}

	// provider_id is a routing field, not part of the upstream OpenAI payload.
	delete(req, "provider_id")

	s.mu.RLock()
	provider, ok := s.providers[providerID]
	s.mu.RUnlock()

	if !ok || !provider.Enabled {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "provider not found")
		return
	}

	apiKey := s.resolveAPIKey(provider)
	if apiKey == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "API key not available")
		return
	}

	body, _ := json.Marshal(req)
	upstreamURL := provider.BaseURL + "/v1/chat/completions"

	httpReq, _ := http.NewRequest("POST", upstreamURL, bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		apierrors.Respond(c, apierrors.New(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "upstream unavailable"))
		return
	}
	defer resp.Body.Close()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Status(http.StatusOK)

	io.Copy(c.Writer, io.LimitReader(resp.Body, maxRequestBodySize))
}

func recordUsage(store *storage.Store, userID string, eventType string, amount int64, model string) {
	if userID == "" {
		return
	}
	event := &storage.UsageEvent{
		ID:     idgen.New("mp_"),
		UserID: userID,
		Type:   eventType,
		Amount: amount,
		Model:  model,
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
