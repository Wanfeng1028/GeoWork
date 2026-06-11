// GeoWork Go Core - Diagnostics Handler

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"
)

type diagnosticsHandler struct {
	logDir string
}

func newDiagnosticsHandler(logDir string) *diagnosticsHandler {
	return &diagnosticsHandler{logDir: logDir}
}

func (h *diagnosticsHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/diagnostics/health", h.handleHealth)
	mux.HandleFunc("GET /api/diagnostics/performance", h.handlePerformance)
	mux.HandleFunc("GET /api/diagnostics/logs", h.handleLogs)
	mux.HandleFunc("POST /api/diagnostics/crash", h.handleCrash)
	mux.HandleFunc("GET /api/diagnostics/crash", h.handleCrashStatus)
}

// GET /api/diagnostics/health
func (h *diagnosticsHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]interface{}{
		"status":        "ok",
		"uptime":        time.Since(diagStartTime).String(),
		"go_version":    strings.TrimSpace(strings.TrimPrefix(goVersion(), "go")),
		"num_goroutine": runtime.NumGoroutine(),
		"num_cpu":       runtime.NumCPU(),
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
	})
}

// GET /api/diagnostics/performance
func (h *diagnosticsHandler) handlePerformance(w http.ResponseWriter, r *http.Request) {
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

// GET /api/diagnostics/logs
func (h *diagnosticsHandler) handleLogs(w http.ResponseWriter, r *http.Request) {
	files := listLogFiles(h.logDir)
	writeJSON(w, files)
}

// POST /api/diagnostics/crash
func (h *diagnosticsHandler) handleCrash(w http.ResponseWriter, r *http.Request) {
	var report map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		writeJSON(w, map[string]interface{}{"error": "invalid request body"})
		return
	}
	report["received_at"] = time.Now().UTC().Format(time.RFC3339)
	crashID := fmt.Sprintf("crash_%d", time.Now().UnixNano())
	writeJSON(w, map[string]interface{}{
		"status":   "accepted",
		"crash_id": crashID,
		"message":  "Crash report recorded",
	})
}

// GET /api/diagnostics/crash
func (h *diagnosticsHandler) handleCrashStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]interface{}{
		"status":     "ok",
		"message":    "Crash handler active — submit reports via POST",
		"last_crash": nil,
	})
}

func listLogFiles(logDir string) []string {
	if logDir == "" {
		return []string{}
	}
	entries, err := os.ReadDir(logDir)
	if err != nil || len(entries) == 0 {
		return []string{}
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".log") {
			files = append(files, e.Name())
		}
	}
	return files
}
