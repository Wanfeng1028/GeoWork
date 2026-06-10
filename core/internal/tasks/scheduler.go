package tasks

import (
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// TaskType defines the kind of scheduling.
type TaskType string

const (
	Once     TaskType = "once"
	Delayed  TaskType = "delayed"
	Periodic TaskType = "periodic"
	Cron     TaskType = "cron"
)

// ScheduledTask represents a single scheduled task entry.
type ScheduledTask struct {
	ID       string
	Type     TaskType
	Schedule string
	Handler  func() error
	NextRun  time.Time
	Interval time.Duration
	Enabled  bool
}

// TaskScheduler manages scheduled task execution.
type TaskScheduler struct {
	mu      sync.RWMutex
	tasks   map[string]*ScheduledTask
	log     *slog.Logger
	stopCh  chan struct{}
	once    sync.Once
	running bool
}

// NewTaskScheduler creates a new scheduler instance.
func NewTaskScheduler(log *slog.Logger) *TaskScheduler {
	return &TaskScheduler{
		tasks:  make(map[string]*ScheduledTask),
		log:    log,
		stopCh: make(chan struct{}),
	}
}

// Schedule adds a task to the scheduler.
func (s *TaskScheduler) Schedule(task ScheduledTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if task.ID == "" {
		return fmt.Errorf("task ID is required")
	}
	if task.Handler == nil {
		return fmt.Errorf("task handler is nil")
	}

	task.Enabled = true
	task.NextRun = time.Now()

	switch task.Type {
	case Once:
		// will run immediately when scheduler tick fires
	case Delayed:
		d, err := time.ParseDuration(task.Schedule)
		if err != nil {
			return fmt.Errorf("invalid delay duration %q: %w", task.Schedule, err)
		}
		task.NextRun = time.Now().Add(d)
	case Periodic:
		d, err := time.ParseDuration(task.Schedule)
		if err != nil {
			return fmt.Errorf("invalid period duration %q: %w", task.Schedule, err)
		}
		task.NextRun = time.Now()
		task.Interval = d
	case Cron:
		next, err := parseSimpleCron(task.Schedule)
		if err != nil {
			return fmt.Errorf("invalid cron expression %q: %w", task.Schedule, err)
		}
		task.NextRun = next
		task.Interval = 0
	default:
		return fmt.Errorf("unknown task type: %s", task.Type)
	}

	s.tasks[task.ID] = &task
	s.log.Info("task scheduled", "id", task.ID, "type", string(task.Type))
	return nil
}

// Start begins the scheduler goroutine.
func (s *TaskScheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return fmt.Errorf("scheduler already running")
	}

	s.running = true
	s.stopCh = make(chan struct{})

	go s.run()

	s.log.Info("scheduler started")
	return nil
}

// Stop halts the scheduler.
func (s *TaskScheduler) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return nil
	}

	s.once.Do(func() {
		close(s.stopCh)
	})

	s.running = false
	s.log.Info("scheduler stopped")
	return nil
}

func (s *TaskScheduler) run() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.mu.RLock()
			for _, task := range s.tasks {
				if !task.Enabled {
					continue
				}
				if time.Now().After(task.NextRun) || time.Now().Equal(task.NextRun) {
					s.mu.RUnlock()
					func() {
						defer func() {
							s.mu.RLock()
							defer s.mu.RUnlock()
							switch task.Type {
							case Once:
								delete(s.tasks, task.ID)
							case Delayed:
								delete(s.tasks, task.ID)
							case Periodic:
								task.NextRun = time.Now().Add(task.Interval)
							case Cron:
								next, err := parseSimpleCron(task.Schedule)
								if err != nil {
									s.log.Error("cron parse error", "id", task.ID, "error", err)
									return
								}
								task.NextRun = next
							}
						}()
						if err := task.Handler(); err != nil {
							s.log.Error("task handler error", zap.String("id", task.ID), zap.Error(err))
						}
					}()
					s.mu.RLock()
				}
			}
			s.mu.RUnlock()
		}
	}
}

// Reschedule updates the next run time for an existing task.
func (s *TaskScheduler) Reschedule(taskID string, nextRun time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	task.NextRun = nextRun
	return nil
}

// GetNextRun returns the next scheduled execution time for a task.
func (s *TaskScheduler) GetNextRun(taskID string) (time.Time, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return time.Time{}, fmt.Errorf("task %s not found", taskID)
	}

	return task.NextRun, nil
}

// GetTask returns a copy of a task by ID.
func (s *TaskScheduler) GetTask(taskID string) (*ScheduledTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task %s not found", taskID)
	}

	cp := *task
	return &cp, nil
}

// ListTasks returns a snapshot of all registered tasks.
func (s *TaskScheduler) ListTasks() []ScheduledTask {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]ScheduledTask, 0, len(s.tasks))
	for _, t := range s.tasks {
		cp := *t
		result = append(result, cp)
	}
	return result
}

// EnableTask enables a task by ID.
func (s *TaskScheduler) EnableTask(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}
	task.Enabled = true
	return nil
}

// DisableTask disables a task by ID.
func (s *TaskScheduler) DisableTask(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}
	task.Enabled = false
	return nil
}

// RemoveTask removes a task from the scheduler.
func (s *TaskScheduler) RemoveTask(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.tasks[taskID]; !exists {
		return fmt.Errorf("task %s not found", taskID)
	}
	delete(s.tasks, taskID)
	return nil
}

// CountTasks returns the number of registered tasks.
func (s *TaskScheduler) CountTasks() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.tasks)
}

// parseSimpleCron parses a simple cron expression "*/N * * * *" or "@every N" format.
// Supports: @every duration, @hourly, @daily, @weekly, and */N minute format.
func parseSimpleCron(expr string) (time.Time, error) {
	expr = strings.TrimSpace(expr)

	switch expr {
	case "@hourly", "@every 1h":
		return time.Now().Add(1 * time.Hour), nil
	case "@daily", "@every 24h":
		return time.Now().Add(24 * time.Hour), nil
	case "@weekly", "@every 168h":
		return time.Now().Add(168 * time.Hour), nil
	}

	if strings.HasPrefix(expr, "@every ") {
		dur, err := time.ParseDuration(strings.TrimPrefix(expr, "@every "))
		if err != nil {
			return time.Time{}, fmt.Errorf("invalid @every duration: %w", err)
		}
		return time.Now().Add(dur), nil
	}

	if strings.HasPrefix(expr, "*/") {
		parts := strings.Fields(expr)
		if len(parts) < 2 {
			return time.Time{}, fmt.Errorf("invalid cron expression: %s", expr)
		}
		field := strings.TrimPrefix(parts[0], "*/")
		n, err := strconv.Atoi(field)
		if err != nil {
			return time.Time{}, fmt.Errorf("invalid minute field: %w", err)
		}
		if n <= 0 || n > 59 {
			return time.Time{}, fmt.Errorf("minute step out of range: %d", n)
		}
		return time.Now().Add(time.Duration(n) * time.Minute), nil
	}

	return time.Time{}, fmt.Errorf("unsupported cron expression: %s", expr)
}
