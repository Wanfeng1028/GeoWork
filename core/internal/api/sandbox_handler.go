// GeoWork Go Core - Sandbox Handler

package api

import (
	"encoding/json"
	"net/http"

	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
)

type sandboxHandler struct {
	app    *gruntime.App
	svc    *sandbox.Service
	bridge *EventBridge
}

func newSandboxHandler(app *gruntime.App, svc *sandbox.Service, bridge *EventBridge) *sandboxHandler {
	return &sandboxHandler{app: app, svc: svc, bridge: bridge}
}

func (h *sandboxHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sandbox/run-command", h.handleRunCommand)
	mux.HandleFunc("POST /api/sandbox/run-python", h.handleRunPython)
	mux.HandleFunc("GET /api/sandbox/processes", h.handleListProcesses)
	mux.HandleFunc("POST /api/sandbox/processes/stop", h.handleStopProcess)
}

// POST /api/sandbox/run-command
func (h *sandboxHandler) handleRunCommand(w http.ResponseWriter, r *http.Request) {
	if h.svc == nil {
		http.Error(w, "sandbox service not available", http.StatusServiceUnavailable)
		return
	}
	var input struct {
		TaskID  string            `json:"taskId"`
		Workspace string        `json:"workspace"`
		Command string            `json:"command"`
		Env     map[string]string `json:"env,omitempty"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)

	// Emit tool.call.started event
	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:   ToolCallStarted,
			TaskID: input.TaskID,
			Tool:   "run_command",
			Message: "Running command: " + input.Command,
			Data: map[string]any{
				"command":   input.Command,
				"workspace": input.Workspace,
				"env":       input.Env,
			},
		})
	}

	proc, err := h.svc.RunCommand(input.TaskID, input.Workspace, input.Command)
	if err != nil {
		// Emit tool.call.failed on error
		if h.bridge != nil {
			h.bridge.Publish(TaskEventPayload{
				Type:   ToolCallFailed,
				TaskID: input.TaskID,
				Tool:   "run_command",
				Error:  err.Error(),
			})
		}
		writeResult(w, proc, err)
		return
	}

	// Emit tool.call.completed
	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:   ToolCallCompleted,
			TaskID: input.TaskID,
			Tool:   "run_command",
			Data: map[string]any{
				"processId": proc.ID,
				"status":    proc.Status,
				"exitCode":  proc.ExitCode,
			},
		})
	}

	writeResult(w, proc, err)
}

// POST /api/sandbox/run-python
func (h *sandboxHandler) handleRunPython(w http.ResponseWriter, r *http.Request) {
	if h.svc == nil {
		http.Error(w, "sandbox service not available", http.StatusServiceUnavailable)
		return
	}
	var input struct {
		TaskID     string            `json:"taskId"`
		Workspace  string            `json:"workspace"`
		ScriptPath string            `json:"scriptPath"`
		Env        map[string]string `json:"env,omitempty"`
		Timeout    int               `json:"timeout"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)

	// Emit tool.call.started event
	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:   ToolCallStarted,
			TaskID: input.TaskID,
			Tool:   "run_python",
			Message: "Running Python script: " + input.ScriptPath,
			Data: map[string]any{
				"scriptPath": input.ScriptPath,
				"workspace":  input.Workspace,
				"timeout":    input.Timeout,
			},
		})
	}

	proc, err := h.svc.RunPythonScript(input.TaskID, input.Workspace, input.ScriptPath, input.Env, input.Timeout)
	if err != nil {
		if h.bridge != nil {
			h.bridge.Publish(TaskEventPayload{
				Type:   ToolCallFailed,
				TaskID: input.TaskID,
				Tool:   "run_python",
				Error:  err.Error(),
			})
		}
		writeResult(w, proc, err)
		return
	}

	// Emit tool.call.completed
	if h.bridge != nil {
		h.bridge.Publish(TaskEventPayload{
			Type:   ToolCallCompleted,
			TaskID: input.TaskID,
			Tool:   "run_python",
			Data: map[string]any{
				"processId": proc.ID,
				"status":    proc.Status,
				"exitCode":  proc.ExitCode,
			},
		})
	}

	writeResult(w, proc, err)
}

// GET /api/sandbox/processes?taskId=xxx
func (h *sandboxHandler) handleListProcesses(w http.ResponseWriter, r *http.Request) {
	if h.svc == nil {
		http.Error(w, "sandbox service not available", http.StatusServiceUnavailable)
		return
	}
	taskID := r.URL.Query().Get("taskId")
	writeJSON(w, h.svc.ListProcesses(taskID))
}

// POST /api/sandbox/processes/stop
func (h *sandboxHandler) handleStopProcess(w http.ResponseWriter, r *http.Request) {
	if h.svc == nil {
		http.Error(w, "sandbox service not available", http.StatusServiceUnavailable)
		return
	}
	var input struct {
		ProcessID string `json:"processId"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	writeResult(w, map[string]string{"status": "stopped"}, h.svc.StopProcess(input.ProcessID))
}
