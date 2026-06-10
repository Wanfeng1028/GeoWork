// GeoWork Go Core - Diagnostics Routes

package diagnostics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"go.uber.org/zap"
)

type Routes struct {
	logDir   string
	crashDir string
	log      *zap.Logger
}

func NewRoutes(logDir string, log *zap.Logger) *Routes {
	crashDir := filepath.Join(os.TempDir(), "geowork", "crashes")
	os.MkdirAll(crashDir, 0755)
	if log == nil {
		l, _ := zap.NewProduction()
		log = l
	}
	return &Routes{logDir: logDir, crashDir: crashDir, log: log}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/diagnostics/health", r.handleHealth)
	mux.HandleFunc("/api/diagnostics/performance", r.handlePerformance)
	mux.HandleFunc("/api/diagnostics/logs", r.handleLogs)
	mux.HandleFunc("/api/diagnostics/crash", r.handleCrash)
	mux.HandleFunc("/api/diagnostics/crash/report", r.handleCrashReport)
}

func (r *Routes) handleHealth(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]interface{}{
		"status":        "ok",
		"uptime":        time.Since(startTime).String(),
		"go_version":    runtime.Version(),
		"num_goroutine": runtime.NumGoroutine(),
		"num_cpu":       runtime.NumCPU(),
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
	})
}

func (r *Routes) handlePerformance(w http.ResponseWriter, req *http.Request) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	writeJSON(w, map[string]interface{}{
		"alloc_mb":       mem.Alloc / 1024 / 1024,
		"total_alloc_mb": mem.TotalAlloc / 1024 / 1024,
		"sys_mb":         mem.Sys / 1024 / 1024,
		"num_gc":         mem.NumGC,
		"goroutines":     runtime.NumGoroutine(),
	})
}

func (r *Routes) handleLogs(w http.ResponseWriter, req *http.Request) {
	logFiles, err := os.ReadDir(r.logDir)
	if err != nil || len(logFiles) == 0 {
		writeJSON(w, []string{})
		return
	}

	var files []string
	for _, f := range logFiles {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".log") {
			files = append(files, f.Name())
		}
	}
	writeJSON(w, files)
}

func (r *Routes) handleCrash(w http.ResponseWriter, req *http.Request) {
	// List recorded crash reports
	crashDir := r.crashDir
	entries, err := os.ReadDir(crashDir)
	if err != nil || len(entries) == 0 {
		writeJSON(w, map[string]interface{}{
			"status":      "ok",
			"message":     "No crashes recorded",
			"last_crash":  nil,
			"crash_count": 0,
		})
		return
	}

	var crashes []map[string]interface{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(crashDir, entry.Name()))
		if err != nil {
			continue
		}
		var crash map[string]interface{}
		if json.Unmarshal(data, &crash) == nil {
			crashes = append(crashes, crash)
		}
	}

	var lastCrash interface{}
	if len(crashes) > 0 {
		lastCrash = crashes[len(crashes)-1]
	}

	writeJSON(w, map[string]interface{}{
		"status":      "ok",
		"message":     fmt.Sprintf("%d crash(es) recorded", len(crashes)),
		"last_crash":  lastCrash,
		"crash_count": len(crashes),
	})
}

// handleCrashReport receives crash reports from the frontend
func (r *Routes) handleCrashReport(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var report map[string]interface{}
	if err := json.NewDecoder(req.Body).Decode(&report); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	report["received_at"] = time.Now().UTC().Format(time.RFC3339)

	// Save crash report to disk
	crashID := fmt.Sprintf("crash_%d.json", time.Now().UnixNano())
	crashPath := filepath.Join(r.crashDir, crashID)
	data, _ := json.MarshalIndent(report, "", "  ")
	if err := os.WriteFile(crashPath, data, 0644); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save crash report: %v", err))
		return
	}

	r.log.Info("crash report saved", zap.String("id", crashID))
	writeJSON(w, map[string]interface{}{
		"status":   "accepted",
		"crash_id": crashID,
		"message":  "Crash report recorded successfully",
	})
}

var startTime = time.Now()

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":     message,
		"code":      code,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
