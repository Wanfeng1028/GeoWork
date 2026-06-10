package diagnostics

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// CrashReport holds details about a crash event.
type CrashReport struct {
	ID           string   `json:"id"`
	Timestamp    string   `json:"timestamp"`
	StackTrace   string   `json:"stack_trace"`
	Error        string   `json:"error"`
	Goroutines   []string `json:"goroutines,omitempty"`
	OS           string   `json:"os"`
	Architecture string   `json:"architecture"`
	GoVersion    string   `json:"go_version"`
}

// CrashHandler manages crash reporting and persistence.
type CrashHandler struct {
	crashDir string
}

// NewCrashHandler creates a new crash handler that writes reports to crashDir.
func NewCrashHandler(crashDir string) *CrashHandler {
	os.MkdirAll(crashDir, 0755)
	return &CrashHandler{
		crashDir: crashDir,
	}
}

// HandleCrash processes a crash by saving a report to disk.
func (ch *CrashHandler) HandleCrash(err error, stack string) error {
	report := &CrashReport{
		ID:           generateReportID(),
		Timestamp:    time.Now().Format(time.RFC3339),
		StackTrace:   stack,
		Error:        "",
		Goroutines:   captureGoroutines(),
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
		GoVersion:    runtime.Version(),
	}

	if err != nil {
		report.Error = err.Error()
	}

	reportJSON, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal crash report: %w", err)
	}

	filename := fmt.Sprintf("crash_%s.json", report.ID)
	path := filepath.Join(ch.crashDir, filename)

	if err := os.WriteFile(path, reportJSON, 0644); err != nil {
		return fmt.Errorf("write crash report: %w", err)
	}

	return nil
}

// ListReports returns all crash report filenames in the crash directory.
func (ch *CrashHandler) ListReports() ([]string, error) {
	entries, err := os.ReadDir(ch.crashDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("read crash directory: %w", err)
	}

	var reports []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			reports = append(reports, entry.Name())
		}
	}

	return reports, nil
}

// GetReport loads and returns a crash report by filename or ID.
func (ch *CrashHandler) GetReport(id string) (*CrashReport, error) {
	filename := ""

	// Try direct filename match first
	if strings.HasSuffix(id, ".json") {
		filename = id
	} else {
		// Search for the ID in report names
		entries, err := ch.ListReports()
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			if strings.Contains(entry, id) {
				filename = entry
				break
			}
		}
	}

	if filename == "" {
		return nil, fmt.Errorf("crash report not found: %s", id)
	}

	path := filepath.Join(ch.crashDir, filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read crash report file: %w", err)
	}

	var report CrashReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("unmarshal crash report: %w", err)
	}

	return &report, nil
}

// ClearReports deletes all crash reports from the directory.
func (ch *CrashHandler) ClearReports() error {
	entries, err := os.ReadDir(ch.crashDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read crash directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			path := filepath.Join(ch.crashDir, entry.Name())
			if err := os.Remove(path); err != nil {
				return fmt.Errorf("remove crash report %s: %w", entry.Name(), err)
			}
		}
	}

	return nil
}

// GetReportCount returns the number of crash reports stored.
func (ch *CrashHandler) GetReportCount() (int, error) {
	reports, err := ch.ListReports()
	if err != nil {
		return 0, err
	}
	return len(reports), nil
}

// GetLatestReport returns the most recently created crash report.
func (ch *CrashHandler) GetLatestReport() (*CrashReport, error) {
	reports, err := ch.ListReports()
	if err != nil {
		return nil, err
	}

	if len(reports) == 0 {
		return nil, fmt.Errorf("no crash reports found")
	}

	var latest *CrashReport
	var latestTime time.Time

	for _, name := range reports {
		path := filepath.Join(ch.crashDir, name)
		info, err := os.Stat(path)
		if err != nil {
			continue
		}

		if info.ModTime().After(latestTime) {
			latestTime = info.ModTime()
			report, err := ch.GetReport(name)
			if err != nil {
				continue
			}
			latest = report
		}
	}

	if latest == nil {
		return ch.GetReport(reports[len(reports)-1])
	}

	return latest, nil
}

// generateReportID creates a unique report identifier.
func generateReportID() string {
	return fmt.Sprintf("crash_%d_%d", time.Now().UnixNano(), time.Now().Nanosecond())
}

// captureGoroutines captures the current stack trace of all goroutines.
func captureGoroutines() []string {
	buf := make([]byte, 64*1024)
	n := runtime.Stack(buf, true)
	if n == 0 {
		return []string{}
	}
	stack := string(buf[:n])
	lines := strings.Split(stack, "\n")
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
		}
	}
	return result
}

// GetCrashDirectory returns the directory where crash reports are stored.
func (ch *CrashHandler) GetCrashDirectory() string {
	return ch.crashDir
}

// HasReports returns true if any crash reports exist.
func (ch *CrashHandler) HasReports() bool {
	count, err := ch.GetReportCount()
	return err == nil && count > 0
}

// ExportReport serializes a crash report to JSON bytes.
func (ch *CrashHandler) ExportReport(id string) ([]byte, error) {
	report, err := ch.GetReport(id)
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(report, "", "  ")
}

// WriteReport writes a crash report directly to disk.
func (ch *CrashHandler) WriteReport(report *CrashReport) error {
	if report.ID == "" {
		report.ID = generateReportID()
	}
	if report.Timestamp == "" {
		report.Timestamp = time.Now().Format(time.RFC3339)
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal report: %w", err)
	}

	filename := fmt.Sprintf("crash_%s.json", report.ID)
	path := filepath.Join(ch.crashDir, filename)
	return os.WriteFile(path, data, 0644)
}
