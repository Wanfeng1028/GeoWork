// GeoWork Go Core - Agent Scheduler (P2-4 §5.3)
//
// Scheduler runs cron-style recurring Agent runs. It uses Go's stdlib
// time.Ticker to wake every minute, then for each enabled ScheduledTask
// whose NextRun is due it kicks off an Orchestrator.StartRun in a
// background goroutine (the orchestrator is fully non-blocking).
//
// Cron parsing is deliberately minimal: 5-field Unix cron (minute hour
// day-of-month month day-of-week). The implementation supports the common
// fields used by ops teams (* / , -) but does not implement @reboot /
// @daily macros — callers should use the equivalent 5-field expression.

package aiagent

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// ScheduledTask describes a recurring agent run.
type ScheduledTask struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Cron    string    `json:"cron"`   // 5-field Unix cron
	Mode    string    `json:"mode"`   // Agent Mode (Build / Research / etc.)
	Prompt  string    `json:"prompt"` // Prompt template; literal for now
	Enabled bool      `json:"enabled"`
	LastRun time.Time `json:"lastRun"`
	NextRun time.Time `json:"nextRun"`
}

// Scheduler periodically starts Agent runs based on ScheduledTasks.
type Scheduler struct {
	mu     sync.RWMutex
	tasks  map[string]*ScheduledTask
	orch   *Orchestrator
	log    *zap.Logger
	stopCh chan struct{}
	wg     sync.WaitGroup
	tz     *time.Location
}

// NewScheduler builds a scheduler bound to an orchestrator. The
// scheduler is idle until Start is called.
func NewScheduler(orch *Orchestrator, log *zap.Logger) *Scheduler {
	return &Scheduler{
		tasks:  make(map[string]*ScheduledTask),
		orch:   orch,
		log:    log,
		stopCh: make(chan struct{}),
		tz:     time.Local,
	}
}

// WithTimezone overrides the timezone used to evaluate cron expressions
// (defaults to time.Local). Returns the scheduler for chaining.
func (s *Scheduler) WithTimezone(tz *time.Location) *Scheduler {
	if tz != nil {
		s.tz = tz
	}
	return s
}

// Add registers a scheduled task. If the task is enabled and Cron is
// parseable, NextRun is computed; otherwise the task is added but stays
// dormant (and an error is returned to the caller so they can fix Cron).
func (s *Scheduler) Add(task *ScheduledTask) error {
	if task == nil {
		return fmt.Errorf("nil task")
	}
	if task.ID == "" {
		return fmt.Errorf("task ID required")
	}
	if _, err := ParseCron(task.Cron); err != nil {
		return fmt.Errorf("invalid cron %q: %w", task.Cron, err)
	}
	if task.Enabled {
		task.NextRun = NextCron(task.Cron, time.Now().In(s.tz))
	}

	s.mu.Lock()
	s.tasks[task.ID] = task
	s.mu.Unlock()
	if s.log != nil {
		s.log.Info("scheduled task added",
			zap.String("id", task.ID),
			zap.String("cron", task.Cron),
			zap.Bool("enabled", task.Enabled),
			zap.Time("nextRun", task.NextRun),
		)
	}
	return nil
}

// Update modifies an existing scheduled task. Returns ErrNotFound if the
// task ID is unknown.
func (s *Scheduler) Update(id string, patch ScheduledTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.tasks[id]
	if !ok {
		return fmt.Errorf("scheduled task %q not found", id)
	}
	if patch.Cron != "" {
		if _, err := ParseCron(patch.Cron); err != nil {
			return fmt.Errorf("invalid cron %q: %w", patch.Cron, err)
		}
		task.Cron = patch.Cron
	}
	if patch.Name != "" {
		task.Name = patch.Name
	}
	if patch.Mode != "" {
		task.Mode = patch.Mode
	}
	if patch.Prompt != "" {
		task.Prompt = patch.Prompt
	}
	task.Enabled = patch.Enabled
	task.NextRun = NextCron(task.Cron, time.Now().In(s.tz))
	return nil
}

// Remove deletes a scheduled task by ID.
func (s *Scheduler) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.tasks[id]; !ok {
		return fmt.Errorf("scheduled task %q not found", id)
	}
	delete(s.tasks, id)
	return nil
}

// List returns a snapshot of all scheduled tasks.
func (s *Scheduler) List() []ScheduledTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ScheduledTask, 0, len(s.tasks))
	for _, t := range s.tasks {
		out = append(out, *t)
	}
	return out
}

// Get returns a copy of a scheduled task by ID.
func (s *Scheduler) Get(id string) (*ScheduledTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tasks[id]
	if !ok {
		return nil, fmt.Errorf("scheduled task %q not found", id)
	}
	cp := *t
	return &cp, nil
}

// Start launches the scheduler loop. It returns immediately; the loop
// runs in a background goroutine until Stop is called.
func (s *Scheduler) Start() {
	s.wg.Add(1)
	go s.loop()
}

// Stop terminates the scheduler loop and waits for the in-flight
// goroutine to exit. In-flight StartRun calls are not cancelled — the
// orchestrator manages their lifecycle independently.
func (s *Scheduler) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

func (s *Scheduler) loop() {
	defer s.wg.Done()
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case now := <-ticker.C:
			s.checkAndRun(now)
		}
	}
}

func (s *Scheduler) checkAndRun(now time.Time) {
	s.mu.RLock()
	due := make([]*ScheduledTask, 0)
	for _, t := range s.tasks {
		if !t.Enabled {
			continue
		}
		if t.NextRun.IsZero() {
			continue
		}
		if !now.Before(t.NextRun) {
			due = append(due, t)
		}
	}
	s.mu.RUnlock()

	for _, task := range due {
		// Snapshot prompt/mode for the closure so concurrent Update
		// calls cannot mutate them mid-flight.
		mode := task.Mode
		prompt := task.Prompt
		id := task.ID
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			runCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			run, err := s.orch.StartRun(runCtx, mode, prompt)
			if s.log != nil {
				if err != nil {
					s.log.Warn("scheduled run failed to start",
						zap.String("task", id),
						zap.Error(err),
					)
				} else {
					s.log.Info("scheduled run started",
						zap.String("task", id),
						zap.String("runId", run.ID),
					)
				}
			}
		}()

		s.mu.Lock()
		if cur, ok := s.tasks[task.ID]; ok {
			cur.LastRun = now
			cur.NextRun = NextCron(cur.Cron, now.In(s.tz))
		}
		s.mu.Unlock()
	}
}

// --- Cron parser (5-field Unix cron) ---------------------------------------

// cronSchedule is the parsed form of a 5-field cron expression.
type cronSchedule struct {
	minute, hour, dayOfMonth, month, dayOfWeek []int
}

// ParseCron validates a 5-field cron expression and returns the parsed
// schedule. Supported field syntax: * / N, a-b, a,b,c, and literal ints.
func ParseCron(expr string) (*cronSchedule, error) {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return nil, fmt.Errorf("cron %q must have 5 fields, got %d", expr, len(fields))
	}
	sched := &cronSchedule{}
	var err error
	if sched.minute, err = parseCronField(fields[0], 0, 59); err != nil {
		return nil, fmt.Errorf("minute: %w", err)
	}
	if sched.hour, err = parseCronField(fields[1], 0, 23); err != nil {
		return nil, fmt.Errorf("hour: %w", err)
	}
	if sched.dayOfMonth, err = parseCronField(fields[2], 1, 31); err != nil {
		return nil, fmt.Errorf("day-of-month: %w", err)
	}
	if sched.month, err = parseCronField(fields[3], 1, 12); err != nil {
		return nil, fmt.Errorf("month: %w", err)
	}
	if sched.dayOfWeek, err = parseCronField(fields[4], 0, 6); err != nil {
		return nil, fmt.Errorf("day-of-week: %w", err)
	}
	return sched, nil
}

func parseCronField(field string, min, max int) ([]int, error) {
	if field == "*" {
		return seq(min, max), nil
	}
	out := []int{}
	for _, part := range strings.Split(field, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		// */N
		if strings.HasPrefix(part, "*/") {
			stepStr := strings.TrimPrefix(part, "*/")
			step, err := strconv.Atoi(stepStr)
			if err != nil || step <= 0 {
				return nil, fmt.Errorf("invalid step %q", part)
			}
			for v := min; v <= max; v += step {
				out = append(out, v)
			}
			continue
		}
		// range a-b
		if strings.Contains(part, "-") {
			rangeParts := strings.SplitN(part, "-", 2)
			if len(rangeParts) != 2 {
				return nil, fmt.Errorf("invalid range %q", part)
			}
			a, err1 := strconv.Atoi(rangeParts[0])
			b, err2 := strconv.Atoi(rangeParts[1])
			if err1 != nil || err2 != nil || a < min || b > max || a > b {
				return nil, fmt.Errorf("invalid range %q", part)
			}
			out = append(out, seq(a, b)...)
			continue
		}
		// single value
		v, err := strconv.Atoi(part)
		if err != nil {
			return nil, fmt.Errorf("invalid value %q", part)
		}
		if v < min || v > max {
			return nil, fmt.Errorf("value %d out of range [%d, %d]", v, min, max)
		}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("empty field %q", field)
	}
	return out, nil
}

func seq(min, max int) []int {
	out := make([]int, 0, max-min+1)
	for v := min; v <= max; v++ {
		out = append(out, v)
	}
	return out
}

func containsInt(xs []int, v int) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}

// NextCron returns the next time at or after `from` that the cron
// expression matches. The lookup scans minute-by-minute; suitable for
// minute-resolution scheduling (which is the ticker granularity).
func NextCron(expr string, from time.Time) time.Time {
	sched, err := ParseCron(expr)
	if err != nil {
		// Fallback: never fire. The Add() path already rejected this.
		return time.Time{}
	}
	// Round up to the next minute boundary.
	t := from.Truncate(time.Minute).Add(time.Minute)
	for i := 0; i < 60*24*366; i++ { // scan up to 1 year
		if containsInt(sched.minute, t.Minute()) &&
			containsInt(sched.hour, t.Hour()) &&
			containsInt(sched.dayOfMonth, t.Day()) &&
			containsInt(sched.month, int(t.Month())) &&
			containsInt(sched.dayOfWeek, int(t.Weekday())) {
			return t
		}
		t = t.Add(time.Minute)
	}
	return time.Time{}
}
