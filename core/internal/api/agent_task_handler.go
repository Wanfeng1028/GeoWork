// GeoWork Go Core - Agent Task Bridge Handler

package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"geowork/core/internal/aiagent"
	"geowork/core/internal/tasks"

	"go.uber.org/zap"
)

// agentTaskHandler bridges the DB-backed task queue to the agent orchestrator.
//
// A DB task is the durable unit of work; when it is "run" it is enqueued in the
// scheduler, and the scheduler drives it through the orchestrator:
//
//	POST /api/db/tasks/{id}/run  ->  scheduler.Enqueue  ->  orchestrator.StartRun
//
// The scheduler owns the task lifecycle (pending -> running -> completed/failed)
// and persists status + events via tasks.Service, while the orchestrator emits
// granular step events over the agent SSE stream. This wires the previously
// deferred task -> scheduler -> orchestrator scheduling path.
type agentTaskHandler struct {
	svc          *tasks.Service
	scheduler    *tasks.Scheduler
	orchestrator *aiagent.Orchestrator
	log          *zap.Logger
}

func newAgentTaskHandler(svc *tasks.Service, scheduler *tasks.Scheduler, orchestrator *aiagent.Orchestrator, log *zap.Logger) *agentTaskHandler {
	return &agentTaskHandler{svc: svc, scheduler: scheduler, orchestrator: orchestrator, log: log}
}

func (h *agentTaskHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/db/tasks/{id}/run", h.handleRun)
}

// POST /api/db/tasks/{id}/run?priority=0
//
// Enqueues an existing pending DB task into the scheduler. The scheduler picks
// it up (respecting maxConcurrent), transitions it to running, invokes the
// orchestrator, and finally marks it completed or failed based on the run
// outcome.
func (h *agentTaskHandler) handleRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	task, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	if task.Status != tasks.StatusPending {
		writeError(w, http.StatusConflict, fmt.Sprintf("task %s is not pending (status=%s)", task.ID, task.Status))
		return
	}

	priority := 0
	if p := r.URL.Query().Get("priority"); p != "" {
		if v, convErr := strconv.Atoi(p); convErr == nil {
			priority = v
		}
	}

	// Register a scheduler handler that drives the task through the
	// orchestrator and blocks until the run reaches a terminal state, so the
	// scheduler can map success/failure onto the task lifecycle.
	h.scheduler.RegisterHandler(task.ID, h.orchestratorHandler(task.Mode, task.Prompt))

	if err := h.scheduler.Enqueue(task, priority); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.log.Info("task enqueued for orchestrator execution",
		zap.String("taskId", task.ID),
		zap.Int("priority", priority),
	)

	writeJSON(w, map[string]any{
		"status":   "enqueued",
		"taskId":   task.ID,
		"priority": priority,
	})
}

// orchestratorHandler returns a tasks.TaskHandler that starts an orchestrator
// run and waits for it to finish. A failed run is surfaced as an error so the
// scheduler marks the task Failed; success returns nil so it is marked
// Completed.
func (h *agentTaskHandler) orchestratorHandler(mode, prompt string) tasks.TaskHandler {
	return func(ctx context.Context) error {
		run, err := h.orchestrator.StartRun(ctx, mode, prompt)
		if err != nil {
			return err
		}
		run, err = h.orchestrator.WaitForRun(ctx, run.ID)
		if err != nil {
			return err
		}
		if run.Status == aiagent.StatusFailed {
			return fmt.Errorf("agent run %s failed", run.ID)
		}
		return nil
	}
}
