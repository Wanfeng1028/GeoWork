// GeoWork Go Core - Task Models

package tasks

import (
	"time"
)

// Status represents the lifecycle state of a task
type Status string

const (
	StatusPending    Status = "pending"
	StatusRunning    Status = "running"
	StatusCompleted  Status = "completed"
	StatusFailed     Status = "failed"
	StatusCancelled  Status = "cancelled"
)

// Task represents a unit of work in GeoWork
type Task struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Status      Status    `json:"status"`
	Mode        string    `json:"mode"` // Research/Data/GeoCode/Analysis/Write
	Prompt      string    `json:"prompt,omitempty"`
	Plan        string    `json:"plan,omitempty"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// TaskEvent represents a real-time event emitted during task execution
type TaskEvent struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	Type      EventType `json:"type"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"createdAt"`
}

// EventType defines the kind of task event
type EventType string

const (
	EventPlanCreated  EventType = "plan_created"
	EventStepStarted  EventType = "step_started"
	EventStepCompleted EventType = "step_completed"
	EventArtifact     EventType = "artifact"
	EventError       EventType = "error"
	EventStatus      EventType = "status"
	EventComplete    EventType = "complete"
)

// TaskListResponse is the response shape for listing tasks
type TaskListResponse struct {
	Total int    `json:"total"`
	Tasks []Task `json:"tasks"`
}
