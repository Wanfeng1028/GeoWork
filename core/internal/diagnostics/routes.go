// GeoWork Go Core - Diagnostics Routes

package diagnostics

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"time"
)

type Routes struct {
	logDir string
}

func NewRoutes(logDir string) *Routes {
	return &Routes{logDir: logDir}
}

func (r *Routes) Register(mux http.HandlerFunc) {
	mux.HandleFunc("/api/diagnostics/health", r.handleHealth)
	mux.HandleFunc("/api/diagnostics/performance", r.handlePerformance)
	mux.HandleFunc("/api/diagnostics/logs", r.handleLogs)
	mux.HandleFunc("/api/diagnostics/crash", r.handleCrash)
}

func (r *Routes) handleHealth(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]interface{}{
		"status":      "ok",
		"uptime":      time.Since(startTime).String(),
		"go_version":  runtime.Version(),
		"num_goroutine": runtime.NumGoroutine(),
		"num_cpu":     runtime.NumCPU(),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
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
	writeJSON(w, map[string]interface{}{
		"status":     "ok",
		"message":    "Crash handler placeholder - no crashes recorded",
		"last_crash": nil,
	})
}

var startTime = time.Now()

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
