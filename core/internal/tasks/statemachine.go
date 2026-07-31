// GeoWork Go Core - Task State Machine

package tasks

import "fmt"

// validTransitions defines the legal state transitions for tasks.
var validTransitions = map[Status][]Status{
	StatusPending:   {StatusRunning, StatusCancelled},
	StatusRunning:   {StatusCompleted, StatusFailed, StatusPaused, StatusCancelled},
	StatusPaused:    {StatusRunning, StatusCancelled},
	StatusFailed:    {StatusPending, StatusCancelled}, // pending = retry
	StatusRecovered: {StatusRunning},
	// StatusCompleted and StatusCancelled are terminal states — no transitions allowed.
}

// ValidateTransition checks whether a state transition from → to is legal.
func ValidateTransition(from, to Status) error {
	allowed, exists := validTransitions[from]
	if !exists {
		return fmt.Errorf("no transitions from status %q", from)
	}
	for _, s := range allowed {
		if s == to {
			return nil
		}
	}
	return fmt.Errorf("invalid transition from %q to %q", from, to)
}
