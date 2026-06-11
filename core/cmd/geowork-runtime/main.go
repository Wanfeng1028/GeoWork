package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"geowork/core/internal/api"
	"geowork/core/internal/permissions"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
	"geowork/core/internal/worker"
	"geowork/core/internal/workspace"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	workerProcess, err := worker.StartProcess(ctx, gruntime.FindRepoRoot())
	if err != nil {
		log.Printf("GeoWork Python Worker was not started automatically: %v", err)
	} else {
		defer workerProcess.Stop()
	}
	app := gruntime.New("", "http://127.0.0.1:8766")
	log.Printf("GeoWork workspace: %s", app.Workspace())

	// Initialize optional modules
	stateDir := filepath.Join(app.Workspace(), "state")
	os.MkdirAll(stateDir, 0755)

	// Workspace: file-based SQLite
	wsDB, err := sql.Open("sqlite", filepath.Join(stateDir, "workspaces.db"))
	if err != nil {
		log.Fatalf("Failed to open workspace DB: %v", err)
	}
	wsRepo := workspace.NewRepository(wsDB)
	if err := wsRepo.Init(); err != nil {
		log.Fatalf("Failed to init workspace DB: %v", err)
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
	log.Println("GeoWork runtime listening on http://127.0.0.1:8765")
	server := &http.Server{Addr: "127.0.0.1:8765", Handler: r}
	go func() {
		<-ctx.Done()
		_ = server.Shutdown(context.Background())
	}()
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
