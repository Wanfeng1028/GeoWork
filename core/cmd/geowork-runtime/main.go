package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"go.uber.org/zap"

	"geowork/core/internal/aiagent"
	"geowork/core/internal/api"
	"geowork/core/internal/conversation"
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

	workerProcess, err := worker.StartProcess(ctx, gruntime.FindRepoRoot())
	if err != nil {
		logger.Warn("GeoWork Python Worker was not started automatically", zap.Error(err))
	} else {
		defer workerProcess.Stop()
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
	logger.Info("Built-in tools registered", zap.Int("count", len(toolRegistry.List())))

	// --- Task Service (DB-backed task persistence) ---
	taskSvc := tasks.NewService(db)
	if err := taskSvc.Init(); err != nil {
		logger.Fatal("Failed to init task service", zap.Error(err))
	}

	// --- Conversation Store (DB-backed conversations + messages) ---
	convStore := conversation.NewStore(db)

	// --- Model Gateway (optional; LLM calls degrade to no-op when unconfigured) ---
	gateway, provider := initModelGateway(logger)

	// --- Agent Orchestrator ---
	orchestrator := aiagent.NewOrchestrator(toolRegistry, gateway, provider, logger)

	// --- Task Scheduler ---
	scheduler := tasks.NewScheduler(taskSvc, 3, logger)
	if err := scheduler.Start(); err != nil {
		logger.Warn("Failed to start task scheduler", zap.Error(err))
	}
	defer scheduler.Stop()

	logDir := filepath.Join(app.Workspace(), "logs")

	r := api.NewRouter(api.RouterDeps{
		App:          app,
		LogDir:       logDir,
		WorkspaceSvc: wsSvc,
		PermEngine:   permEngine,
		SandboxSvc:   sbSvc,
		TaskSvc:      taskSvc,
		Scheduler:    scheduler,
		Orchestrator: orchestrator,
		ConvStore:    convStore,
	})
	logger.Info("GeoWork runtime listening on http://127.0.0.1:8765")
	server := &http.Server{Addr: "127.0.0.1:8765", Handler: r}
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
