// GeoWork Go Core - File Checkpoint (Save/Restore)

package tasks

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"geowork/core/internal/diff"
)

type FileCheckpoint struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	CreatedAt   time.Time         `json:"createdAt"`
	CommitHash  string            `json:"commitHash,omitempty"`
	Branch      string            `json:"branch"`
	Files       map[string]string `json:"files"`
	EnvVars     map[string]string `json:"envVars,omitempty"`
	Metadata    map[string]any    `json:"metadata,omitempty"`
}

type FileCheckpointManager struct {
	mu          sync.Mutex
	checkpoints map[string]*FileCheckpoint
	storePath   string
}

func NewFileCheckpointManager(storePath string) *FileCheckpointManager {
	cm := &FileCheckpointManager{
		checkpoints: make(map[string]*FileCheckpoint),
		storePath:   storePath,
	}

	if storePath != "" {
		cm.loadFromDisk()
	}

	return cm
}

func (cm *FileCheckpointManager) CreateCheckpoint(name, description, commitHash, branch string, files map[string]string) *FileCheckpoint {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	id := fmt.Sprintf("ckpt-%d", time.Now().UnixNano())
	ckpt := &FileCheckpoint{
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

	if cm.storePath != "" {
		cm.persist(ckpt)
	}

	return ckpt
}

func (cm *FileCheckpointManager) GetCheckpoint(id string) (*FileCheckpoint, bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ckpt, ok := cm.checkpoints[id]
	return ckpt, ok
}

func (cm *FileCheckpointManager) ListAll() []*FileCheckpoint {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	result := make([]*FileCheckpoint, 0, len(cm.checkpoints))
	for _, ckpt := range cm.checkpoints {
		result = append(result, ckpt)
	}
	return result
}

func (cm *FileCheckpointManager) FindByName(name string) []*FileCheckpoint {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	var result []*FileCheckpoint
	for _, ckpt := range cm.checkpoints {
		if ckpt.Name == name {
			result = append(result, ckpt)
		}
	}
	return result
}

func (cm *FileCheckpointManager) DeleteCheckpoint(id string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, ok := cm.checkpoints[id]; !ok {
		return fmt.Errorf("checkpoint %s not found", id)
	}

	delete(cm.checkpoints, id)

	if cm.storePath != "" {
		filePath := filepath.Join(cm.storePath, id+".json")
		os.Remove(filePath)
	}

	return nil
}

func (cm *FileCheckpointManager) RestoreCheckpoint(id, basePath string) error {
	ckpt, ok := cm.GetCheckpoint(id)
	if !ok {
		return fmt.Errorf("checkpoint %s not found", id)
	}

	return diff.RestoreSnapshot(basePath, ckpt.Files)
}

func (cm *FileCheckpointManager) CreateFromSnapshot(name, description, commitHash, branch string, snap map[string]string) *FileCheckpoint {
	return cm.CreateCheckpoint(name, description, commitHash, branch, snap)
}

func (cm *FileCheckpointManager) CompareCheckpoints(id1, id2 string) (string, error) {
	ckpt1, ok1 := cm.GetCheckpoint(id1)
	ckpt2, ok2 := cm.GetCheckpoint(id2)

	if !ok1 || !ok2 {
		return "", fmt.Errorf("one or both checkpoints not found")
	}

	return diff.DiffSnapshots(ckpt1.Files, ckpt2.Files), nil
}

func (cm *FileCheckpointManager) AddMetadata(id string, key string, value any) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ckpt, ok := cm.checkpoints[id]
	if !ok {
		return fmt.Errorf("checkpoint %s not found", id)
	}

	ckpt.Metadata[key] = value
	return nil
}

func (cm *FileCheckpointManager) GetMetadata(id, key string) (any, bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ckpt, ok := cm.checkpoints[id]
	if !ok {
		return nil, false
	}

	val, found := ckpt.Metadata[key]
	return val, found
}

func (cm *FileCheckpointManager) persist(ckpt *FileCheckpoint) error {
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

func (cm *FileCheckpointManager) loadFromDisk() error {
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

			var ckpt FileCheckpoint
			if err := json.Unmarshal(data, &ckpt); err != nil {
				continue
			}

			cm.checkpoints[ckpt.ID] = &ckpt
		}
	}

	return nil
}
