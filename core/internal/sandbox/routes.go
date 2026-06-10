// GeoWork Go Core - Sandbox Routes

package sandbox

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	service *Service
}

func NewRoutes(service *Service) *Routes {
	return &Routes{service: service}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/sandbox/run-command", r.handleRunCommand)
	mux.HandleFunc("/api/sandbox/run-python", r.handleRunPython)
	mux.HandleFunc("/api/sandbox/processes", r.handleListProcesses)
	mux.HandleFunc("/api/sandbox/processes/stop", r.handleStopProcess)
}

func (r *Routes) handleRunCommand(w http.ResponseWriter, req *http.Request) {
	var input struct {
		TaskID    string            `json:"taskId"`
		Workspace string            `json:"workspace"`
		Command   string            `json:"command"`
		Env       map[string]string `json:"env,omitempty"`
	}
	json.NewDecoder(req.Body).Decode(&input)

	proc, err := r.service.RunCommand(input.TaskID, input.Workspace, input.Command)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, proc)
}

func (r *Routes) handleRunPython(w http.ResponseWriter, req *http.Request) {
	var input struct {
		TaskID     string            `json:"taskId"`
		Workspace  string            `json:"workspace"`
		ScriptPath string            `json:"scriptPath"`
		Env        map[string]string `json:"env,omitempty"`
		Timeout    int               `json:"timeout"`
	}
	json.NewDecoder(req.Body).Decode(&input)

	proc, err := r.service.RunPythonScript(input.TaskID, input.Workspace, input.ScriptPath, input.Env, input.Timeout)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, proc)
}

func (r *Routes) handleListProcesses(w http.ResponseWriter, req *http.Request) {
	taskID := req.URL.Query().Get("taskId")
	procs := r.service.ListProcesses(taskID)
	writeJSON(w, procs)
}

func (r *Routes) handleStopProcess(w http.ResponseWriter, req *http.Request) {
	var input struct {
		ProcessID string `json:"processId"`
	}
	json.NewDecoder(req.Body).Decode(&input)

	if err := r.service.StopProcess(input.ProcessID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "stopped"})
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
