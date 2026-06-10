// GeoWork Go Core - Plugin Registry

package plugins

import (
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Registry manages plugin instances.
type Registry struct {
	mu        sync.RWMutex
	plugins   map[string]*Manifest
	installer *Installer
	log       *zap.Logger
}

func NewRegistry(installer *Installer, log *zap.Logger) *Registry {
	r := &Registry{
		plugins:   make(map[string]*Manifest),
		installer: installer,
		log:       log,
	}

	// Load installed plugins
	installed, err := installer.GetInstalled()
	if err == nil {
		for _, m := range installed {
			r.plugins[m.ID] = &m
		}
	}

	return r
}

// Register adds a plugin to the registry.
func (r *Registry) Register(m *Manifest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.plugins[m.ID]; exists {
		return fmt.Errorf("plugin %s already registered", m.ID)
	}
	r.plugins[m.ID] = m
	r.log.Info("plugin registered", zap.String("id", m.ID))
	return nil
}

// Get returns a plugin by ID.
func (r *Registry) Get(id string) (*Manifest, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m, ok := r.plugins[id]
	return m, ok
}

// List returns all plugins.
func (r *Registry) List() []Manifest {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Manifest, 0, len(r.plugins))
	for _, m := range r.plugins {
		out = append(out, *m)
	}
	return out
}

// Enable toggles a plugin on.
func (r *Registry) Enable(id string) ([]Manifest, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, ok := r.plugins[id]
	if !ok {
		return nil, fmt.Errorf("plugin %s not found", id)
	}
	m.Enabled = true
	m.UpdatedAt = time.Now()
	return r.listLocked(), nil
}

// Disable toggles a plugin off.
func (r *Registry) Disable(id string) ([]Manifest, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	m, ok := r.plugins[id]
	if !ok {
		return nil, fmt.Errorf("plugin %s not found", id)
	}
	m.Enabled = false
	m.UpdatedAt = time.Now()
	return r.listLocked(), nil
}

// List returns enabled plugins.
func (r *Registry) ListEnabled() []Manifest {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Manifest, 0)
	for _, m := range r.plugins {
		if m.Enabled {
			out = append(out, *m)
		}
	}
	return out
}

// Remove removes a plugin from the registry and uninstalls it.
func (r *Registry) Remove(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.plugins[id]; !ok {
		return fmt.Errorf("plugin %s not found", id)
	}
	delete(r.plugins, id)
	return r.installer.Uninstall(id)
}

func (r *Registry) listLocked() []Manifest {
	out := make([]Manifest, 0, len(r.plugins))
	for _, m := range r.plugins {
		out = append(out, *m)
	}
	return out
}
