package agent

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"sync/atomic"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// Engine orchestrates workflow CRUD and execution.
type Engine struct {
	db     *Store
	logger *zap.Logger
	runner *Runner
	// activeRuns tracks in-flight runs for cancellation.
	activeRuns   map[string]*atomic.Bool
	activeRunsMu sync.RWMutex
}

// NewEngine creates a new workflow engine.
func NewEngine(store *Store, logger *zap.Logger, workerClient *worker.Client) *Engine {
	return &Engine{
		db:         store,
		logger:     logger,
		runner:     NewRunner(logger, workerClient),
		activeRuns: make(map[string]*atomic.Bool),
	}
}

// generateID creates a simple random hex ID.
func generateID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// CreateWorkflow creates a new workflow with the given name and description.
func (e *Engine) CreateWorkflow(name, description string) (*Workflow, error) {
	wf := &Workflow{
		ID:          generateID(),
		Name:        name,
		Description: description,
		Nodes:       []WorkflowNode{},
		Edges:       []WorkflowEdge{},
	}
	if err := e.db.CreateWorkflow(wf); err != nil {
		return nil, fmt.Errorf("create workflow: %w", err)
	}
	e.logger.Info("workflow created", zap.String("id", wf.ID), zap.String("name", wf.Name))
	return wf, nil
}

// SaveWorkflow updates an existing workflow.
func (e *Engine) SaveWorkflow(wf *Workflow) error {
	if err := e.db.UpdateWorkflow(wf); err != nil {
		return fmt.Errorf("save workflow: %w", err)
	}
	e.logger.Info("workflow saved", zap.String("id", wf.ID))
	return nil
}

// DeleteWorkflow removes a workflow by ID.
func (e *Engine) DeleteWorkflow(id string) error {
	if err := e.db.DeleteWorkflow(id); err != nil {
		return fmt.Errorf("delete workflow: %w", err)
	}
	e.logger.Info("workflow deleted", zap.String("id", id))
	return nil
}

// ListWorkflows returns all stored workflows.
func (e *Engine) ListWorkflows() ([]Workflow, error) {
	return e.db.ListWorkflows()
}

// GetWorkflow retrieves a single workflow by ID.
func (e *Engine) GetWorkflow(id string) (*Workflow, error) {
	return e.db.GetWorkflow(id)
}

// StartRun begins execution of a workflow and returns the run record.
func (e *Engine) StartRun(ctx context.Context, workflowID string) (*Run, error) {
	wf, err := e.db.GetWorkflow(workflowID)
	if err != nil {
		return nil, fmt.Errorf("get workflow %s: %w", workflowID, err)
	}

	run := &Run{
		ID:           generateID(),
		WorkflowID:   workflowID,
		WorkflowName: wf.Name,
		Status:       "running",
		Progress:     0,
		Logs:         []string{fmt.Sprintf("开始执行工作流: %s", wf.Name)},
	}
	if err := e.db.CreateRun(run); err != nil {
		return nil, fmt.Errorf("create run: %w", err)
	}

	// Register cancellation token.
	cancelFlag := new(atomic.Bool)
	e.activeRunsMu.Lock()
	e.activeRuns[run.ID] = cancelFlag
	e.activeRunsMu.Unlock()

	go e.executeRun(ctx, run, wf, cancelFlag)

	return run, nil
}

// StopRun cancels a running workflow execution.
func (e *Engine) StopRun(runID string) error {
	e.activeRunsMu.RLock()
	flag, ok := e.activeRuns[runID]
	e.activeRunsMu.RUnlock()

	if ok {
		flag.Store(true)
	}
	return e.db.CancelRun(runID)
}

// GetRun retrieves a single run by ID.
func (e *Engine) GetRun(runID string) (*Run, error) {
	return e.db.GetRun(runID)
}

// ListRuns returns all runs, optionally filtered by workflow ID.
func (e *Engine) ListRuns(workflowID string) ([]Run, error) {
	return e.db.ListRuns(workflowID)
}

// GetLogs returns the log lines for a run.
func (e *Engine) GetLogs(runID string) ([]string, error) {
	run, err := e.db.GetRun(runID)
	if err != nil {
		return nil, err
	}
	return run.Logs, nil
}

// executeRun runs the workflow nodes in topological order.
func (e *Engine) executeRun(ctx context.Context, run *Run, wf *Workflow, cancelFlag *atomic.Bool) {
	defer func() {
		e.activeRunsMu.Lock()
		delete(e.activeRuns, run.ID)
		e.activeRunsMu.Unlock()
	}()

	// Build adjacency list and compute in-degree for topological sort.
	children := make(map[string][]string)
	inDegree := make(map[string]int)
	nodeSet := make(map[string]bool)
	for _, n := range wf.Nodes {
		nodeSet[n.ID] = true
		if _, ok := inDegree[n.ID]; !ok {
			inDegree[n.ID] = 0
		}
	}
	for _, edge := range wf.Edges {
		children[edge.Source] = append(children[edge.Source], edge.Target)
		inDegree[edge.Target]++
	}

	// Kahn's algorithm for topological sort.
	queue := []string{}
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	order := []string{}
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		order = append(order, node)
		for _, child := range children[node] {
			inDegree[child]--
			if inDegree[child] == 0 {
				queue = append(queue, child)
			}
		}
	}

	totalNodes := len(order)
	if totalNodes == 0 {
		e.db.CompleteRun(run.ID, "completed")
		return
	}

	for i, nodeID := range order {
		if cancelFlag.Load() {
			e.logger.Info("run cancelled", zap.String("runId", run.ID))
			e.db.CompleteRun(run.ID, "cancelled")
			return
		}

		node := findNode(wf, nodeID)
		if node == nil {
			continue
		}

		logMsg := fmt.Sprintf("执行节点 [%s] (%s)", node.Name, node.Type)
		run.Logs = append(run.Logs, logMsg)
		e.db.UpdateRunStatus(run.ID, "running", float64(i)/float64(totalNodes)*100, run.Logs)

		if err := e.runner.ExecuteNode(ctx, node, wf); err != nil {
			if cancelFlag.Load() {
				return
			}
			failMsg := fmt.Sprintf("节点 [%s] 执行失败: %v", node.Name, err)
			run.Logs = append(run.Logs, failMsg)
			e.logger.Error("node execution failed", zap.String("nodeId", nodeID), zap.Error(err))
			e.db.CompleteRun(run.ID, "failed")
			return
		}

		doneMsg := fmt.Sprintf("节点 [%s] 执行完成", node.Name)
		run.Logs = append(run.Logs, doneMsg)
		progress := float64(i+1) / float64(totalNodes) * 100
		e.db.UpdateRunStatus(run.ID, "running", progress, run.Logs)
	}

	e.db.CompleteRun(run.ID, "completed")
	run.Logs = append(run.Logs, "工作流执行完成")
	e.db.UpdateRunStatus(run.ID, "completed", 100, run.Logs)
	e.logger.Info("workflow run completed", zap.String("runId", run.ID))
}

func findNode(wf *Workflow, id string) *WorkflowNode {
	for i := range wf.Nodes {
		if wf.Nodes[i].ID == id {
			return &wf.Nodes[i]
		}
	}
	return nil
}
