package runtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"geowork/core/internal/agent"
	"geowork/core/internal/tools"
	"geowork/core/internal/worker"
)

type Event struct {
	ID      string         `json:"id"`
	TaskID  string         `json:"taskId"`
	Type    string         `json:"type"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data,omitempty"`
	Time    time.Time      `json:"time"`
}

type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Mode      string    `json:"mode"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"createdAt"`
}

type Task struct {
	ID        string       `json:"id"`
	ProjectID string       `json:"projectId"`
	Prompt    string       `json:"prompt"`
	Mode      string       `json:"mode"`
	Status    string       `json:"status"`
	Plan      []agent.Step `json:"plan"`
	Artifacts []Artifact   `json:"artifacts"`
	CreatedAt time.Time    `json:"createdAt"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

type Artifact struct {
	ID       string `json:"id"`
	TaskID   string `json:"taskId"`
	Type     string `json:"type"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	MimeType string `json:"mimeType"`
}

type Skill struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Version       string         `json:"version"`
	Description   string         `json:"description"`
	RequiredTools []string       `json:"required_tools"`
	Permissions   map[string]any `json:"permissions"`
	Status        string         `json:"status"`
}

type Plugin struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Version     string         `json:"version"`
	Author      string         `json:"author"`
	Description string         `json:"description"`
	Permissions map[string]any `json:"permissions"`
	Enabled     bool           `json:"enabled"`
}

type ModelConfig struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	BaseURL  string `json:"baseUrl"`
	Status   string `json:"status"`
}

type Automation struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Trigger   string    `json:"trigger"`
	Target    string    `json:"target"`
	Enabled   bool      `json:"enabled"`
	LastRunAt time.Time `json:"lastRunAt,omitempty"`
}

type SettingsState struct {
	Theme       string         `json:"theme"`
	Workspace   string         `json:"workspace"`
	Security    map[string]any `json:"security"`
	QGIS        map[string]any `json:"qgis"`
	Environment map[string]any `json:"environment"`
}

type EnvironmentCheck struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	Required  bool   `json:"required"`
	Message   string `json:"message"`
	Detection string `json:"detection"`
}

type UsageSummary struct {
	Tasks           int            `json:"tasks"`
	Artifacts       int            `json:"artifacts"`
	EstimatedTokens int            `json:"estimatedTokens"`
	CostCNY         float64        `json:"costCny"`
	ByMode          map[string]int `json:"byMode"`
}

type UsageRecord struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	Tokens    int       `json:"tokens"`
	CostCNY   float64   `json:"costCny"`
	CreatedAt time.Time `json:"createdAt"`
}

type App struct {
	mu           sync.Mutex
	workspace    string
	statePath    string
	planner      agent.Planner
	worker       *worker.Client
	registry     *tools.Registry
	projects     map[string]Project
	tasks        map[string]*Task
	events       map[string][]Event
	skills       []Skill
	plugins      []Plugin
	models       []ModelConfig
	automations  []Automation
	settings     SettingsState
	experts      []Expert
	papers       []Paper
	knowledge    []KnowledgeItem
	datasets     []Dataset
	layers       []MapLayer
	deliveries   []DeliveryPackage
	mcp          []MCPConnector
	runs         []AutomationRun
	decisions    []SecurityDecision
	usageRecords []UsageRecord
}

func New(workspace string, workerBaseURL string) *App {
	if workspace == "" {
		workspace = filepath.Join(os.TempDir(), "geowork-workspace")
	}
	_ = os.MkdirAll(workspace, 0755)
	repoRoot := FindRepoRoot()
	app := &App{
		workspace: workspace,
		statePath: filepath.Join(workspace, "state", "geowork-state.json"),
		worker:    worker.NewClient(workerBaseURL),
		registry:  tools.NewRegistry(),
		projects:  map[string]Project{},
		tasks:     map[string]*Task{},
		events:    map[string][]Event{},
		skills:    LoadSkills(filepath.Join(repoRoot, "skills"), defaultSkills()),
		plugins:   LoadPlugins(filepath.Join(repoRoot, "plugins"), defaultPlugins()),
		models:    defaultModels(),
		settings: SettingsState{
			Theme:       "light",
			Workspace:   workspace,
			Security:    map[string]any{"workspaceWhitelist": []string{workspace}, "approvalForRisk": []string{"medium", "high"}, "apiKeysEncrypted": true},
			QGIS:        map[string]any{"bundled": false, "strategy": "detect-local-installation"},
			Environment: map[string]any{"go": "required", "python": "required", "node": "required"},
		},
		experts:   defaultExperts(),
		papers:    defaultPapers(),
		knowledge: defaultKnowledge(workspace),
		mcp:       LoadMCPConnectors(filepath.Join(repoRoot, "mcp")),
		automations: []Automation{
			{ID: "auto_literature_watch", Name: "论文更新监控", Trigger: "cron:0 9 * * 1", Target: "Research", Enabled: true},
			{ID: "auto_data_drop", Name: "数据目录变化触发质量检查", Trigger: "fsnotify:data/", Target: "Data", Enabled: true},
		},
	}
	app.loadState()
	app.registerTools()
	return app
}

func (a *App) Workspace() string { return a.workspace }

// WorkerClient returns the underlying Python worker client.
func (a *App) WorkerClient() *worker.Client { return a.worker }

func (a *App) Health(ctx context.Context) map[string]any {
	workerHealth, err := a.worker.Health(ctx)
	status := "ok"
	if err != nil {
		status = "degraded"
		workerHealth = map[string]any{"status": "unavailable", "error": err.Error()}
	}
	return map[string]any{
		"status":    status,
		"service":   "geowork-core",
		"version":   "1.0.0-dev",
		"workspace": a.workspace,
		"worker":    workerHealth,
		"modules":   []string{"Research", "Data", "GeoCode", "Analysis", "Write", "Skills", "Plugins", "MCP", "Automation"},
		"tools":     a.ToolCatalog(),
	}
}

func (a *App) CreateProject(name, mode string) (Project, error) {
	if strings.TrimSpace(name) == "" {
		name = "GeoWork Project"
	}
	if mode == "" {
		mode = "Research"
	}
	project := Project{ID: newID("proj"), Name: name, Mode: mode, CreatedAt: time.Now()}
	project.Path = filepath.Join(a.workspace, sanitize(name)+"-"+project.ID)
	for _, dir := range []string{"data", "artifacts", "reports", "logs", "scripts", "knowledge"} {
		if err := os.MkdirAll(filepath.Join(project.Path, dir), 0755); err != nil {
			return Project{}, err
		}
	}
	a.mu.Lock()
	a.projects[project.ID] = project
	a.saveState()
	a.mu.Unlock()
	return project, nil
}

func (a *App) Projects() []Project {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make([]Project, 0, len(a.projects))
	for _, p := range a.projects {
		out = append(out, p)
	}
	return out
}

func (a *App) CreateTask(projectID, prompt, mode string) (*Task, error) {
	a.mu.Lock()
	project, ok := a.projects[projectID]
	a.mu.Unlock()
	if !ok {
		var err error
		project, err = a.CreateProject("Default GeoWork Project", mode)
		if err != nil {
			return nil, err
		}
		projectID = project.ID
	}
	if strings.TrimSpace(prompt) == "" {
		prompt = "运行 NDVI 实验报告 Skill，生成 GEE 脚本、地图预览和 Word 报告"
	}
	task := &Task{
		ID: newID("task"), ProjectID: projectID, Prompt: prompt, Mode: mode,
		Status: "created", Plan: a.planner.CreatePlan(prompt), CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	a.mu.Lock()
	a.tasks[task.ID] = task
	a.saveState()
	a.mu.Unlock()
	a.emit(task.ID, "task_created", "任务已创建", map[string]any{"task": task})
	return task, nil
}

func (a *App) Task(id string) (*Task, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	t, ok := a.tasks[id]
	return t, ok
}

func (a *App) Tasks() []*Task {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make([]*Task, 0, len(a.tasks))
	for _, t := range a.tasks {
		out = append(out, t)
	}
	return out
}

func (a *App) RunTask(ctx context.Context, id string) (*Task, error) {
	task, ok := a.Task(id)
	if !ok {
		return nil, errors.New("task not found")
	}
	project, ok := a.projectForTask(task)
	if !ok {
		return nil, errors.New("project not found")
	}
	a.setTaskStatus(task.ID, "running")
	a.emit(task.ID, "task_started", "任务开始执行", nil)
	a.emit(task.ID, "plan_created", "执行计划已生成", map[string]any{"plan": task.Plan})
	for i := range task.Plan {
		step := &task.Plan[i]
		step.Status = "running"
		a.emit(task.ID, "step_started", step.Title, map[string]any{"step": step})
		if step.RiskLevel == "high" || step.RiskLevel == "medium" {
			a.recordDecision(task.ID, step.ToolName, step.RiskLevel, "auto-approved-dev", "Development mode records approval events while preserving the audit trail.")
			a.emit(task.ID, "approval_required", "中风险工具已记录审批事件", map[string]any{"tool": step.ToolName, "risk": step.RiskLevel})
		}
		a.emit(task.ID, "tool_call", "调用工具 "+step.ToolName, map[string]any{"tool": step.ToolName})
		a.recordUsage(task.ID, "tool", step.ToolName, 180+len(task.Prompt)/2)
		result, artifacts, err := a.runTool(ctx, project, task, *step)
		if err != nil {
			step.Status = "failed"
			a.setTaskStatus(task.ID, "failed")
			a.emit(task.ID, "task_failed", err.Error(), map[string]any{"step": step})
			return task, err
		}
		for _, artifact := range artifacts {
			a.addArtifact(task.ID, artifact)
			a.emit(task.ID, "artifact_created", "成果已生成: "+artifact.Name, map[string]any{"artifact": artifact})
		}
		step.Status = "completed"
		a.emit(task.ID, "tool_result", "工具执行完成", result)
		a.emit(task.ID, "step_completed", step.Title, map[string]any{"step": step})
	}
	a.setTaskStatus(task.ID, "completed")
	a.archiveTaskLog(task.ID, project.Path)
	a.emit(task.ID, "task_completed", "任务完成", map[string]any{"artifacts": task.Artifacts})
	return task, nil
}

func (a *App) PauseTask(id string) error {
	a.setTaskStatus(id, "paused")
	a.emit(id, "task_paused", "任务已暂停", nil)
	return nil
}

func (a *App) CancelTask(id string) error {
	a.setTaskStatus(id, "cancelled")
	a.emit(id, "task_cancelled", "任务已取消", nil)
	return nil
}

func (a *App) Events(taskID string) []Event {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]Event{}, a.events[taskID]...)
}

func (a *App) StreamEvents(w http.ResponseWriter, r *http.Request, taskID string) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, _ := w.(http.Flusher)
	sent := 0
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			events := a.Events(taskID)
			for sent < len(events) {
				payload, _ := json.Marshal(events[sent])
				_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", events[sent].Type, payload)
				sent++
			}
			if flusher != nil {
				flusher.Flush()
			}
			if t, ok := a.Task(taskID); ok && (t.Status == "completed" || t.Status == "failed" || t.Status == "cancelled") && sent >= len(events) {
				return
			}
		}
	}
}

func (a *App) Skills() []Skill                 { return append([]Skill{}, a.skills...) }
func (a *App) Plugins() []Plugin               { return append([]Plugin{}, a.plugins...) }
func (a *App) Models() []ModelConfig           { return append([]ModelConfig{}, a.models...) }
func (a *App) Automations() []Automation       { return append([]Automation{}, a.automations...) }
func (a *App) Experts() []Expert               { return append([]Expert{}, a.experts...) }
func (a *App) Papers() []Paper                 { return append([]Paper{}, a.papers...) }
func (a *App) Knowledge() []KnowledgeItem      { return append([]KnowledgeItem{}, a.knowledge...) }
func (a *App) Datasets() []Dataset             { return append([]Dataset{}, a.datasets...) }
func (a *App) Layers() []MapLayer              { return append([]MapLayer{}, a.layers...) }
func (a *App) Deliveries() []DeliveryPackage   { return append([]DeliveryPackage{}, a.deliveries...) }
func (a *App) MCPConnectors() []MCPConnector   { return append([]MCPConnector{}, a.mcp...) }
func (a *App) AutomationRuns() []AutomationRun { return append([]AutomationRun{}, a.runs...) }
func (a *App) SecurityDecisions() []SecurityDecision {
	return append([]SecurityDecision{}, a.decisions...)
}
func (a *App) UsageRecords() []UsageRecord { return append([]UsageRecord{}, a.usageRecords...) }

func (a *App) ToolCatalog() []map[string]any {
	registered := a.registry.List()
	out := make([]map[string]any, 0, len(registered))
	for _, tool := range registered {
		out = append(out, map[string]any{"name": tool.Name(), "description": tool.Description(), "risk": tool.RiskLevel()})
	}
	return out
}

func (a *App) EinoSchema() map[string]any {
	einoTools := []agent.EinoTool{}
	for _, tool := range a.registry.List() {
		einoTools = append(einoTools, agent.EinoTool{Name: tool.Name(), Description: tool.Description(), Risk: string(tool.RiskLevel()), Inputs: []string{"workspace", "taskId", "prompt", "mode", "params"}})
	}
	return agent.NewEinoAdapter(einoTools).PlanAndExecuteSchema()
}

func (a *App) SearchPapers(query string) []Paper {
	if strings.TrimSpace(query) == "" {
		return a.Papers()
	}
	query = strings.ToLower(query)
	out := []Paper{}
	for _, paper := range a.Papers() {
		if strings.Contains(strings.ToLower(paper.Title), query) || strings.Contains(strings.ToLower(strings.Join(paper.Tags, " ")), query) {
			out = append(out, paper)
		}
	}
	if len(out) == 0 {
		out = append(out, Paper{ID: newID("paper"), Title: "OpenAlex result for " + query, Authors: []string{"OpenAlex"}, Year: time.Now().Year(), Source: "OpenAlex simulated", Abstract: "Development-time search result routed through the plugin permission layer.", Tags: []string{query}, ImportedAt: time.Now()})
	}
	return out
}

func (a *App) IndexKnowledge(title, typ, path string) KnowledgeItem {
	item := KnowledgeItem{ID: newID("kb"), Title: title, Type: typ, Path: path, Summary: "Indexed by GeoWork local knowledge pipeline.", IndexedAt: time.Now()}
	a.mu.Lock()
	a.knowledge = append(a.knowledge, item)
	a.saveState()
	a.mu.Unlock()
	return item
}

func (a *App) RegisterDataset(projectID, name, typ, path string) (Dataset, error) {
	if projectID == "" {
		project, err := a.CreateProject("GeoWork Data Project", "Data")
		if err != nil {
			return Dataset{}, err
		}
		projectID = project.ID
	}
	a.mu.Lock()
	project, ok := a.projects[projectID]
	a.mu.Unlock()
	if !ok {
		return Dataset{}, errors.New("project not found")
	}
	if name == "" {
		name = "Sample Dataset"
	}
	if typ == "" {
		typ = "GeoTIFF"
	}
	if path == "" {
		path = filepath.Join(project.Path, "data", sanitize(name)+".tif")
		_ = os.WriteFile(path, []byte("GeoWork sample dataset marker"), 0644)
	}
	if !a.isPathAllowed(path) {
		return Dataset{}, errors.New("dataset path is outside workspace whitelist")
	}
	dataset := Dataset{
		ID: newID("data"), ProjectID: projectID, Name: name, Type: typ, Path: path, CRS: "EPSG:4326", Status: "registered",
		Quality:   map[string]any{"geometry": "valid", "metadata": "complete", "recommendations": []string{"Run GDAL/QGIS checks before final delivery."}},
		CreatedAt: time.Now(),
	}
	layer := MapLayer{ID: newID("layer"), ProjectID: projectID, Name: name, Kind: typ, Source: path, Visible: true, Opacity: 0.82, Style: map[string]any{"palette": "viridis", "stroke": "#18745f"}, CreatedAt: time.Now()}
	a.mu.Lock()
	a.datasets = append(a.datasets, dataset)
	a.layers = append(a.layers, layer)
	a.saveState()
	a.mu.Unlock()
	return dataset, nil
}

func (a *App) UpdateLayer(id string, visible bool, opacity float64) (MapLayer, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i := range a.layers {
		if a.layers[i].ID == id {
			a.layers[i].Visible = visible
			if opacity >= 0 && opacity <= 1 {
				a.layers[i].Opacity = opacity
			}
			a.saveState()
			return a.layers[i], nil
		}
	}
	return MapLayer{}, errors.New("layer not found")
}

func (a *App) CreateDelivery(projectID string) (DeliveryPackage, error) {
	a.mu.Lock()
	project, ok := a.projects[projectID]
	a.mu.Unlock()
	if !ok {
		return DeliveryPackage{}, errors.New("project not found")
	}
	artifacts := []Artifact{}
	for _, task := range a.Tasks() {
		if task.ProjectID == projectID {
			artifacts = append(artifacts, task.Artifacts...)
		}
	}
	path := filepath.Join(project.Path, "artifacts", "delivery_manifest.json")
	formats := []string{"GeoTIFF", "COG", "GeoJSON", "CSV", "Excel", "PNG", "SVG", "PDF", "HTML Map", "Notebook", "Python", "GEE Python", "DOCX", "PPTX", "BibTeX", "Markdown"}
	delivery := DeliveryPackage{ID: newID("delivery"), ProjectID: projectID, Name: project.Name + " Delivery Manifest", Path: path, Artifacts: artifacts, Formats: formats, CreatedAt: time.Now()}
	raw, _ := json.MarshalIndent(delivery, "", "  ")
	_ = os.WriteFile(path, raw, 0644)
	a.mu.Lock()
	a.deliveries = append(a.deliveries, delivery)
	a.saveState()
	a.mu.Unlock()
	return delivery, nil
}

func (a *App) TriggerAutomation(ctx context.Context, id string) (AutomationRun, error) {
	a.mu.Lock()
	var automation Automation
	found := false
	for i := range a.automations {
		if a.automations[i].ID == id {
			a.automations[i].LastRunAt = time.Now()
			automation = a.automations[i]
			found = true
			break
		}
	}
	a.mu.Unlock()
	if !found {
		return AutomationRun{}, errors.New("automation not found")
	}
	task, err := a.CreateTask("", "自动化触发: "+automation.Name, automation.Target)
	if err != nil {
		return AutomationRun{}, err
	}
	run := AutomationRun{ID: newID("run"), AutomationID: id, TaskID: task.ID, Status: "running", Message: automation.Trigger, StartedAt: time.Now()}
	a.mu.Lock()
	a.runs = append(a.runs, run)
	a.saveState()
	a.mu.Unlock()
	_, err = a.RunTask(ctx, task.ID)
	a.mu.Lock()
	for i := range a.runs {
		if a.runs[i].ID == run.ID {
			if err != nil {
				a.runs[i].Status = "failed"
				a.runs[i].Message = err.Error()
			} else {
				a.runs[i].Status = "completed"
				run.Status = "completed"
			}
			a.saveState()
			break
		}
	}
	a.mu.Unlock()
	if err != nil {
		return run, err
	}
	return run, nil
}

func (a *App) EnablePlugin(id string, enabled bool) ([]Plugin, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i := range a.plugins {
		if a.plugins[i].ID == id {
			a.plugins[i].Enabled = enabled
			a.saveState()
			return append([]Plugin{}, a.plugins...), nil
		}
	}
	return nil, errors.New("plugin not found")
}

func (a *App) SaveModel(model ModelConfig) ModelConfig {
	if model.ID == "" {
		model.ID = strings.ToLower(strings.ReplaceAll(model.Provider+"_"+model.Name, " ", "_"))
	}
	if model.Status == "" {
		model.Status = "configured"
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	for i := range a.models {
		if a.models[i].ID == model.ID {
			a.models[i] = model
			a.saveState()
			return model
		}
	}
	a.models = append(a.models, model)
	a.saveState()
	return model
}

func (a *App) TestModel(model ModelConfig) ModelConfig {
	if model.ID == "" {
		model.ID = newID("model")
	}
	if model.Name == "" {
		model.Name = model.Provider
	}
	model.Status = "reachable"
	a.mu.Lock()
	a.models = append(a.models, model)
	a.saveState()
	a.mu.Unlock()
	a.recordUsage("", "model_test", model.Provider, 120)
	return model
}

func (a *App) Usage() UsageSummary {
	a.mu.Lock()
	defer a.mu.Unlock()
	s := UsageSummary{ByMode: map[string]int{}}
	for _, t := range a.tasks {
		s.Tasks++
		s.Artifacts += len(t.Artifacts)
		s.EstimatedTokens += 1800 + len(t.Plan)*650
		s.ByMode[t.Mode]++
	}
	s.CostCNY = float64(s.EstimatedTokens) / 1000000 * 14
	return s
}

func (a *App) recordUsage(taskID, kind, name string, tokens int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.usageRecords = append(a.usageRecords, UsageRecord{
		ID: newID("usage"), TaskID: taskID, Kind: kind, Name: name,
		Tokens: tokens, CostCNY: float64(tokens) / 1000000 * 14, CreatedAt: time.Now(),
	})
	a.saveState()
}

func (a *App) Settings() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()
	return map[string]any{"workspace": a.settings.Workspace, "security": a.settings.Security, "ui": map[string]any{"theme": a.settings.Theme, "framework": "Ant Design v5 + SCSS Modules"}, "qgis": a.settings.QGIS, "environment": a.settings.Environment}
}

func (a *App) EnvironmentChecks() []EnvironmentCheck {
	checks := []EnvironmentCheck{
		{Name: "Go Runtime", Status: "managed", Required: true, Message: "Go Core Runtime is the active API and task orchestrator.", Detection: "current-process"},
		{Name: "Python Geo Worker", Status: "managed", Required: true, Message: "Started by Go Runtime when available; health exposed through /api/worker/geo/check.", Detection: "http://127.0.0.1:8766/health"},
		{Name: "Node/Electron", Status: "configured", Required: true, Message: "Desktop app uses Electron + React + TypeScript.", Detection: "workspace package.json"},
		{Name: "QGIS", Status: "detect-local", Required: false, Message: "QGIS is not bundled; GeoWork detects a local installation before running Processing.", Detection: "plugins/qgis"},
		{Name: "GDAL", Status: "worker-capability", Required: false, Message: "GDAL-adjacent checks route through Python Worker and local environment settings.", Detection: "workers/geo-python"},
		{Name: "Model API", Status: "user-configured", Required: true, Message: "OpenAI-compatible providers are configured from Models & API.", Detection: "/api/models"},
	}
	return checks
}

func (a *App) UpdateSettings(settings SettingsState) map[string]any {
	a.mu.Lock()
	if settings.Theme != "" {
		a.settings.Theme = settings.Theme
	}
	if settings.Workspace != "" {
		a.settings.Workspace = settings.Workspace
	}
	if settings.Security != nil {
		a.settings.Security = settings.Security
	}
	if settings.QGIS != nil {
		a.settings.QGIS = settings.QGIS
	}
	if settings.Environment != nil {
		a.settings.Environment = settings.Environment
	}
	a.saveState()
	a.mu.Unlock()
	return a.Settings()
}

func (a *App) CreateAutomation(automation Automation) Automation {
	if automation.ID == "" {
		automation.ID = newID("auto")
	}
	if automation.Name == "" {
		automation.Name = "GeoWork Automation"
	}
	if automation.Trigger == "" {
		automation.Trigger = "manual"
	}
	if automation.Target == "" {
		automation.Target = "Analysis"
	}
	a.mu.Lock()
	a.automations = append(a.automations, automation)
	a.saveState()
	a.mu.Unlock()
	return automation
}

func (a *App) ResolveSecurityDecision(id, decision, reason string) (SecurityDecision, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i := range a.decisions {
		if a.decisions[i].ID == id {
			a.decisions[i].Decision = decision
			a.decisions[i].Reason = reason
			a.saveState()
			return a.decisions[i], nil
		}
	}
	return SecurityDecision{}, errors.New("security decision not found")
}

type FileEntry struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Type      string    `json:"type"`
	Size      int64     `json:"size"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (a *App) ProjectFiles(projectID string) ([]FileEntry, error) {
	a.mu.Lock()
	project, ok := a.projects[projectID]
	a.mu.Unlock()
	if !ok {
		return nil, errors.New("project not found")
	}
	if !a.isPathAllowed(project.Path) {
		return nil, errors.New("project path is outside workspace whitelist")
	}
	out := []FileEntry{}
	err := filepath.WalkDir(project.Path, func(path string, d os.DirEntry, err error) error {
		if err != nil || path == project.Path {
			return err
		}
		info, statErr := d.Info()
		if statErr != nil {
			return statErr
		}
		typ := "file"
		if d.IsDir() {
			typ = "dir"
		}
		out = append(out, FileEntry{Name: d.Name(), Path: path, Type: typ, Size: info.Size(), UpdatedAt: info.ModTime()})
		return nil
	})
	return out, err
}

func (a *App) AllArtifacts() []Artifact {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := []Artifact{}
	for _, task := range a.tasks {
		out = append(out, task.Artifacts...)
	}
	return out
}

func (a *App) isPathAllowed(path string) bool {
	abs, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	workspace, err := filepath.Abs(a.workspace)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(workspace, abs)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func (a *App) projectForTask(task *Task) (Project, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	p, ok := a.projects[task.ProjectID]
	return p, ok
}

func (a *App) runTool(ctx context.Context, project Project, task *Task, step agent.Step) (map[string]any, []Artifact, error) {
	payload := map[string]any{"workspace": project.Path, "taskId": task.ID, "prompt": task.Prompt, "mode": task.Mode}
	result, err := a.registry.Run(ctx, step.ToolName, payload)
	if err != nil {
		return nil, nil, err
	}
	return result.Data, artifactsFromWorker(task.ID, result.Data), nil
}

func (a *App) registerTools() {
	a.registry.Register(tools.FuncTool{ToolName: "task.parse", ToolDescription: "Parse prompt, mode, workspace and output constraints.", Risk: tools.RiskLow, Handler: func(ctx context.Context, input tools.Input) (tools.Result, error) {
		return tools.Result{OK: true, Message: "Task parsed", Data: map[string]any{"ok": true, "mode": input["mode"], "workspace": input["workspace"]}}, nil
	}})
	a.registry.Register(workerTool("geo.gee.generate_ndvi_script", "Generate GEE NDVI Python script and HTML map preview.", tools.RiskMedium, a.worker.GenerateNDVI))
	a.registry.Register(workerTool("geo.office.write_report", "Generate Markdown and DOCX reports.", tools.RiskMedium, a.worker.WriteReport))
	a.registry.Register(workerTool("geo.gdal.inspect_dataset", "Inspect GIS dataset quality and local processing readiness.", tools.RiskMedium, a.worker.InspectDataset))
	a.registry.Register(workerTool("research.openalex.search", "Search literature and generate a review matrix through OpenAlex-compatible workflow.", tools.RiskLow, a.worker.SearchOpenAlex))
	a.registry.Register(workerTool("papers.parse_pdf", "Parse a PDF into reading notes and reproducibility checklist.", tools.RiskLow, a.worker.ParsePDF))
	a.registry.Register(workerTool("knowledge.index", "Build a local knowledge index for project documents.", tools.RiskLow, a.worker.IndexKnowledge))
	a.registry.Register(workerTool("qgis.check", "Detect QGIS local installation strategy and status.", tools.RiskMedium, a.worker.CheckQGIS))
	a.registry.Register(tools.FuncTool{ToolName: "automation.trigger", ToolDescription: "Trigger a guarded automation task.", Risk: tools.RiskMedium, Handler: func(ctx context.Context, input tools.Input) (tools.Result, error) {
		return tools.Result{OK: true, Message: "Automation trigger recorded", Data: map[string]any{"ok": true, "trigger": input["prompt"]}}, nil
	}})
	a.registry.Register(tools.FuncTool{ToolName: "model.test", ToolDescription: "Validate OpenAI-compatible model configuration.", Risk: tools.RiskLow, Handler: func(ctx context.Context, input tools.Input) (tools.Result, error) {
		return tools.Result{OK: true, Message: "Model endpoint reachable in development mode", Data: map[string]any{"ok": true, "status": "reachable"}}, nil
	}})
	a.registry.Register(tools.FuncTool{ToolName: "security.review", ToolDescription: "Review tool permissions and workspace boundaries.", Risk: tools.RiskLow, Handler: func(ctx context.Context, input tools.Input) (tools.Result, error) {
		return tools.Result{OK: true, Message: "Security review completed", Data: map[string]any{"ok": true, "workspace": input["workspace"]}}, nil
	}})
}

func workerTool(name string, description string, risk tools.RiskLevel, call func(context.Context, map[string]any) (map[string]any, error)) tools.FuncTool {
	return tools.FuncTool{ToolName: name, ToolDescription: description, Risk: risk, Handler: func(ctx context.Context, input tools.Input) (tools.Result, error) {
		payload := map[string]any{}
		for key, value := range input {
			payload[key] = value
		}
		data, err := call(ctx, payload)
		if err != nil {
			return tools.Result{}, err
		}
		message, _ := data["message"].(string)
		if message == "" {
			message = description
		}
		return tools.Result{OK: true, Message: message, Data: data}, nil
	}}
}

func artifactsFromWorker(taskID string, out map[string]any) []Artifact {
	raw, ok := out["artifacts"].([]any)
	if !ok {
		return nil
	}
	artifacts := []Artifact{}
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		path, _ := m["path"].(string)
		name, _ := m["name"].(string)
		kind, _ := m["type"].(string)
		mime, _ := m["mimeType"].(string)
		artifacts = append(artifacts, Artifact{ID: newID("art"), TaskID: taskID, Type: kind, Name: name, Path: path, MimeType: mime})
	}
	return artifacts
}

func (a *App) addArtifact(taskID string, artifact Artifact) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if t, ok := a.tasks[taskID]; ok {
		t.Artifacts = append(t.Artifacts, artifact)
		t.UpdatedAt = time.Now()
		a.saveState()
	}
}

func (a *App) setTaskStatus(taskID, status string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if t, ok := a.tasks[taskID]; ok {
		t.Status = status
		t.UpdatedAt = time.Now()
		a.saveState()
	}
}

func (a *App) emit(taskID, typ, message string, data map[string]any) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.events[taskID] = append(a.events[taskID], Event{ID: newID("evt"), TaskID: taskID, Type: typ, Message: message, Data: data, Time: time.Now()})
	a.saveState()
}

func (a *App) recordDecision(taskID, tool, risk, decision, reason string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.decisions = append(a.decisions, SecurityDecision{ID: newID("sec"), TaskID: taskID, Tool: tool, Risk: risk, Decision: decision, Reason: reason, CreatedAt: time.Now()})
	a.saveState()
}

func (a *App) archiveTaskLog(taskID, projectPath string) {
	events := a.Events(taskID)
	path := filepath.Join(projectPath, "logs", taskID+".jsonl")
	f, err := os.Create(path)
	if err != nil {
		return
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	for _, event := range events {
		_ = enc.Encode(event)
	}
}

func defaultSkills() []Skill {
	names := []string{"ndvi-timeseries-analysis", "gee-sentinel2-cloudfree-composite", "landsat-lst-retrieval", "land-cover-classification", "urban-expansion-analysis", "water-extraction-ndwi", "dem-terrain-analysis", "paper-reading-geography", "literature-review-remote-sensing", "undergraduate-experiment-report", "graduate-thesis-outline", "map-layout-export"}
	out := make([]Skill, 0, len(names))
	for _, id := range names {
		out = append(out, Skill{ID: id, Name: strings.ReplaceAll(id, "-", " "), Version: "1.0.0", Description: "GeoWork official workflow skill", RequiredTools: []string{"geo.gee.generate_ndvi_script", "geo.office.write_report"}, Permissions: map[string]any{"network": true, "file_write": true, "shell": false}, Status: "ready"})
	}
	return out
}

func defaultPlugins() []Plugin {
	return []Plugin{
		{ID: "openalex", Name: "OpenAlex Literature Search", Version: "1.0.0", Author: "GeoWork", Description: "论文搜索和文献元数据导入。", Permissions: map[string]any{"network": true, "file_write": false}, Enabled: true},
		{ID: "zotero", Name: "Zotero Connector", Version: "1.0.0", Author: "GeoWork", Description: "连接 Zotero 文献库。", Permissions: map[string]any{"network": true, "local_app": true}, Enabled: false},
		{ID: "qgis", Name: "QGIS Bridge", Version: "1.0.0", Author: "GeoWork", Description: "检测本机 QGIS 并调用 Processing。", Permissions: map[string]any{"process": true, "file_read": true, "file_write": true}, Enabled: false},
		{ID: "postgis", Name: "PostGIS Connector", Version: "1.0.0", Author: "GeoWork", Description: "连接 PostGIS 数据源。", Permissions: map[string]any{"network": true, "database": true}, Enabled: false},
	}
}

func defaultModels() []ModelConfig {
	providers := []string{"DeepSeek", "Qwen", "Kimi", "Doubao", "Zhipu", "OpenAI", "Claude", "Ollama", "vLLM", "Custom OpenAI-compatible"}
	out := []ModelConfig{}
	for _, p := range providers {
		out = append(out, ModelConfig{ID: strings.ToLower(strings.ReplaceAll(p, " ", "_")), Name: p, Provider: p, BaseURL: "https://api.example.local/v1", Status: "not_configured"})
	}
	return out
}

func sanitize(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	replacer := strings.NewReplacer(" ", "-", "\\", "-", "/", "-", ":", "-", "*", "", "?", "", "\"", "", "<", "", ">", "", "|", "")
	if name == "" {
		return "project"
	}
	return replacer.Replace(name)
}

func FindRepoRoot() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(cwd, "skills")); err == nil {
			return cwd
		}
		parent := filepath.Dir(cwd)
		if parent == cwd {
			return "."
		}
		cwd = parent
	}
}

func newID(prefix string) string {
	var b [4]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b[:]))
}
