// Package crash provides crash report upload endpoints.
package crash

import (
	"net/http"
	"time"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// Report handles POST /api/crash/report
func (s *Service) Report(c *gin.Context) {
	// Check opt-in
	if !isOptIn(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "crash reporting disabled by user"})
		return
	}

	var req struct {
		AppVersion  string `json:"app_version" binding:"required"`
		OS          string `json:"os" binding:"required"`
		Message     string `json:"message"`
		Stacktrace  string `json:"stacktrace"`
		HasMinidump bool   `json:"has_minidump"`
		HasLogs     bool   `json:"has_logs"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	report := &storage.CrashReport{
		ID:          generateID(),
		AppVersion:  req.AppVersion,
		OS:          req.OS,
		Message:     req.Message,
		Stacktrace:  req.Stacktrace,
		HasMinidump: req.HasMinidump,
		HasLogs:     req.HasLogs,
		Timestamp:   time.Now(),
	}

	s.store.Mu.Lock()
	s.store.CrashReports = append(s.store.CrashReports, report)
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "crash report received"})
}

func isOptIn(c *gin.Context) bool {
	return c.GetHeader("X-Crash-Opt-In") == "true"
}

func generateID() string {
	return "crash_" + time.Now().Format("20060102150405")
}
