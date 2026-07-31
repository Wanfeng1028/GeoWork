package agent

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// Runner executes individual workflow nodes by calling Python workers.
type Runner struct {
	logger     *zap.Logger
	worker     *worker.Client
	httpClient *http.Client
	// maxRetries is the maximum number of retry attempts for transient errors.
	maxRetries int
	// callTimeout is the per-call timeout for worker requests.
	callTimeout time.Duration
}

// NewRunner creates a new node runner.
func NewRunner(logger *zap.Logger, workerClient *worker.Client) *Runner {
	return &Runner{
		logger:      logger,
		worker:      workerClient,
		httpClient:  &http.Client{},
		maxRetries:  3,
		callTimeout: 30 * time.Second,
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

func (r *Runner) executeStart(_ context.Context, node *WorkflowNode, _ *Workflow) error {
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

func (r *Runner) executeOutput(_ context.Context, node *WorkflowNode, _ *Workflow) error {
	r.logger.Debug("output node executed", zap.String("nodeId", node.ID))
	return nil
}

func (r *Runner) executeCondition(_ context.Context, node *WorkflowNode, _ *Workflow) error {
	expression, _ := node.Config["expression"].(string)
	if expression == "" || expression == "true" {
		r.logger.Debug("condition node evaluated", zap.String("nodeId", node.ID), zap.Bool("result", true))
		return nil
	}
	if expression == "false" {
		return fmt.Errorf("condition evaluated false for node %s", node.Name)
	}
	return fmt.Errorf("unsupported condition expression: %s", expression)
}

func (r *Runner) callWorker(ctx context.Context, node *WorkflowNode) error {
	if r.worker == nil {
		return fmt.Errorf("worker client not configured")
	}
	toolName := firstString(node.Config["tool"], node.Config["toolName"], node.Config["workerTool"])
	if toolName == "" {
		toolName = node.Name
	}
	payload := map[string]any{}
	for key, value := range node.Config {
		payload[key] = value
	}
	if _, ok := payload["taskId"]; !ok {
		payload["taskId"] = node.ID
	}
	if _, ok := payload["prompt"]; !ok {
		payload["prompt"] = node.Name
	}
	if _, ok := payload["mode"]; !ok {
		payload["mode"] = "Analysis"
	}
	if _, ok := payload["workspace"]; !ok {
		payload["workspace"] = "."
	}

	// Execute with timeout and retry logic
	var result map[string]any
	var err error
	for attempt := 0; attempt <= r.maxRetries; attempt++ {
		callCtx, cancel := context.WithTimeout(ctx, r.callTimeout)
		result, err = r.worker.RunTool(callCtx, toolName, payload)
		cancel()

		if err == nil {
			break
		}

		// Only retry on transient errors (network/timeout), not on logic errors
		if !isTransientError(err) {
			r.logger.Warn("non-transient worker error, not retrying",
				zap.String("nodeId", node.ID),
				zap.String("tool", toolName),
				zap.Int("attempt", attempt+1),
				zap.Error(err),
			)
			break
		}

		if attempt < r.maxRetries {
			r.logger.Warn("transient worker error, retrying",
				zap.String("nodeId", node.ID),
				zap.String("tool", toolName),
				zap.Int("attempt", attempt+1),
				zap.Error(err),
			)
			time.Sleep(time.Duration(200*(attempt+1)) * time.Millisecond)
		}
	}

	if err != nil {
		return fmt.Errorf("run worker tool %s (after %d attempts): %w", toolName, r.maxRetries+1, err)
	}

	// Validate worker result
	if err := validateWorkerResult(result); err != nil {
		r.logger.Warn("worker result validation failed",
			zap.String("nodeId", node.ID),
			zap.String("tool", toolName),
			zap.Error(err),
		)
		// Validation failure is not fatal; log and continue
	}

	r.logger.Debug("worker tool completed",
		zap.String("nodeId", node.ID),
		zap.String("tool", toolName),
		zap.Any("result", result),
	)
	return nil
}

// isTransientError returns true for network/timeout errors worth retrying.
func isTransientError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "timeout") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "EOF") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "temporary failure")
}

// validateWorkerResult checks that the worker returned a non-empty result.
func validateWorkerResult(result map[string]any) error {
	if result == nil {
		return fmt.Errorf("worker returned nil result")
	}
	if len(result) == 0 {
		return fmt.Errorf("worker returned empty result")
	}
	// Check for explicit error field from worker
	if errVal, ok := result["error"]; ok {
		if errStr, isStr := errVal.(string); isStr && errStr != "" {
			return fmt.Errorf("worker reported error: %s", errStr)
		}
	}
	return nil
}

func firstString(values ...any) string {
	for _, value := range values {
		if text, ok := value.(string); ok && text != "" {
			return text
		}
	}
	return ""
}
