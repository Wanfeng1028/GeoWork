// GeoWork Go Core - Filesystem Scope Policy

package sandbox

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"go.uber.org/zap"
)

// FilesystemScope defines allowed and blocked filesystem paths.
type FilesystemScope struct {
	// AllowedPaths are prefix paths the sandbox can access.
	AllowedPaths []string `json:"allowedPaths"`
	// BlockedPaths are prefix paths the sandbox cannot access.
	BlockedPaths []string `json:"blockedPaths"`
	// MaxFileSizeBytes limits individual file sizes (default 512MB).
	MaxFileSizeBytes int64 `json:"maxFileSizeBytes"`
	// AllowedFileExtensions restricts which file types can be written.
	AllowedFileExtensions []string `json:"allowedFileExtensions,omitempty"`
	// DenySymlinks prevents following symbolic links.
	DenySymlinks bool `json:"denySymlinks"`
}

// DefaultFilesystemScope returns a scope restricted to the workspace directory.
func DefaultFilesystemScope(workspaceRoot string) *FilesystemScope {
	return &FilesystemScope{
		AllowedPaths: []string{
			filepath.Clean(workspaceRoot),
			filepath.Join(workspaceRoot, "artifacts"),
			filepath.Join(workspaceRoot, "cache"),
		},
		BlockedPaths: []string{
			"/etc",
			"/root",
			"/var",
			"/usr",
			"/bin",
			"/sbin",
			"/dev",
			"C:\\Windows",
			"C:\\Program Files",
			"C:\\ProgramData",
			"C:\\Users",
		},
		MaxFileSizeBytes:      512 * 1024 * 1024, // 512MB
		AllowedFileExtensions: []string{".py", ".sh", ".geojson", ".shp", ".tiff", ".tif", ".png", ".jpg", ".jpeg", ".csv", ".json", ".md", ".txt", ".xml", ".html", ".pdf", ".docx", ".pptx", ".xlsx"},
		DenySymlinks:          true,
	}
}

// StrictFilesystemScope returns a scope that only allows the exact workspace root.
func StrictFilesystemScope(workspaceRoot string) *FilesystemScope {
	return &FilesystemScope{
		AllowedPaths: []string{
			filepath.Clean(workspaceRoot),
		},
		BlockedPaths: []string{
			"/etc", "/root", "/var", "/usr", "/bin",
			"C:\\Windows", "C:\\Program Files", "C:\\ProgramData", "C:\\Users",
		},
		MaxFileSizeBytes:      100 * 1024 * 1024, // 100MB
		AllowedFileExtensions: []string{".py", ".sh", ".csv", ".json", ".txt", ".md"},
		DenySymlinks:          true,
	}
}

// PermissiveFilesystemScope returns a scope that allows more paths.
func PermissiveFilesystemScope(workspaceRoot string) *FilesystemScope {
	return &FilesystemScope{
		AllowedPaths: []string{
			filepath.Clean(workspaceRoot),
			filepath.Join(workspaceRoot, "artifacts"),
			filepath.Join(workspaceRoot, "cache"),
			filepath.Join(workspaceRoot, "downloads"),
			"/tmp",
		},
		BlockedPaths: []string{
			"/etc", "/root", "/var", "/bin",
			"C:\\Windows", "C:\\Program Files",
		},
		MaxFileSizeBytes:      1024 * 1024 * 1024, // 1GB
		AllowedFileExtensions: []string{},         // no restriction
		DenySymlinks:          false,
	}
}

// Validator enforces filesystem scope rules.
type Validator struct {
	scope *FilesystemScope
	log   *zap.Logger
	mu    sync.RWMutex
}

// NewFilesystemValidator creates a new validator with the given scope.
func NewFilesystemValidator(scope *FilesystemScope, log *zap.Logger) *Validator {
	return &Validator{scope: scope, log: log}
}

// UpdateScope atomically replaces the scope.
func (v *Validator) UpdateScope(scope *FilesystemScope) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.scope = scope
}

// GetScope returns a copy of the current scope.
func (v *Validator) GetScope() *FilesystemScope {
	v.mu.RLock()
	defer v.mu.RUnlock()
	cp := *v.scope
	return &cp
}

// ValidatePath checks if a path is allowed under the current scope.
func (v *Validator) ValidatePath(path string) error {
	v.mu.RLock()
	defer v.mu.RUnlock()

	// Resolve the path
	cleanPath := filepath.Clean(path)

	// Check symlinks
	if v.scope.DenySymlinks {
		if info, symlinkErr := filepath.EvalSymlinks(cleanPath); symlinkErr == nil {
			if dirInfo, dirErr := filepath.EvalSymlinks(filepath.Dir(info)); dirErr == nil {
				if resolvedInfo, infoErr := filepath.EvalSymlinks(dirInfo); infoErr == nil {
					if filepath.Clean(resolvedInfo) != filepath.Clean(cleanPath) {
						v.log.Warn("symlink detected and denied", zap.String("path", cleanPath))
						return &ErrPathBlocked{Reason: "symlinks are disabled"}
					}
				}
			}
		}
	}

	// Check allowed paths (must be under at least one allowed prefix)
	allowed := false
	for _, prefix := range v.scope.AllowedPaths {
		if strings.HasPrefix(cleanPath, filepath.Clean(prefix)) {
			allowed = true
			break
		}
	}
	if !allowed {
		return &ErrPathBlocked{
			Reason:  "path is not within any allowed directory",
			Path:    cleanPath,
			Message: "Path " + cleanPath + " is outside the workspace scope",
		}
	}

	// Check blocked paths (even if in allowed, blocked takes precedence)
	for _, blocked := range v.scope.BlockedPaths {
		if strings.HasPrefix(cleanPath, filepath.Clean(blocked)) {
			return &ErrPathBlocked{
				Reason:  "path is in a blocked directory",
				Path:    cleanPath,
				Message: "Access to " + cleanPath + " is blocked by sandbox policy",
			}
		}
	}

	return nil
}

// ValidateFileSize checks if a file size is within limits.
func (v *Validator) ValidateFileSize(size int64) error {
	if size > v.scope.MaxFileSizeBytes {
		return &ErrFileSizeExceeded{
			Size:    size,
			Limit:   v.scope.MaxFileSizeBytes,
			Message: "File size " + formatBytes(size) + " exceeds limit of " + formatBytes(v.scope.MaxFileSizeBytes),
		}
	}
	return nil
}

// ValidateFileExtension checks if the file extension is allowed.
func (v *Validator) ValidateFileExtension(filename string) error {
	if len(v.scope.AllowedFileExtensions) == 0 {
		return nil // no restriction
	}
	ext := strings.ToLower(filepath.Ext(filename))
	for _, allowed := range v.scope.AllowedFileExtensions {
		if ext == allowed {
			return nil
		}
	}
	return &ErrExtensionBlocked{
		Extension: ext,
		Message:   "File extension " + ext + " is not allowed by sandbox policy",
	}
}

// ValidateWrite performs a full write validation (path + size + extension).
func (v *Validator) ValidateWrite(path string, size int64) error {
	if err := v.ValidatePath(path); err != nil {
		return err
	}
	if err := v.ValidateFileSize(size); err != nil {
		return err
	}
	if err := v.ValidateFileExtension(path); err != nil {
		return err
	}
	return nil
}

// ErrPathBlocked is returned when a path is not allowed.
type ErrPathBlocked struct {
	Reason  string
	Path    string
	Message string
}

func (e *ErrPathBlocked) Error() string { return e.Message }

// ErrFileSizeExceeded is returned when a file exceeds the size limit.
type ErrFileSizeExceeded struct {
	Size    int64
	Limit   int64
	Message string
}

func (e *ErrFileSizeExceeded) Error() string { return e.Message }

// ErrExtensionBlocked is returned when a file extension is not allowed.
type ErrExtensionBlocked struct {
	Extension string
	Message   string
}

func (e *ErrExtensionBlocked) Error() string { return e.Message }

// formatBytes formats bytes into a human-readable string.
func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
