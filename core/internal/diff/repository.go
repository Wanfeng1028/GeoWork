// GeoWork Go Core - Diff Repository

package diff

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Manager persists diffs to disk.
type Manager struct {
	mu    sync.Mutex
	diffs map[string]*Diff
	dir   string
	log   *zap.Logger
}

func NewManager(log *zap.Logger) *Manager {
	m := &Manager{
		diffs: make(map[string]*Diff),
		dir:   filepath.Join(os.TempDir(), "geowork", "diffs"),
		log:   log,
	}
	os.MkdirAll(m.dir, 0755)
	return m
}

// Save persists a diff.
func (m *Manager) Save(d *Diff) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.diffs[d.ID] = d
	path := filepath.Join(m.dir, d.ID+".json")
	return os.WriteFile(path, mustMarshal(d), 0644)
}

// Get returns a diff by ID.
func (m *Manager) Get(id string) (*Diff, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	d, ok := m.diffs[id]
	return d, ok
}

// List returns all diffs, optionally filtered by status.
func (m *Manager) List(status *string) []*Diff {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []*Diff
	for _, d := range m.diffs {
		if status != nil && d.Status != *status {
			continue
		}
		out = append(out, d)
	}
	return out
}

// Approve marks a diff as approved.
func (m *Manager) Approve(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	d, ok := m.diffs[id]
	if !ok {
		return fmt.Errorf("diff %s not found", id)
	}
	d.Status = "approved"
	d.ApprovedAt = time.Now()
	return m.saveLocked(d)
}

// Reject marks a diff as rejected.
func (m *Manager) Reject(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	d, ok := m.diffs[id]
	if !ok {
		return fmt.Errorf("diff %s not found", id)
	}
	d.Status = "rejected"
	return m.saveLocked(d)
}

// ApproveAll marks all pending diffs as approved.
func (m *Manager) ApproveAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, d := range m.diffs {
		if d.Status == "pending" {
			d.Status = "approved"
			d.ApprovedAt = time.Now()
			if err := m.saveLocked(d); err != nil {
				return err
			}
		}
	}
	return nil
}

// RejectAll marks all pending diffs as rejected.
func (m *Manager) RejectAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, d := range m.diffs {
		if d.Status == "pending" {
			d.Status = "rejected"
		}
	}
	return nil
}

// Delete removes a diff.
func (m *Manager) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.diffs[id]; !ok {
		return fmt.Errorf("diff %s not found", id)
	}
	path := filepath.Join(m.dir, id+".json")
	os.Remove(path)
	delete(m.diffs, id)
	return nil
}

// Clear removes all diffs.
func (m *Manager) Clear() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id := range m.diffs {
		path := filepath.Join(m.dir, id+".json")
		os.Remove(path)
	}
	m.diffs = make(map[string]*Diff)
	return nil
}

func (m *Manager) saveLocked(d *Diff) error {
	path := filepath.Join(m.dir, d.ID+".json")
	return os.WriteFile(path, mustMarshal(d), 0644)
}

func mustMarshal(v any) []byte {
	data, _ := json.Marshal(v)
	return data
}
