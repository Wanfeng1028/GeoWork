// Package crash provides crash report upload endpoints.
package crash

import (
	"net/http"

	"server/internal/apierrors"
	"server/internal/idgen"
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
	if !isOptIn(c) {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "crash reporting disabled by user")
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
		apierrors.Respond(c, apierrors.ErrBadRequest)
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
	}

	if err := s.store.AppendCrashReport(report); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to save crash report")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "crash report received"})
}

func isOptIn(c *gin.Context) bool {
	return c.GetHeader("X-Crash-Opt-In") == "true"
}

func generateID() string {
	// Random hex, not a timestamp (doc/25 S1): second-resolution timestamps
	// collide under concurrent reports and overwrite each other.
	return idgen.NewPrefixed("crash")
}
