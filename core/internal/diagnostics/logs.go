package diagnostics

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// LogManager manages log files for the application.
type LogManager struct {
	baseDir string
}

// NewLogManager creates a new log manager with the specified base directory.
func NewLogManager(baseDir string) *LogManager {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		// log creation fails -- return a manager that will fail on use
	}
	return &LogManager{
		baseDir: baseDir,
	}
}

// WriteLog appends a log entry to the appropriate module log file.
func (lm *LogManager) WriteLog(module string, level string, message string) error {
	if module == "" {
		return fmt.Errorf("module name is required")
	}
	if level == "" {
		level = "INFO"
	}

	filename := lm.moduleFilename(module)
	entry := fmt.Sprintf("[%s] %s %s\n",
		time.Now().Format("2006-01-02 15:04:05.000"),
		strings.ToUpper(level),
		message,
	)

	f, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString(entry); err != nil {
		return fmt.Errorf("write log entry: %w", err)
	}

	return nil
}

// ReadLogs reads the last N log entries for a module.
func (lm *LogManager) ReadLogs(module string, limit int) ([]map[string]string, error) {
	if module == "" {
		return nil, fmt.Errorf("module name is required")
	}

	if limit <= 0 {
		limit = 100
	}

	filename := lm.moduleFilename(module)

	data, err := os.ReadFile(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return []map[string]string{}, nil
		}
		return nil, fmt.Errorf("read log file: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) == 0 {
		return []map[string]string{}, nil
	}

	start := 0
	if len(lines) > limit {
		start = len(lines) - limit
	}

	results := make([]map[string]string, 0, len(lines)-start)
	for _, line := range lines[start:] {
		entry := parseLogLine(line)
		if entry != nil {
			results = append(results, entry)
		}
	}

	return results, nil
}

// ListLogs returns the names of all module log files in the base directory.
func (lm *LogManager) ListLogs() ([]string, error) {
	entries, err := os.ReadDir(lm.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("read log directory: %w", err)
	}

	var logFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".log") {
			logFiles = append(logFiles, entry.Name())
		}
	}

	return logFiles, nil
}

// ClearLogs deletes all log files in the base directory.
func (lm *LogManager) ClearLogs() error {
	files, err := os.ReadDir(lm.baseDir)
	if err != nil {
		return fmt.Errorf("read log directory: %w", err)
	}

	for _, entry := range files {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".log") {
			path := filepath.Join(lm.baseDir, entry.Name())
			if err := os.Remove(path); err != nil {
				return fmt.Errorf("remove log file %s: %w", path, err)
			}
		}
	}

	return nil
}

// GetLogSize returns the total size in bytes of all log files.
func (lm *LogManager) GetLogSize() (int64, error) {
	entries, err := os.ReadDir(lm.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("read log directory: %w", err)
	}

	var totalSize int64
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".log") {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			totalSize += info.Size()
		}
	}

	return totalSize, nil
}

// GetModuleLogCount returns the number of log entries in a module file.
func (lm *LogManager) GetModuleLogCount(module string) (int, error) {
	filename := lm.moduleFilename(module)

	data, err := os.ReadFile(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("read log file: %w", err)
	}

	if len(data) == 0 {
		return 0, nil
	}

	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	return len(lines), nil
}

// GetLogDirectory returns the base directory path.
func (lm *LogManager) GetLogDirectory() string {
	return lm.baseDir
}

// RotateLogFile rotates a module's log file by renaming it with a timestamp suffix.
func (lm *LogManager) RotateLogFile(module string) error {
	filename := lm.moduleFilename(module)
	archiveName := fmt.Sprintf("%s.%s.log", module, time.Now().Format("20060102-150405"))
	archivePath := filepath.Join(lm.baseDir, archiveName)

	if err := os.Rename(filename, archivePath); err != nil {
		return fmt.Errorf("rotate log file: %w", err)
	}

	return nil
}

// moduleFilename returns the filename for a given module.
func (lm *LogManager) moduleFilename(module string) string {
	safeName := sanitizeFilename(module)
	return filepath.Join(lm.baseDir, safeName+".log")
}

// sanitizeFilename removes characters that are not safe for filenames.
func sanitizeFilename(name string) string {
	var result strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			result.WriteRune(r)
		}
	}
	s := result.String()
	if s == "" {
		return "default"
	}
	return s
}

// parseLogLine parses a single log line into a map with timestamp, level, message.
func parseLogLine(line string) map[string]string {
	if line == "" {
		return nil
	}

	result := make(map[string]string)

	bracketEnd := strings.Index(line, "]")
	if bracketEnd == -1 {
		result["raw"] = line
		return result
	}

	timestamp := strings.TrimPrefix(line, "[")
	result["timestamp"] = timestamp

	rest := strings.TrimSpace(line[bracketEnd+1:])

	spaceIdx := strings.Index(rest, " ")
	if spaceIdx == -1 {
		result["level"] = rest
		return result
	}

	level := rest[:spaceIdx]
	message := strings.TrimSpace(rest[spaceIdx+1:])

	result["level"] = level
	result["message"] = message

	return result
}

// ReadLogFileDirect reads an entire log file and returns its lines.
func (lm *LogManager) ReadLogFileDirect(filename string) ([]string, error) {
	path := filepath.Join(lm.baseDir, filename)

	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open log file %s: %w", path, err)
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	return lines, scanner.Err()
}

// AppendLogFileDirect appends text to a named log file.
func (lm *LogManager) AppendLogFileDirect(filename string, content string) error {
	path := filepath.Join(lm.baseDir, filename)

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open log file %s: %w", path, err)
	}
	defer f.Close()

	if _, err := f.WriteString(content); err != nil {
		return fmt.Errorf("write to log file %s: %w", path, err)
	}

	return nil
}
