// GeoWork Go Core - Agent Recovery (checkpoint save/load)

package aiagent

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Recovery manages agent checkpoint persistence.
type Recovery struct {
	mu       sync.Mutex
	runs     map[string]*Checkpoint
	log      *zap.Logger
	dataDir  string
}

type Checkpoint struct {
	RunID     string    `json:"runId"`
	SavedAt   time.Time `json:"savedAt"`
	Data      []byte    `json:"data"`
	Mode      string    `json:"mode"`
	Prompt    string    `json:"prompt"`
	Status    string    `json:"status"`
}

func NewRecovery(log *zap.Logger) *Recovery {
	r := &Recovery{
		runs:    make(map[string]*Checkpoint),
		log:     log,
		dataDir: filepath.Join(os.TempDir(), "geowork", "checkpoints"),
	}
	os.MkdirAll(r.dataDir, 0755)
	return r
}

// Save persists a checkpoint to disk.
func (r *Recovery) Save(runID string, data []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var state map[string]any
	if err := json.Unmarshal(data, &state); err != nil {
		return
	}

	mode, _ := state["mode"].(string)
	prompt, _ := state["prompt"].(string)
	status, _ := state["status"].(string)

	cp := &Checkpoint{
		RunID:   runID,
		SavedAt: time.Now(),
		Data:    data,
		Mode:    mode,
		Prompt:  prompt,
		Status:  status,
	}
	r.runs[runID] = cp

	// Write to disk
	path := filepath.Join(r.dataDir, runID+".json")
	os.WriteFile(path, data, 0644)

	r.log.Info("checkpoint saved", zap.String("runId", runID), zap.String("status", status))
}

// Load retrieves a checkpoint by run ID.
func (r *Recovery) Load(runID string) ([]byte, bool) {
	r.mu.Lock()
	cp, ok := r.runs[runID]
	r.mu.Unlock()

	if ok {
		return cp.Data, true
	}

	// Try loading from disk
	path := filepath.Join(r.dataDir, runID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}

	r.mu.Lock()
	r.runs[runID] = &Checkpoint{RunID: runID, SavedAt: time.Now(), Data: data}
	r.mu.Unlock()

	return data, true
}

// List returns all checkpoints.
func (r *Recovery) List() []Checkpoint {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]Checkpoint, 0, len(r.runs))
	for _, cp := range r.runs {
		out = append(out, *cp)
	}
	return out
}

// Delete removes a checkpoint.
func (r *Recovery) Delete(runID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	path := filepath.Join(r.dataDir, runID+".json")
	os.Remove(path)
	delete(r.runs, runID)
}

// Cleanup removes checkpoints older than maxAge.
func (r *Recovery) Cleanup(maxAge time.Duration) int {
	r.mu.Lock()
	defer r.mu.Unlock()

	count := 0
	cutoff := time.Now().Add(-maxAge)
	for runID, cp := range r.runs {
		if cp.SavedAt.Before(cutoff) {
			path := filepath.Join(r.dataDir, runID+".json")
			os.Remove(path)
			delete(r.runs, runID)
			count++
		}
	}
	return count
}
