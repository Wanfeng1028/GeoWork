package main

import (
  "context"
  "log"
  "net/http"
  "os"
  "os/signal"
  "syscall"
  "geowork/core/internal/api"
  gruntime "geowork/core/internal/runtime"
  "geowork/core/internal/worker"
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
  r := api.NewRouter(api.RouterDeps{App: app})
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
