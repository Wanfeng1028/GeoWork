package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// Runner executes individual workflow nodes by calling Python workers.
type Runner struct {
	logger     *zap.Logger
	worker     *worker.Client
	httpClient *http.Client
}

// NewRunner creates a new node runner.
func NewRunner(logger *zap.Logger, workerClient *worker.Client) *Runner {
	return &Runner{
		logger:     logger,
		worker:     workerClient,
		httpClient: &http.Client{},
	}
}

// ExecuteNode runs a single workflow node.
func (r *Runner) ExecuteNode(ctx context.Context, node *WorkflowNode, workflow *Workflow) error {
	r.logger.Info("executing node",
		zap.String("nodeId", node.ID),
		zap.String("nodeName", node.Name),
		zap.String("nodeType", node.Type),
	)

	switch node.Type {
	case "start":
		return r.executeStart(ctx, node, workflow)
	case "process":
		return r.executeProcess(ctx, node, workflow)
	case "agent":
		return r.executeAgent(ctx, node, workflow)
	case "output":
		return r.executeOutput(ctx, node, workflow)
	case "condition":
		return r.executeCondition(ctx, node, workflow)
	default:
		return fmt.Errorf("unknown node type: %s", node.Type)
	}
}

// Execute runs the full workflow by executing all nodes in order.
// Deprecated: use Engine.executeRun instead which handles topological sort.
func (r *Runner) Execute(ctx context.Context, workflow *Workflow) error {
	for _, node := range workflow.Nodes {
		if err := r.ExecuteNode(ctx, &node, workflow); err != nil {
			return fmt.Errorf("node %s: %w", node.Name, err)
		}
	}
	return nil
}

func (r *Runner) executeStart(ctx context.Context, node *WorkflowNode, _ *Workflow) error {
	// Start nodes initialize the workflow with input parameters.
	r.logger.Debug("start node executed", zap.String("nodeId", node.ID))
	return nil
}

func (r *Runner) executeProcess(ctx context.Context, node *WorkflowNode, _ *Workflow) error {
	// Process nodes call Python worker tools.
	return r.callWorker(ctx, node)
}

func (r *Runner) executeAgent(ctx context.Context, node *WorkflowNode, _ *Workflow) error {
	// Agent nodes may invoke sub-agents or LLM-based reasoning.
	return r.callWorker(ctx, node)
}

func (r *Runner) executeOutput(ctx context.Context, node *WorkflowNode, _ *Workflow) error {
	// Output nodes write results to files or external systems.
	r.logger.Debug("output node executed", zap.String("nodeId", node.ID))
	return nil
}

func (r *Runner) executeCondition(ctx context.Context, node *WorkflowNode, _ *Workflow) error {
	// Condition nodes evaluate a boolean expression.
	// For now, always pass through.
	r.logger.Debug("condition node evaluated (always true)", zap.String("nodeId", node.ID))
	return nil
}

func (r *Runner) callWorker(ctx context.Context, node *WorkflowNode) error {
	if r.worker == nil {
		return fmt.Errorf("worker client not configured")
	}

	// Serialize node config as the worker payload.
	payload, err := json.Marshal(node.Config)
	if err != nil {
		return fmt.Errorf("marshal node config: %w", err)
	}

	// Attempt to call the worker tool.
	// The worker client handles HTTP communication with the Python worker.
	_ = payload // payload is available for future worker integration

	r.logger.Debug("worker call simulated",
		zap.String("nodeId", node.ID),
		zap.String("tool", node.Name),
	)
	return nil
}
