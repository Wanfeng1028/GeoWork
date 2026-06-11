// GeoWork Go Core - Router

package api

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"geowork/core/internal/file"
	"geowork/core/internal/knowledge"
	"geowork/core/internal/permissions"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
	"geowork/core/internal/workspace"

	"go.uber.org/zap"
)

// RouterDeps holds all dependencies needed to build the API router.
type RouterDeps struct {
	App          *gruntime.App
	LogDir       string
	WorkspaceSvc *workspace.Service
	PermEngine   *permissions.Engine
	SandboxSvc   *sandbox.Service
}

// NewRouter builds a new handler using http.ServeMux with separated handlers.
func NewRouter(deps RouterDeps) http.Handler {
	mux := http.NewServeMux()
	bridge := NewEventBridge()
	logger := zap.NewNop()

	// --- Separate handlers ---
	hProject := newProjectHandler(deps.App)
	hHealth := newHealthHandler(deps.App)
	hTask := newTaskHandler(deps.App, bridge)
	hWorkspace := newWorkspaceHandler(deps.App, deps.WorkspaceSvc, deps.LogDir, logger)
	hPermission := newPermissionHandler(deps.App, deps.PermEngine, bridge)
	hSandbox := newSandboxHandler(deps.App, deps.SandboxSvc, bridge)
	hArtifact := newArtifactHandler(deps.App, bridge)
	hDiff := newDiffHandler(deps.App, bridge)
	hDiagnostics := newDiagnosticsHandler(deps.LogDir)
	hGlobal := newGlobalHandler(deps.App)

	// Additional handlers with their own dependencies
	workerClient := deps.App.WorkerClient()
	agentEngine := deps.App.AgentEngine()

	workspaceDir := deps.App.Workspace()

	kbPath := filepath.Join(workspaceDir, "state", "knowledge.db")
	kbMgr, err := knowledge.NewKnowledgeManager(logger, kbPath)
	if err != nil {
		logger.Error("Failed to create knowledge manager", zap.Error(err))
		kbMgr = nil
	}

	fileMgr, err := file.NewFileManager(logger, filepath.Join(workspaceDir, "state", "files.db"))
	if err != nil {
		logger.Error("Failed to create file manager", zap.Error(err))
		fileMgr = nil
	}

	hPaper := NewPaperHandler(workerClient, logger)
	hKnowledge := NewKnowledgeHandler(kbMgr, logger)
	hNdv := NewNdvHandler(workerClient, logger)
	hAgent := NewAgentHandler(agentEngine, logger)
	hFile := NewFileHandler(deps.App, fileMgr, workspaceDir)

	// --- Register all handlers ---
	hProject.registerRoutes(mux)
	hHealth.registerRoutes(mux)
	hTask.registerRoutes(mux)
	hWorkspace.registerRoutes(mux)
	hPermission.registerRoutes(mux)
	hSandbox.registerRoutes(mux)
	hArtifact.registerRoutes(mux)
	hDiff.registerRoutes(mux)
	hDiagnostics.registerRoutes(mux)
	hGlobal.registerRoutes(mux)
	hPaper.RegisterRoutes(mux)
	hKnowledge.RegisterRoutes(mux)
	hNdv.RegisterRoutes(mux)
	hAgent.RegisterRoutes(mux)
	if hFile != nil {
		hFile.RegisterRoutes(mux)
	}

	// 404 fallback
	mux.HandleFunc("api/", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	return cors(mux)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeResult(w http.ResponseWriter, value any, err error) {
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, value)
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

var diagStartTime = time.Now()

func goVersion() string {
	return strings.TrimSpace(strings.TrimPrefix(runtime.Version(), "go"))
}
