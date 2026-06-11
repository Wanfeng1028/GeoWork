// GeoWork Go Core - Checkpoint (Save/Restore)

package toolregistry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Checkpoint represents a saved state of the repository at a point in time.
type Checkpoint struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	CreatedAt   time.Time              `json:"createdAt"`
	CommitHash  string                 `json:"commitHash,omitempty"`
	Branch      string                 `json:"branch"`
	Files       map[string]string      `json:"files"`       // file path -> content snapshot
	EnvVars     map[string]string      `json:"envVars,omitempty"` // environment snapshot
	Metadata    map[string]any         `json:"metadata,omitempty"`
}

// CheckpointManager manages save/restore of checkpoints.
type CheckpointManager struct {
	mu      sync.Mutex
	checkpoints map[string]*Checkpoint
	storePath string // directory for persisted checkpoints
}

// NewCheckpointManager creates a new CheckpointManager.
func NewCheckpointManager(storePath string) *CheckpointManager {
	cm := &CheckpointManager{
		checkpoints: make(map[string]*Checkpoint),
		storePath:   storePath,
	}

	// Load existing checkpoints from disk
	if storePath != "" {
		cm.loadFromDisk()
	}

	return cm
}

// CreateCheckpoint saves a new checkpoint of the current state.
func (cm *CheckpointManager) CreateCheckpoint(name, description, commitHash, branch string, files map[string]string) *Checkpoint {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	id := fmt.Sprintf("ckpt-%d", time.Now().UnixNano())
	ckpt := &Checkpoint{
		ID:          id,
		Name:        name,
		Description: description,
		CreatedAt:   time.Now(),
		CommitHash:  commitHash,
		Branch:      branch,
		Files:       files,
		EnvVars:     make(map[string]string),
		Metadata:    make(map[string]any),
	}

	cm.checkpoints[id] = ckpt

	// Persist to disk
	if cm.storePath != "" {
		cm.persist(ckpt)
	}

	return ckpt
}

// GetCheckpoint retrieves a checkpoint by ID.
func (cm *CheckpointManager) GetCheckpoint(id string) (*Checkpoint, bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ckpt, ok := cm.checkpoints[id]
	return ckpt, ok
}

// ListAll returns all checkpoints.
func (cm *CheckpointManager) ListAll() []*Checkpoint {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	result := make([]*Checkpoint, 0, len(cm.checkpoints))
	for _, ckpt := range cm.checkpoints {
		result = append(result, ckpt)
	}
	return result
}

// FindByName searches for checkpoints by name.
func (cm *CheckpointManager) FindByName(name string) []*Checkpoint {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	var result []*Checkpoint
	for _, ckpt := range cm.checkpoints {
		if ckpt.Name == name {
			result = append(result, ckpt)
		}
	}
	return result
}

// DeleteCheckpoint removes a checkpoint.
func (cm *CheckpointManager) DeleteCheckpoint(id string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, ok := cm.checkpoints[id]; !ok {
		return fmt.Errorf("checkpoint %s not found", id)
	}

	delete(cm.checkpoints, id)

	// Remove from disk
	if cm.storePath != "" {
		filePath := filepath.Join(cm.storePath, id+".json")
		os.Remove(filePath)
	}

	return nil
}

// RestoreCheckpoint restores files from a checkpoint.
func (cm *CheckpointManager) RestoreCheckpoint(id, basePath string) error {
	ckpt, ok := cm.GetCheckpoint(id)
	if !ok {
		return fmt.Errorf("checkpoint %s not found", id)
	}

	return RestoreSnapshot(basePath, ckpt.Files)
}

// CreateFromSnapshot creates a checkpoint from an existing snapshot map.
func (cm *CheckpointManager) CreateFromSnapshot(name, description, commitHash, branch string, snap map[string]string) *Checkpoint {
	return cm.CreateCheckpoint(name, description, commitHash, branch, snap)
}

// CompareCheckpoints compares two checkpoints and returns their differences.
func (cm *CheckpointManager) CompareCheckpoints(id1, id2 string) (string, error) {
	ckpt1, ok1 := cm.GetCheckpoint(id1)
	ckpt2, ok2 := cm.GetCheckpoint(id2)

	if !ok1 || !ok2 {
		return "", fmt.Errorf("one or both checkpoints not found")
	}

	return DiffSnapshots(ckpt1.Files, ckpt2.Files), nil
}

// AddMetadata adds key-value pairs to a checkpoint's metadata.
func (cm *CheckpointManager) AddMetadata(id string, key string, value any) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ckpt, ok := cm.checkpoints[id]
	if !ok {
		return fmt.Errorf("checkpoint %s not found", id)
	}

	ckpt.Metadata[key] = value
	return nil
}

// GetMetadata retrieves a metadata value from a checkpoint.
func (cm *CheckpointManager) GetMetadata(id, key string) (any, bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ckpt, ok := cm.checkpoints[id]
	if !ok {
		return nil, false
	}

	val, found := ckpt.Metadata[key]
	return val, found
}

// persist writes a checkpoint to disk.
func (cm *CheckpointManager) persist(ckpt *Checkpoint) error {
	if cm.storePath == "" {
		return nil
	}

	data, err := json.Marshal(ckpt)
	if err != nil {
		return fmt.Errorf("marshal checkpoint: %w", err)
	}

	filePath := filepath.Join(cm.storePath, ckpt.ID+".json")
	if err := os.MkdirAll(cm.storePath, 0o755); err != nil {
		return fmt.Errorf("create checkpoint dir: %w", err)
	}

	return os.WriteFile(filePath, data, 0o644)
}

// loadFromDisk loads all persisted checkpoints.
func (cm *CheckpointManager) loadFromDisk() error {
	if cm.storePath == "" {
		return nil
	}

	entries, err := os.ReadDir(cm.storePath)
	if err != nil {
		return fmt.Errorf("read checkpoint dir: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			filePath := filepath.Join(cm.storePath, entry.Name())
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			var ckpt Checkpoint
			if err := json.Unmarshal(data, &ckpt); err != nil {
				continue
			}

			cm.checkpoints[ckpt.ID] = &ckpt
		}
	}

	return nil
}

// DiffSnapshots compares two file snapshot maps and returns a diff summary.
func DiffSnapshots(snap1, snap2 map[string]string) string {
	var lines []string

	// Find files in both
	allFiles := make(map[string]bool)
	for f := range snap1 {
		allFiles[f] = true
	}
	for f := range snap2 {
		allFiles[f] = true
	}

	for f := range allFiles {
		_, in1 := snap1[f]
		_, in2 := snap2[f]

		if in1 && !in2 {
			lines = append(lines, fmt.Sprintf("- %s (deleted)", f))
		} else if !in1 && in2 {
			lines = append(lines, fmt.Sprintf("+ %s (added)", f))
		} else if snap1[f] != snap2[f] {
			lines = append(lines, fmt.Sprintf("~ %s (modified)", f))
		}
	}

	if len(lines) == 0 {
		return "no differences"
	}

	return fmt.Sprintf("%d file(s) differ:\n", len(lines)) + joinStrings(lines, "\n")
}

// joinStrings is a simple string join helper (avoiding importing "strings" in this internal func).
func joinStrings(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for i := 1; i < len(ss); i++ {
		result += sep + ss[i]
	}
	return result
}
