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
	mu      sync.Mutex
	runs    map[string]*Checkpoint
	log     *zap.Logger
	dataDir string
}

// Checkpoint captures one saved ReAct-loop state for a run.
// P1-6 §7.4 extended the struct to carry TurnIndex / State / ChatHistory
// so ResumeFromCheckpoint can pick up exactly where the run left off,
// rather than restarting the loop with an empty chat history.
type Checkpoint struct {
	RunID   string    `json:"runId"`
	SavedAt time.Time `json:"savedAt"`
	Data    []byte    `json:"data"`
	Mode    string    `json:"mode"`
	Prompt  string    `json:"prompt"`
	Status  string    `json:"status"`

	// P1-6 §7.4: ReAct-loop bookkeeping for断点续传.
	// TurnIndex is the index of the next turn to execute (i.e. the
	// number of completed turns at save time). ResumeFromCheckpoint
	// starts the loop at this index.
	TurnIndex int `json:"turnIndex"`
	// State is the state-machine state at save time (e.g. "editing").
	// The resumed run re-enters this state so tool gating is consistent.
	State string `json:"state"`
	// Reason captures why the checkpoint was saved — "periodic",
	// "paused", "completed", or "manual". Surfaced in the UI so the
	// user understands whether the run was mid-flight or finished.
	Reason string `json:"reason,omitempty"`
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

// Save persists a checkpoint to disk. The data blob is the raw JSON
// serialization of the run state (status, messages, plan, memory, etc.)
// — Save parses out the display fields (mode/prompt/status) plus the
// P1-6 fields (turnIndex/state) so GET /checkpoints can render a
// summary without re-decoding every blob.
//
// reason is one of "periodic" | "paused" | "completed" | "manual".
func (r *Recovery) Save(runID string, data []byte) {
	r.saveWithReason(runID, data, "")
}

// SaveWithReason is like Save but stamps the checkpoint with a reason
// ("periodic", "paused", etc.) so the UI can show why it was saved.
func (r *Recovery) SaveWithReason(runID string, data []byte, reason string) {
	r.saveWithReason(runID, data, reason)
}

func (r *Recovery) saveWithReason(runID string, data []byte, reason string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var state map[string]any
	if err := json.Unmarshal(data, &state); err != nil {
		return
	}

	mode, _ := state["mode"].(string)
	prompt, _ := state["prompt"].(string)
	status, _ := state["status"].(string)
	stateStr, _ := state["state"].(string)
	// turnIndex may be absent in old checkpoints (pre-P1-6); default to 0.
	turnIndex := 0
	if ti, ok := state["turnIndex"]; ok {
		switch v := ti.(type) {
		case float64:
			turnIndex = int(v)
		case int:
			turnIndex = v
		}
	}

	cp := &Checkpoint{
		RunID:     runID,
		SavedAt:   time.Now(),
		Data:      data,
		Mode:      mode,
		Prompt:    prompt,
		Status:    status,
		TurnIndex: turnIndex,
		State:     stateStr,
		Reason:    reason,
	}
	r.runs[runID] = cp

	// Write to disk
	path := filepath.Join(r.dataDir, runID+".json")
	os.WriteFile(path, data, 0644)

	r.log.Info("checkpoint saved",
		zap.String("runId", runID),
		zap.String("status", status),
		zap.Int("turnIndex", turnIndex),
		zap.String("reason", reason))
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

// LoadCheckpoint returns the full Checkpoint struct for runID, including
// the P1-6 TurnIndex / State / Reason fields. Used by
// ResumeFromCheckpoint to reconstruct the run's execution state.
// Returns nil, false if no checkpoint exists.
func (r *Recovery) LoadCheckpoint(runID string) (*Checkpoint, bool) {
	r.mu.Lock()
	cp, ok := r.runs[runID]
	r.mu.Unlock()

	if ok {
		return cp, true
	}

	// Lazy-load from disk if we don't have it in memory.
	// Load() populates r.runs[runID] as a side effect, so we only need
	// the ok flag here — the actual Checkpoint is fetched back below.
	if _, ok := r.Load(runID); !ok {
		return nil, false
	}
	r.mu.Lock()
	cp = r.runs[runID]
	r.mu.Unlock()
	return cp, true
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
