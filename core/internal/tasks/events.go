// GeoWork Go Core - Task Events (SSE Streaming)

package tasks

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// SSEHandler provides Server-Sent Events streaming for task events.
type SSEHandler struct {
	service *Service
}

func NewSSEHandler(service *Service) *SSEHandler {
	return &SSEHandler{service: service}
}

// StreamTaskEvents opens an SSE connection for real-time task event streaming.
// Clients subscribe with ?taskId=<id> query parameter.
func (h *SSEHandler) StreamTaskEvents(w http.ResponseWriter, req *http.Request) {
	taskID := req.URL.Query().Get("taskId")
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "taskId query parameter is required")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "SSE streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher.Flush()

	// Send existing events first
	events, err := h.service.ListEvents(req.Context(), taskID)
	if err == nil {
		for _, e := range events {
			writeSSEEvent(w, "event", TaskEventToJSON(e))
			flusher.Flush()
		}
	}

	// Send periodic keep-alive to prevent connection timeout
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-req.Context().Done():
			writeSSEEvent(w, "close", "")
			return
		case <-ticker.C:
			writeSSEEvent(w, "ping", "")
			flusher.Flush()
		}
	}
}

// TaskEventToJSON converts a TaskEvent to its JSON string representation.
func TaskEventToJSON(e TaskEvent) string {
	data, _ := json.Marshal(e)
	return string(data)
}

func writeSSEEvent(w http.ResponseWriter, event string, data string) {
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
}

// EventBridge allows non-HTTP code paths to push events into the SSE stream.
type EventBridge struct {
	subscribers map[string][]chan TaskEvent
}

func NewEventBridge() *EventBridge {
	return &EventBridge{
		subscribers: make(map[string][]chan TaskEvent),
	}
}

// Subscribe registers a new channel for a task's events.
func (eb *EventBridge) Subscribe(taskID string) chan TaskEvent {
	ch := make(chan TaskEvent, 64)
	eb.subscribers[taskID] = append(eb.subscribers[taskID], ch)
	return ch
}

// Unsubscribe removes a channel from a task's subscriber list.
func (eb *EventBridge) Unsubscribe(taskID string, ch chan TaskEvent) {
	subscribers := eb.subscribers[taskID]
	for i, sub := range subscribers {
		if sub == ch {
			eb.subscribers[taskID] = append(subscribers[:i], subscribers[i+1:]...)
			close(ch)
			return
		}
	}
}

// Publish sends an event to all subscribers of a task.
func (eb *EventBridge) Publish(event TaskEvent) {
	subscribers := eb.subscribers[event.TaskID]
	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
			// Drop if channel is full to avoid blocking
		}
	}
}
