// GeoWork Go Core - Event Types

package events

import (
	"encoding/json"
	"time"
)

// Type defines the kind of system event
type Type string

const (
	TypeTaskCreated   Type = "task_created"
	TypeTaskUpdated   Type = "task_updated"
	TypeTaskCompleted Type = "task_completed"
	TypeTaskFailed    Type = "task_failed"
	TypeArtifact      Type = "artifact"
	TypeError         Type = "error"
	TypeUserAction    Type = "user_action"
	TypeSystem        Type = "system"
)

// Event represents a domain event in the GeoWork system
type Event struct {
	ID        string    `json:"id"`
	Type      Type      `json:"type"`
	Source    string    `json:"source"`    // e.g. "task", "artifact", "user"
	SubjectID string    `json:"subjectId"` // ID of the entity that triggered the event
	Data      string    `json:"data"`      // JSON-encoded event payload
	Timestamp time.Time `json:"timestamp"`
}

// EventPayload is the decoded data portion of an event
type EventPayload struct {
	Type   Type            `json:"type"`
	Source string          `json:"source"`
	Data   json.RawMessage `json:"data"`
}

// EventStream provides a simple in-memory event bus for internal event routing
type EventStream struct {
	handlers map[Type][]EventHandler
}

// EventHandler is a callback invoked when a matching event is published
type EventHandler func(Event) error

func NewEventStream() *EventStream {
	return &EventStream{
		handlers: make(map[Type][]EventHandler),
	}
}

// Subscribe registers a handler for a specific event type
func (es *EventStream) Subscribe(t Type, h EventHandler) {
	es.handlers[t] = append(es.handlers[t], h)
}

// SubscribeAll registers a handler for all event types
func (es *EventStream) SubscribeAll(h EventHandler) {
	for t := range es.handlers {
		es.handlers[t] = append(es.handlers[t], h)
	}
}

// Publish sends an event to all matching handlers
func (es *EventStream) Publish(e Event) {
	for _, h := range es.handlers[e.Type] {
		_ = h(e)
	}
	for _, h := range es.handlers[TypeSystem] {
		_ = h(e)
	}
}
