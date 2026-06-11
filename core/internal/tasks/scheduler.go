// GeoWork Go Core - Task Scheduler & Queue

package tasks

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"
)

const (
	defaultMaxConcurrent = 3
	defaultTimeout       = 30 * time.Minute
)

// TaskHandler is the function signature for task execution.
type TaskHandler func(ctx context.Context) error

// Scheduler manages task scheduling, queuing, and concurrent execution.
//
// Scheduler implements a priority-based FIFO queue: items with higher
// Priority values are dequeued first; ties are broken by EnqueueAt
// (earliest first).
type Scheduler struct {
	mu             sync.RWMutex
	service        *Service
	maxConcurrent  int
	running        map[string]bool
	queue          []*TaskQueueItem
	stopped        bool
	workerCtx      context.Context
	workerCancel   context.CancelFunc
	log            *slog.Logger
	defaultTimeout time.Duration
	done           chan struct{}
	handlers       map[string]TaskHandler
}

// TaskQueueItem represents a task waiting in the scheduler queue.
type TaskQueueItem struct {
	Task      *Task
	Priority  int
	EnqueueAt time.Time
}

// NewScheduler creates a new task scheduler backed by the given Service.
//
// maxConcurrent controls the maximum number of tasks that can run
// concurrently; values <= 0 fall back to defaultMaxConcurrent (3).
// The scheduler is not started by this call; use Start() to begin
// processing the queue.
//
// The handler map populated by RegisterHandler is used by processTask
// to look up per-task execution logic, since the Task model is a data
// struct and carries no runnable behaviour itself.
func NewScheduler(service *Service, maxConcurrent int, log *slog.Logger) *Scheduler {
	if maxConcurrent <= 0 {
		maxConcurrent = defaultMaxConcurrent
	}

	workerCtx, workerCancel := context.WithCancel(context.Background())

	return &Scheduler{
		service:        service,
		maxConcurrent:  maxConcurrent,
		running:        make(map[string]bool),
		queue:          make([]*TaskQueueItem, 0),
		handlers:       make(map[string]TaskHandler),
		log:            log,
		defaultTimeout: defaultTimeout,
		workerCtx:      workerCtx,
		workerCancel:   workerCancel,
		done:           make(chan struct{}),
	}
}

// RegisterHandler associates a TaskHandler with a task ID. The handler
// will be invoked by processTask when the task is dequeued.
func (s *Scheduler) RegisterHandler(taskID string, handler TaskHandler) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers[taskID] = handler
}

// Start launches the background worker goroutine that drains the
// task queue. If the scheduler is already running, an error is
// returned.
func (s *Scheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stopped {
		return fmt.Errorf("scheduler has been stopped")
	}

	// Guard against a double-start on a live scheduler.
	if s.workerCtx != nil {
		select {
		case <-s.workerCtx.Done():
			// Worker exited cleanly; allow restart.
		default:
			return fmt.Errorf("scheduler is already running")
		}
	}

	// Replace the cancellation so the worker can run again after
	// a previous Stop+Start cycle.
	_, cancel := context.WithCancel(s.workerCtx)
	s.workerCancel = cancel

	go s.worker()

	s.log.Info("scheduler started", "maxConcurrent", s.maxConcurrent)
	return nil
}

// Stop signals the scheduler to stop accepting new work and waits
// for all currently running tasks to finish. It is safe to call
// multiple times.
func (s *Scheduler) Stop() error {
	s.mu.Lock()
	if s.stopped {
		s.mu.Unlock()
		return nil
	}
	s.stopped = true
	s.mu.Unlock()

	// Cancel the worker context so the goroutine exits its loop.
	s.workerCancel()

	// Wait for the worker goroutine to drain and exit.
	<-s.done

	s.mu.Lock()
	s.running = make(map[string]bool)
	s.queue = make([]*TaskQueueItem, 0)
	s.mu.Unlock()

	s.log.Info("scheduler stopped")
	return nil
}

// Enqueue adds a task to the scheduler queue. If the number of
// running tasks is below maxConcurrent, a dequeue is triggered
// immediately so the task may start right away.
//
// The priority argument determines execution order: higher values
// are dequeued first. When two items share the same priority the
// one enqueued earlier is processed first (FIFO).
func (s *Scheduler) Enqueue(task *Task, priority int) error {
	if task == nil {
		return fmt.Errorf("task is nil")
	}
	if task.Status != StatusPending {
		return fmt.Errorf("task %s is not in pending state (status=%s)", task.ID, task.Status)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stopped {
		return fmt.Errorf("scheduler is stopped")
	}

	item := &TaskQueueItem{
		Task:      task,
		Priority:  priority,
		EnqueueAt: time.Now().UTC(),
	}
	s.queue = append(s.queue, item)

	// Sort the queue so the highest-priority (then earliest-enqueued)
	// item is always at the front.
	sort.SliceStable(s.queue, func(i, j int) bool {
		if s.queue[i].Priority != s.queue[j].Priority {
			return s.queue[i].Priority > s.queue[j].Priority
		}
		return s.queue[i].EnqueueAt.Before(s.queue[j].EnqueueAt)
	})

	s.log.Info("task enqueued", "taskId", task.ID, "priority", priority)

	// Try to drain if there is capacity.
	s.tryDrain()

	return nil
}

// Dequeue removes the first matching task from the queue by ID.
// This is primarily useful for cancellation before a task has
// actually started. Returns nil if the task was not found in the
// queue.
func (s *Scheduler) Dequeue(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stopped {
		return fmt.Errorf("scheduler is stopped")
	}

	for i, item := range s.queue {
		if item.Task.ID == taskID {
			s.queue = append(s.queue[:i], s.queue[i+1:]...)
			s.log.Info("task dequeued", "taskId", taskID)
			return nil
		}
	}

	return fmt.Errorf("task %s not found in queue", taskID)
}

// IsRunning reports whether the given task is currently being
// executed by the scheduler.
func (s *Scheduler) IsRunning(taskID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running[taskID]
}

// RunningCount returns the number of tasks currently executing.
func (s *Scheduler) RunningCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.running)
}

// QueueLength returns the number of items waiting in the queue.
func (s *Scheduler) QueueLength() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.queue)
}

// worker is the background goroutine that drains the task queue at a
// regular tick.
func (s *Scheduler) worker() {
	defer close(s.done)

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.workerCtx.Done():
			return
		case <-ticker.C:
			s.mu.Lock()
			if s.stopped {
				s.mu.Unlock()
				return
			}
			s.tryDrainLocked()
			s.mu.Unlock()
		}
	}
}

// tryDrain is the public-facing drain entry point (acquires the lock).
func (s *Scheduler) tryDrain() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tryDrainLocked()
}

// tryDrainLocked checks whether there is capacity and dequeues the
// next task. Must be called while holding s.mu (write lock).
func (s *Scheduler) tryDrainLocked() {
	for len(s.queue) > 0 && len(s.running) < s.maxConcurrent {
		item := s.queue[0]
		s.queue = s.queue[1:]
		s.execute(item)
	}
}

// execute picks the next queued item and spawns a goroutine to
// process it, marking the task ID as running.
func (s *Scheduler) execute(item *TaskQueueItem) {
	taskID := item.Task.ID

	s.mu.Lock()
	if s.stopped {
		s.mu.Unlock()
		return
	}
	s.running[taskID] = true
	s.mu.Unlock()

	go s.processTask(item.Task)
}

// processTask runs the registered handler for the given task,
// updating status and emitting events through the Service.
//
// If no handler was registered for the task the status is set to
// Failed with an appropriate error message.
func (s *Scheduler) processTask(task *Task) {
	taskID := task.ID
	s.log.Info("processing task", "taskId", taskID)

	// Use the scheduler's own context (not the worker context) for
	// service-level operations so status/event writes always succeed.
	opCtx := context.Background()

	// Transition to Running.
	if err := s.service.UpdateStatus(opCtx, taskID, StatusRunning); err != nil {
		s.log.Error("failed to set task running", "taskId", taskID, "error", err)
		s.markNotRunning(taskID)
		return
	}

	// Emit status event.
	s.service.EmitEvent(opCtx, &TaskEvent{
		TaskID:  taskID,
		Type:    EventStatus,
		Payload: fmt.Sprintf("task %s is now running", taskID),
	})

	// Look up the handler; fall back to a no-op that fails.
	handler := func(ctx context.Context) error {
		return fmt.Errorf("no handler registered for task %s", taskID)
	}

	s.mu.RLock()
	if h, ok := s.handlers[taskID]; ok {
		handler = h
	}
	s.mu.RUnlock()

	// Wrap with a timeout so tasks cannot run forever.
	ctx, cancel := context.WithTimeout(context.Background(), s.defaultTimeout)
	defer cancel()

	// Call the handler.
	err := handler(ctx)

	if err != nil {
		s.log.Error("task failed", "taskId", taskID, "error", err)

		// Update status to Failed.
		s.service.UpdateStatus(opCtx, taskID, StatusFailed)

		// Emit error event.
		s.service.EmitEvent(opCtx, &TaskEvent{
			TaskID:  taskID,
			Type:    EventError,
			Payload: err.Error(),
		})
	} else {
		s.log.Info("task completed", "taskId", taskID)

		// Update status to Completed.
		s.service.UpdateStatus(opCtx, taskID, StatusCompleted)

		// Emit completion event.
		s.service.EmitEvent(opCtx, &TaskEvent{
			TaskID:  taskID,
			Type:    EventComplete,
			Payload: fmt.Sprintf("task %s completed successfully", taskID),
		})
	}

	s.markNotRunning(taskID)
}

// markNotRunning removes the task from the running map and triggers
// a queue drain so the next queued item can be picked up.
func (s *Scheduler) markNotRunning(taskID string) {
	s.mu.Lock()
	delete(s.running, taskID)
	// Attempt to pick up the next queued item.
	s.tryDrainLocked()
	s.mu.Unlock()
}
