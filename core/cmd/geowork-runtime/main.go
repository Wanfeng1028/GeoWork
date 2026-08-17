package main

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"go.uber.org/zap"

	"geowork/core/internal/aiagent"
	"geowork/core/internal/api"
	"geowork/core/internal/browserbridge"
	"geowork/core/internal/conversation"
	"geowork/core/internal/mcp"
	"geowork/core/internal/modelgateway"
	"geowork/core/internal/permissions"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
	"geowork/core/internal/storage"
	"geowork/core/internal/tasks"
	"geowork/core/internal/toolregistry"
	"geowork/core/internal/worker"
	"geowork/core/internal/workspace"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Auto-start the Python worker unless one is already listening on 8766
	// (mirrors the Electron shell's isPortInUse skip in runtime.ts): an
	// externally started worker — e.g. the P7-1 E2E testbed or an operator
	// process — is attached to instead of spawning a duplicate that would
	// fail to bind.
	var workerProcess *worker.Process
	if workerPortInUse(8766) {
		logger.Info("Python Worker already running on 8766, attaching instead of auto-starting")
	} else {
		var err error
		workerProcess, err = worker.StartProcess(ctx, gruntime.FindRepoRoot())
		if err != nil {
			logger.Warn("GeoWork Python Worker was not started automatically", zap.Error(err))
		} else {
			defer workerProcess.Stop()
		}
	}
	app := gruntime.New("", "http://127.0.0.1:8766")
	logger.Info("GeoWork workspace", zap.String("path", app.Workspace()))

	// Initialize optional modules
	stateDir := filepath.Join(app.Workspace(), "state")
	os.MkdirAll(stateDir, 0755)

	// Workspace: file-based SQLite via shared storage.OpenDB
	db, err := storage.OpenDB()
	if err != nil {
		logger.Fatal("Failed to open DB", zap.Error(err))
	}
	if err := storage.RunMigrations(db); err != nil {
		logger.Fatal("Failed to run migrations", zap.Error(err))
	}

	wsRepo := workspace.NewRepository(db)
	if err := wsRepo.Init(); err != nil {
		logger.Fatal("Failed to init workspace DB", zap.Error(err))
	}
	wsSvc := workspace.NewService(wsRepo)

	permEngine := permissions.NewEngine()
	sbSvc := sandbox.NewService()

	// Register built-in tools
	toolRegistry := toolregistry.NewRegistry(logger)
	if err := toolregistry.RegisterBuiltinTools(toolRegistry); err != nil {
		logger.Fatal("Failed to register built-in tools", zap.Error(err))
	}
	// P1-1 §2.4: configure sandbox roots so write/exec tools are confined
	// to the workspace. Without this, validateSandboxPath is a no-op
	// (legacy behavior) and a misconfigured model could escape the
	// workspace boundary.
	toolRegistry.WithAllowedRoots([]string{app.Workspace()})
	logger.Info("Built-in tools registered",
		zap.Int("count", len(toolRegistry.List())),
		zap.String("sandboxRoot", app.Workspace()),
	)

	// doc/22 BP6: derive the permission engine's write-action check from
	// the tools' declared Permission() category instead of a hardcoded
	// list. "read" is non-mutating; write/exec/delete/admin are mutating.
	// Unknown tools fall back to the engine's conservative default set.
	permEngine.WithActionCategory(func(action string) string {
		if tool, ok := toolRegistry.Get(action); ok {
			return tool.Permission()
		}
		return ""
	})
	// doc/22 BP6: prune expired decisions / aged-out requests / stale
	// policies on shutdown so a long-lived session doesn't leak them.
	defer func() {
		if n := permEngine.Cleanup(); n > 0 {
			logger.Info("permission engine cleanup", zap.Int("removed", n))
		}
	}()

	// Dynamically register Python Worker tools into the same registry so
	// workflow + aiagent calls flow through one governance path (P0-2 D5).
	// Failure is non-fatal: a missing/unreachable worker leaves only the
	// builtin tools registered, which is enough for aiagent offline runs.
	workerClient := worker.NewClient("http://127.0.0.1:8766")
	// doc/22 BP4: share the runtime token with the worker (auto-started
	// subprocess carries it via env; a manually started worker reads the
	// same env var, so reuse whichever side minted it).
	if workerProcess != nil && workerProcess.Token != "" {
		workerClient.SetToken(workerProcess.Token)
	} else if envToken := os.Getenv(worker.WorkerTokenEnv); envToken != "" {
		workerClient.SetToken(envToken)
	}
	if err := toolregistry.RegisterWorkerTools(ctx, toolRegistry, workerClient, logger); err != nil {
		logger.Warn("Failed to register worker tools", zap.Error(err))
	}

	// P2-7 §8.4: register browser tools (browser_control / screenshot /
	// network_request / paper_search) against the browserbridge controller.
	// The controller is shared across runs — sessions are tracked per Run
	// via sessionId. The CDP adapter is created in stub mode (no real
	// browser); CaptureScreenshot falls back to page metadata until chromedp
	// is added.
	browserCtrl := browserbridge.NewController(logger)
	if err := toolregistry.RegisterBrowserTools(toolRegistry, browserCtrl, logger); err != nil {
		logger.Warn("Failed to register browser tools", zap.Error(err))
	}

	// P2-2 §3.5: register MCP tools. The Manager ships with two default
	// servers (filesystem, git) marked BuiltIn=true but Enabled=false — they
	// only connect when the user opts in via the HTTP API or flips Enabled.
	// RegisterAllTools is non-fatal on per-server failure.
	mcpManager := mcp.NewManager(logger)
	if err := mcp.RegisterAllTools(ctx, mcpManager, toolRegistry, logger); err != nil {
		logger.Warn("Failed to register MCP tools", zap.Error(err))
	}

	// Wire the registry into the workflow engine created by gruntime.New
	// so workflow callWorker routes through ToolRegistry (P0-2).
	if app.AgentEngine() != nil {
		app.AgentEngine().WithRegistry(toolRegistry)
		logger.Info("Agent workflow engine wired with ToolRegistry")
	}

	// --- Task Service (DB-backed task persistence) ---
	taskSvc := tasks.NewService(db)
	if err := taskSvc.Init(); err != nil {
		logger.Fatal("Failed to init task service", zap.Error(err))
	}

	// --- Conversation Store (DB-backed conversations + messages) ---
	convStore := conversation.NewStore(db)

	// --- Model Gateway (optional; LLM calls degrade to no-op when unconfigured) ---
	gateway, provider := initModelGateway(logger)

	// doc/22 BP6 / S6: wrap the concrete client with the per-provider QPS
	// limiter so every Chat/StreamChat the agent issues passes through it.
	// Default desktop budget: 5 QPS on the 1x profile — generous for a
	// single-user agent, protective against a runaway ReAct loop hammering
	// a metered provider. NOTE: keep agentGateway a true nil interface when
	// no provider is configured — a typed-nil wrapper would defeat the
	// orchestrator's `gateway == nil` degrade check.
	var agentGateway modelgateway.ModelGateway
	if gateway != nil {
		limiter := modelgateway.NewRateLimiter()
		limiter.ConfigureProvider(provider.ID, 5, modelgateway.SpeedProfile{ID: "1x", MaxParallel: 2, TokenBudgetMul: 1.0, RateLimitMul: 1.0})
		agentGateway = modelgateway.NewRateLimitedGateway(gateway, limiter)
	}

	// --- Agent Orchestrator ---
	orchestrator := aiagent.NewOrchestrator(toolRegistry, agentGateway, provider, logger)

	// doc/22 BP6 / S6: wire the observability pair. Without these the
	// /api/agent/trajectory and /api/agent/usage endpoints return 503 and
	// no token accounting happens at all. Trajectories persist as JSON
	// files under <workspace>/data/trajectories; usage stays in memory
	// (audited per run, not billed).
	usageMeter := modelgateway.NewUsageMeter(logger)
	orchestrator.WithUsageMeter(usageMeter)
	trajStorage := aiagent.NewFileTrajectoryStorage(filepath.Join(app.Workspace(), "data", "trajectories"), logger)
	orchestrator.WithTrajectoryRecorder(aiagent.NewTrajectoryRecorder(trajStorage, logger))

	// doc/22 BP1 / F1: inject the desktop permission policy. Without it
	// the registry defaults to read-only and EVERY write/exec tool call
	// fails with "permission denied" — the agent could only read.
	// Critical tools still pass through interactive approval + Harness.
	orchestrator.WithPermissionPolicy(aiagent.DefaultDesktopPolicy())

	// doc/22 BP1 / F5: pin the workspace for RepoMap and for sandboxed
	// tools (run_shell / run_python execute with cmd.Dir = workspace).
	orchestrator.WithWorkspacePath(app.Workspace())

	// P3-2 §3.5: attach the Harness rule engine so every tool call is
	// evaluated against declarative security rules before execution.
	// Rules load from config/harness_rules.json when present; otherwise
	// the built-in defaults (no-delete-in-verifying, auto-approve-low, …)
	// apply.
	harness := aiagent.NewHarness(logger)
	harnessConfig := filepath.Join(app.Workspace(), "config", "harness_rules.json")
	if err := harness.LoadFromFile(harnessConfig); err != nil {
		logger.Warn("Failed to load harness rules config", zap.Error(err))
	}
	orchestrator.WithHarness(harness)

	// P3-3 §4.5.2: attach the tool policy table so read-only tools are
	// speculatively executed during model streaming. The policy table
	// is seeded with DefaultToolPolicies (read_file, list_files, etc.
	// marked ReadOnly=true).
	orchestrator.WithPolicyTable(toolregistry.DefaultPolicyTable())

	// P3-4 §5.3: attach the conversation summarizer so L4 (model-based
	// conversation summary) and L5 (memory solidification) are available
	// when L1-L3 trimming is insufficient. Only attach when a gateway
	// is configured (nil gateway → L4 disabled, degrade to L3). Uses the
	// rate-limited wrapper so summaries also respect the QPS budget.
	if agentGateway != nil {
		orchestrator.WithSummarizer(aiagent.NewSummarizer(agentGateway, logger))
	}

	// P3-1 §2.3: register the spawn_subagent tool so the model can
	// delegate sub-tasks to independent child orchestrators. The manager
	// shares the parent's registry/gateway/provider/governor; each child
	// gets its own Memory, state machine, and run-context map.
	subAgentMgr := aiagent.NewSubAgentManager(orchestrator, logger)
	if err := subAgentMgr.RegisterSubAgentTool(); err != nil {
		logger.Warn("Failed to register spawn_subagent tool", zap.Error(err))
	}
	// doc/22 BP5: hand the manager to the orchestrator so executePlan's
	// teardown stops + drops child orchestrators when a parent finishes.
	orchestrator.WithSubAgentManager(subAgentMgr)

	// doc/22 BP5: checkpoint retention. On shutdown, drop checkpoints
	// older than 7 days so a long-lived desktop install doesn't grow its
	// checkpoint dir without bound. Runs still referenced by the in-memory
	// run map are unaffected (retention there is enforced separately).
	if rec := orchestrator.Recovery(); rec != nil {
		defer func() {
			if n := rec.Cleanup(7 * 24 * time.Hour); n > 0 {
				logger.Info("checkpoint retention", zap.Int("removed", n))
			}
		}()
	}

	// --- Task Scheduler ---
	scheduler := tasks.NewScheduler(taskSvc, 3, logger)
	if err := scheduler.Start(); err != nil {
		logger.Warn("Failed to start task scheduler", zap.Error(err))
	}
	defer scheduler.Stop()

	// P2-4 §5.3: Agent scheduler (cron-driven recurring Agent runs) + event
	// triggers. Both are wired to the orchestrator so they kick off runs
	// through the same governance path (audit + sandbox + approval) as
	// interactive runs.
	agentScheduler := aiagent.NewScheduler(orchestrator, logger)
	agentScheduler.Start()
	defer agentScheduler.Stop()
	triggerManager := aiagent.NewTriggerManager(orchestrator, logger)

	logDir := filepath.Join(app.Workspace(), "logs")

	// P0-4: runtime token auth. Electron injects the token via env;
	// standalone runs mint one and print it on stdout (logs go to
	// stderr). GEOWORK_INSECURE_NO_AUTH=1 disables it for dev.
	auth := api.NewTokenAuthFromEnv(os.Stdout, logger)

	r := api.NewRouter(api.RouterDeps{
		App:            app,
		LogDir:         logDir,
		WorkspaceSvc:   wsSvc,
		PermEngine:     permEngine,
		SandboxSvc:     sbSvc,
		TaskSvc:        taskSvc,
		Scheduler:      scheduler,
		Orchestrator:   orchestrator,
		ConvStore:      convStore,
		AgentScheduler: agentScheduler,
		TriggerManager: triggerManager,
		Auth:           auth,
	})
	logger.Info("GeoWork runtime listening on http://127.0.0.1:8765")
	// ReadHeaderTimeout 防 slowloris 慢头发连接；不设 WriteTimeout——
	// 任务事件 SSE 与 WebSocket 是长连接，写超时会切断它们。
	server := &http.Server{
		Addr:              "127.0.0.1:8765",
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		<-ctx.Done()
		_ = server.Shutdown(context.Background())
	}()
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatal("server error", zap.Error(err))
	}
}

// initModelGateway builds the model gateway client and provider from
// environment variables. When GEOWORK_LLM_BASE_URL is empty the gateway
// is nil and the orchestrator/planner skip all LLM calls (no-op degrade).
//
// Env vars:
//
//	GEOWORK_LLM_BASE_URL     — e.g. http://127.0.0.1:11434 (OpenAI-compatible)
//	GEOWORK_LLM_API_KEY      — bearer token (optional for local servers)
//	GEOWORK_LLM_MODEL        — default model id
//	GEOWORK_LLM_PROVIDER_ID  — provider id (defaults to "default")
func initModelGateway(logger *zap.Logger) (*modelgateway.OpenAICompatibleClient, *modelgateway.ModelProvider) {
	baseURL := os.Getenv("GEOWORK_LLM_BASE_URL")
	apiKey := os.Getenv("GEOWORK_LLM_API_KEY")
	model := os.Getenv("GEOWORK_LLM_MODEL")
	providerID := os.Getenv("GEOWORK_LLM_PROVIDER_ID")
	if providerID == "" {
		providerID = "default"
	}

	provider := &modelgateway.ModelProvider{
		ID:           providerID,
		Name:         providerID,
		Kind:         "openai_compatible",
		BaseURL:      baseURL,
		APIKeyRef:    apiKey,
		DefaultModel: model,
		Enabled:      baseURL != "",
	}

	if baseURL == "" {
		logger.Info("No LLM provider configured (GEOWORK_LLM_BASE_URL empty); agent LLM calls will be skipped")
		return nil, provider
	}

	client := modelgateway.NewOpenAICompatibleClient(provider, logger)
	logger.Info("LLM provider configured",
		zap.String("baseURL", baseURL),
		zap.String("model", model),
		zap.String("providerId", providerID),
	)
	return client, provider
}

// workerPortInUse reports whether something is already listening on the
// worker port. It mirrors the Electron shell's isPortInUse check
// (runtime.ts) so an externally started worker is attached to rather than
// duplicated. A dial error (connection refused) means the port is free.
func workerPortInUse(port int) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)), 500*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}
