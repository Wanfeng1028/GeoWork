// GeoWork Go Core - Router

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"geowork/core/internal/aiagent"
	"geowork/core/internal/conversation"
	"geowork/core/internal/file"
	"geowork/core/internal/knowledge"
	"geowork/core/internal/permissions"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
	"geowork/core/internal/tasks"
	"geowork/core/internal/toolregistry"
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
	TaskSvc      *tasks.Service
	Scheduler    *tasks.Scheduler
	Orchestrator *aiagent.Orchestrator
	ConvStore    *conversation.Store
}

// Router wraps http.Handler and holds resources that need explicit cleanup.
type Router struct {
	handler http.Handler
	closers []func() error
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	r.handler.ServeHTTP(w, req)
}

// Close releases all resources held by the router.
func (r *Router) Close() error {
	var errs []error
	for _, closer := range r.closers {
		if err := closer(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return errs[0]
	}
	return nil
}

// NewRouter builds a new handler using http.ServeMux with separated handlers.
func NewRouter(deps RouterDeps) *Router {
	mux := http.NewServeMux()
	bridge := NewEventBridge()
	logger := zap.NewNop()
	router := &Router{handler: cors(mux)}

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
	} else {
		router.closers = append(router.closers, kbMgr.Close)
	}

	fileMgr, err := file.NewFileManager(logger, filepath.Join(workspaceDir, "state", "files.db"))
	if err != nil {
		logger.Error("Failed to create file manager", zap.Error(err))
		fileMgr = nil
	} else {
		router.closers = append(router.closers, fileMgr.Close)
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

	// --- Agent Orchestrator routes (/api/agent/runs + SSE stream) ---
	// The orchestrator events are bridged into the EventBridge so they can
	// be consumed via SSE subscribers (reuses the existing task_event.go
	// SSE pattern). This avoids an aiagent -> api import cycle by using a
	// small adapter that satisfies aiagent.EventSink.
	if deps.Orchestrator != nil {
		deps.Orchestrator.SetEventSink(agentEventSink{bridge: bridge})
		aiagent.NewRoutes(deps.Orchestrator, logger).Register(mux)

		// P1-3 §5.5.1: WebSocket bidirectional channel for approval
		// flow + run abort. SSE stays the read-only event stream; the
		// WebSocket carries control signaling (Agent asks UI for
		// decisions, UI tells Agent to abort).
		//
		// The WsHandler delegates approval resolution to the
		// orchestrator's Governor via closures — this keeps api →
		// aiagent a one-way import (no cycle) and lets both the HTTP
		// approval API and the WebSocket path share the same resolver.
		wsManager := NewWsSessionManager(logger)
		wsHandler := NewWsHandler(wsManager, logger)
		wsHandler.SetApprovalResolver(func(approvalID, decision, reason string) error {
			gov := deps.Orchestrator.Governor()
			if gov == nil {
				return fmt.Errorf("approval governor not configured")
			}
			return gov.ResolveApproval(approvalID, toolregistry.ApprovalDecision(decision), reason)
		})
		wsHandler.SetRunAborter(func(runID, reason string) error {
			deps.Orchestrator.StopRun(runID)
			return nil
		})
		mux.Handle("GET /api/ws", wsHandler)
	}

	// --- DB-backed task API + scheduler -> orchestrator bridge ---
	// The DB task service is exposed under a distinct "/api/db/tasks" prefix so
	// it coexists with the in-memory task handler on "/api/tasks" (still used by
	// the current frontend) without a ServeMux duplicate-pattern panic. When the
	// scheduler and orchestrator are present, POST /api/db/tasks/{id}/run enqueues
	// a task and drives it through the orchestrator (task -> scheduler -> run).
	if deps.TaskSvc != nil {
		tasks.NewRoutesWithPrefix(deps.TaskSvc, "/api/db/tasks").Register(mux)
		if deps.Scheduler != nil && deps.Orchestrator != nil {
			newAgentTaskHandler(deps.TaskSvc, deps.Scheduler, deps.Orchestrator, logger).registerRoutes(mux)
		}
	}

	// --- Conversation routes (/api/conversations + messages + SSE) ---
	if deps.ConvStore != nil {
		hConv := NewConversationHandler(deps.ConvStore, deps.Orchestrator, bridge, logger)
		hConv.RegisterRoutes(mux)
	}

	// 404 fallback
	mux.HandleFunc("api/", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	return router
}

// agentEventSink adapts the API layer's EventBridge to the aiagent.EventSink
// interface, forwarding orchestrator events to SSE subscribers keyed by run ID.
type agentEventSink struct {
	bridge *EventBridge
}

func (s agentEventSink) Publish(eventType, runID string, data map[string]any) {
	if runID == "" {
		runID = "agent"
	}
	s.bridge.Publish(TaskEventPayload{
		Type:    TaskEventType(eventType),
		TaskID:  runID,
		Message: eventType,
		Data:    data,
	})
}

// allowedOrigins returns the whitelist of allowed origins from the
// GEOWORK_ALLOWED_ORIGINS environment variable. If the variable is empty the
// default development origins are used.
func allowedOrigins() []string {
	env := os.Getenv("GEOWORK_ALLOWED_ORIGINS")
	if env == "" {
		env = "http://localhost:5173,http://127.0.0.1:5173"
	}
	parts := strings.Split(env, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			origins = append(origins, p)
		}
	}
	return origins
}

// isOriginAllowed checks whether origin is in the whitelist or is a file://
// origin (used by Electron).
func isOriginAllowed(origin string, whitelist []string) bool {
	if strings.HasPrefix(origin, "file://") {
		return true
	}
	for _, allowed := range whitelist {
		if origin == allowed {
			return true
		}
	}
	return false
}

func cors(next http.Handler) http.Handler {
	whitelist := allowedOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isOriginAllowed(origin, whitelist) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
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
