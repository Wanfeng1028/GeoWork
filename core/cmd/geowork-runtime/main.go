package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"go.uber.org/zap"

	"geowork/core/internal/api"
	"geowork/core/internal/permissions"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
	"geowork/core/internal/storage"
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

	logDir := filepath.Join(app.Workspace(), "logs")

	r := api.NewRouter(api.RouterDeps{
		App:          app,
		LogDir:       logDir,
		WorkspaceSvc: wsSvc,
		PermEngine:   permEngine,
		SandboxSvc:   sbSvc,
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
