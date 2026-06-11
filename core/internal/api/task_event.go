// GeoWork Go Core - Unified Task Event Types

package api

import (
	"encoding/json"
	"net/http"
	"sync"
)

// TaskEvent defines the standard event types emitted during task execution.
// These map directly to the frontend RuntimeEvent.type expectations.
type TaskEventType string

const (
	// Task lifecycle events
	TaskStarted    TaskEventType = "task.started"
	TaskCompleted  TaskEventType = "task.completed"
	TaskFailed     TaskEventType = "task.failed"
	TaskCancelled  TaskEventType = "task.cancelled"
	TaskPaused     TaskEventType = "task.paused"

	// Step lifecycle events
	StepStarted    TaskEventType = "task.step.started"
	StepDelta      TaskEventType = "task.step.delta"
	StepCompleted  TaskEventType = "task.step.completed"

	// Tool call events
	ToolCallStarted  TaskEventType = "tool.call.started"
	ToolCallDelta    TaskEventType = "tool.call.delta"
	ToolCallCompleted TaskEventType = "tool.call.completed"
	ToolCallFailed   TaskEventType = "tool.call.failed"

	// Permission events
	PermissionRequired TaskEventType = "permission.required"

	// Artifact / diff events
	ArtifactCreated TaskEventType = "artifact.created"
	DiffCreated     TaskEventType = "diff.created"
)

// TaskEventPayload is the standardized JSON payload for SSE task events.
type TaskEventPayload struct {
	Type    TaskEventType       `json:"type"`
	TaskID  string              `json:"taskId,omitempty"`
	StepID  string              `json:"stepId,omitempty"`
	Message string              `json:"message,omitempty"`
	Tool    string              `json:"tool,omitempty"`
	Data    map[string]any      `json:"data,omitempty"`
	Error   string              `json:"error,omitempty"`
}

// PermissionRequiredPayload is the payload shape for permission.required events.
type PermissionRequiredPayload struct {
	RequestID   string `json:"requestId"`
	TaskID      string `json:"taskId"`
	Action      string `json:"action"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Command     string `json:"command,omitempty"`
	RiskLevel   string `json:"riskLevel"`
}

// ArtifactCreatedPayload is the payload shape for artifact.created events.
type ArtifactCreatedPayload struct {
	ID       string `json:"id"`
	TaskID   string `json:"taskId"`
	Type     string `json:"type"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	MimeType string `json:"mimeType,omitempty"`
}

// DiffCreatedPayload is the payload shape for diff.created events.
type DiffCreatedPayload struct {
	ID      string `json:"id"`
	TaskID  string `json:"taskId"`
	Path    string `json:"path"`
	Preview string `json:"preview,omitempty"`
}

// EventBridge is a thread-safe pub/sub for task events.
// It replaces the old runtime.App.emit() pattern and provides SSE streaming.
type EventBridge struct {
	mu       sync.RWMutex
	subscribers map[string][]chan TaskEventPayload
}

// NewEventBridge creates a new EventBridge instance.
func NewEventBridge() *EventBridge {
	return &EventBridge{
		subscribers: make(map[string][]chan TaskEventPayload),
	}
}

// Subscribe returns a channel that receives events for the given taskID.
// Callers must read from the returned channel and close it when done.
func (eb *EventBridge) Subscribe(taskID string) chan TaskEventPayload {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	ch := make(chan TaskEventPayload, 64)
	eb.subscribers[taskID] = append(eb.subscribers[taskID], ch)
	return ch
}

// Unsubscribe removes a channel from the subscriber list for a task.
func (eb *EventBridge) Unsubscribe(taskID string, ch chan TaskEventPayload) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	subscribers := eb.subscribers[taskID]
	for i, sub := range subscribers {
		if sub == ch {
			eb.subscribers[taskID] = append(subscribers[:i], subscribers[i+1:]...)
			close(ch)
			return
		}
	}
}

// Publish sends an event to all subscribers for the given taskID.
func (eb *EventBridge) Publish(event TaskEventPayload) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	subscribers := eb.subscribers[event.TaskID]
	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
			// Drop if channel is full to avoid blocking
		}
	}
}

// PublishToAll sends an event to all subscribers (no taskID filter).
func (eb *EventBridge) PublishToAll(event TaskEventPayload) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	for _, subs := range eb.subscribers {
		for _, ch := range subs {
			select {
			case ch <- event:
			default:
			}
		}
	}
}

// SSEWriter provides SSE frame writing utilities.
type SSEWriter struct {
	w http.ResponseWriter
}

// NewSSEWriter creates an SSEWriter and sets the required headers.
func NewSSEWriter(w http.ResponseWriter) *SSEWriter {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	return &SSEWriter{w: w}
}

// Send writes a single SSE event frame.
func (sse *SSEWriter) Send(event TaskEventType, data any) {
	payload, _ := json.Marshal(data)
	sse.w.Write([]byte("event: "))
	sse.w.Write([]byte(string(event)))
	sse.w.Write([]byte("\ndata: "))
	sse.w.Write(payload)
	sse.w.Write([]byte("\n\n"))
	sse.w.(http.Flusher).Flush()
}

// Ping writes a comment frame to keep the connection alive.
func (sse *SSEWriter) Ping() {
	sse.w.Write([]byte(": ping\n\n"))
	sse.w.(http.Flusher).Flush()
}

// Error writes an SSE error frame.
func (sse *SSEWriter) Error(msg string) {
	sse.Send(ToolCallFailed, map[string]any{"error": msg})
}
