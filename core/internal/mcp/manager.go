// GeoWork Go Core - MCP Manager

package mcp

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Manager controls MCP server connections.
type Manager struct {
	mu       sync.Mutex
	configs  map[string]*ServerConfig
	clients  map[string]*MCPClient
	log      *zap.Logger
}

func NewManager(log *zap.Logger) *Manager {
	m := &Manager{
		configs: make(map[string]*ServerConfig),
		clients: make(map[string]*MCPClient),
		log:     log,
	}
	// Load default configs
	for _, cfg := range DefaultConfigs() {
		m.configs[cfg.ID] = &cfg
	}
	return m
}

// ListConfigs returns all server configs.
func (m *Manager) ListConfigs() []ServerConfig {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]ServerConfig, 0, len(m.configs))
	for _, c := range m.configs {
		out = append(out, *c)
	}
	return out
}

// AddConfig registers a new server config.
func (m *Manager) AddConfig(cfg *ServerConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.configs[cfg.ID]; exists {
		return fmt.Errorf("server %s already exists", cfg.ID)
	}
	cfg.CreatedAt = time.Now()
	cfg.UpdatedAt = cfg.CreatedAt
	m.configs[cfg.ID] = cfg
	m.log.Info("MCP server config added", zap.String("id", cfg.ID))
	return nil
}

// RemoveConfig removes a server config and its connection.
func (m *Manager) RemoveConfig(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.configs[id]; !ok {
		return fmt.Errorf("server %s not found", id)
	}
	if client, ok := m.clients[id]; ok {
		client.Close()
		delete(m.clients, id)
	}
	delete(m.configs, id)
	return nil
}

// Connect starts a server connection.
func (m *Manager) Connect(ctx context.Context, id string) error {
	m.mu.Lock()
	cfg, ok := m.configs[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("server %s not found", id)
	}
	if _, connected := m.clients[id]; connected {
		m.mu.Unlock()
		return fmt.Errorf("server %s already connected", id)
	}
	m.mu.Unlock()

	client := NewMCPClient(cfg, m.log)
	if err := client.Connect(ctx); err != nil {
		return err
	}

	m.mu.Lock()
	m.clients[id] = client
	m.mu.Unlock()

	cfg.Enabled = true
	cfg.UpdatedAt = time.Now()
	m.log.Info("MCP server connected", zap.String("id", id))
	return nil
}

// Disconnect stops a server connection.
func (m *Manager) Disconnect(id string) error {
	m.mu.Lock()
	client, ok := m.clients[id]
	m.mu.Unlock()

	if !ok {
		return fmt.Errorf("server %s not connected", id)
	}

	if err := client.Close(); err != nil {
		return err
	}

	m.mu.Lock()
	delete(m.clients, id)
	if cfg, exists := m.configs[id]; exists {
		cfg.Enabled = false
		cfg.UpdatedAt = time.Now()
	}
	m.mu.Unlock()

	return nil
}

// ListTools fetches tools from a connected server.
func (m *Manager) ListTools(ctx context.Context, serverID string) ([]map[string]any, error) {
	m.mu.Lock()
	client, ok := m.clients[serverID]
	m.mu.Unlock()

	if !ok {
		return nil, fmt.Errorf("server %s not connected", serverID)
	}

	return client.ListTools(ctx)
}

// CallTool invokes a tool on a connected server.
func (m *Manager) CallTool(ctx context.Context, serverID, toolName string, args map[string]any) (*MCPResponse, error) {
	m.mu.Lock()
	client, ok := m.clients[serverID]
	m.mu.Unlock()

	if !ok {
		return nil, fmt.Errorf("server %s not connected", serverID)
	}

	return client.CallTool(ctx, toolName, args)
}

// GetClients returns the number of connected clients.
func (m *Manager) GetClientCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.clients)
}
