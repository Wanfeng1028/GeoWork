package runtime

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type persistedState struct {
	Projects     map[string]Project `json:"projects"`
	Tasks        map[string]*Task `json:"tasks"`
	Events       map[string][]Event `json:"events"`
	Plugins      []Plugin `json:"plugins"`
	Models       []ModelConfig `json:"models"`
	Automations  []Automation `json:"automations"`
	Knowledge    []KnowledgeItem `json:"knowledge"`
	Datasets     []Dataset `json:"datasets"`
	Layers       []MapLayer `json:"layers"`
	Deliveries   []DeliveryPackage `json:"deliveries"`
	Runs         []AutomationRun `json:"runs"`
	Decisions    []SecurityDecision `json:"decisions"`
	UsageRecords []UsageRecord `json:"usageRecords"`
	Settings     SettingsState `json:"settings"`
}

func (a *App) loadState() {
	raw, err := os.ReadFile(a.statePath)
	if err != nil {
		return
	}
	var state persistedState
	if json.Unmarshal(raw, &state) != nil {
		return
	}
	if state.Projects != nil {
		a.projects = state.Projects
	}
	if state.Tasks != nil {
		a.tasks = state.Tasks
	}
	if state.Events != nil {
		a.events = state.Events
	}
	if state.Plugins != nil {
		a.plugins = state.Plugins
	}
	if state.Models != nil {
		a.models = state.Models
	}
	if state.Automations != nil {
		a.automations = state.Automations
	}
	if state.Knowledge != nil {
		a.knowledge = state.Knowledge
	}
	if state.Datasets != nil {
		a.datasets = state.Datasets
	}
	if state.Layers != nil {
		a.layers = state.Layers
	}
	if state.Deliveries != nil {
		a.deliveries = state.Deliveries
	}
	if state.Runs != nil {
		a.runs = state.Runs
	}
	if state.Decisions != nil {
		a.decisions = state.Decisions
	}
	if state.UsageRecords != nil {
		a.usageRecords = state.UsageRecords
	}
	if state.Settings.Workspace != "" {
		a.settings = state.Settings
	}
}

func (a *App) saveState() {
	if a.statePath == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(a.statePath), 0755)
	state := persistedState{
		Projects: a.projects, Tasks: a.tasks, Events: a.events, Plugins: a.plugins,
		Models: a.models, Automations: a.automations, Knowledge: a.knowledge,
		Datasets: a.datasets, Layers: a.layers, Deliveries: a.deliveries,
		Runs: a.runs, Decisions: a.decisions, UsageRecords: a.usageRecords, Settings: a.settings,
	}
	raw, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(a.statePath, raw, 0600)
}
