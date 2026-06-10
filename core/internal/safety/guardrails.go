// GeoWork Go Core - Safety Guardrails

package safety

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Policy defines the safety constraints for tool execution
type Policy struct {
	// AllowedPaths are the directory prefixes tools may write to
	AllowedPaths []string `json:"allowedPaths"`
	// BlockedPaths are absolute paths that are never accessible
	BlockedPaths []string `json:"blockedPaths"`
	// MaxArtifactSizeBytes is the maximum size for a single artifact
	MaxArtifactSizeBytes int64 `json:"maxArtifactSizeBytes"`
	// AllowedMIMETypes restricts which MIME types can be created
	AllowedMIMETypes []string `json:"allowedMIMETypes"`
	// RequireApprovalForPaths, if set, requires explicit user approval
	// before writing to these paths
	RequireApprovalForPaths []string `json:"requireApprovalForPaths"`
}

// DefaultPolicy returns a policy that restricts all writes to the workspace
// and artifact directories.
func DefaultPolicy(workspaceDir string) *Policy {
	artifactsDir := filepath.Join(filepath.Dir(workspaceDir), "artifacts")
	return &Policy{
		AllowedPaths:           []string{workspaceDir, artifactsDir},
		BlockedPaths:           []string{"/etc", "/root", "C:\\Windows", "C:\\Program Files"},
		MaxArtifactSizeBytes:   512 * 1024 * 1024, // 512 MB
		AllowedMIMETypes:       []string{"image/tiff", "image/png", "application/json", "text/markdown", "text/html", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/x-ipynb+json"},
		RequireApprovalForPaths: []string{},
	}
}

// Guardrail evaluates whether a proposed file write is allowed under the policy
type Guardrail struct {
	policy *Policy
}

func NewGuardrail(policy *Policy) *Guardrail {
	return &Guardrail{policy: policy}
}

// ValidatePath checks if the given path is allowed by the policy
func (g *Guardrail) ValidatePath(path string) error {
	abs, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("failed to resolve path: %w", err)
	}

	// Check blocked paths
	for _, blocked := range g.policy.BlockedPaths {
		if strings.HasPrefix(abs, blocked) {
			return fmt.Errorf("path %s is blocked by safety policy", path)
		}
	}

	// Check allowed paths
	allowed := false
	for _, allowedPath := range g.policy.AllowedPaths {
		if strings.HasPrefix(abs, allowedPath) {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("path %s is outside allowed directories", path)
	}

	// Check approval requirements
	for _, reqPath := range g.policy.RequireApprovalForPaths {
		if strings.HasPrefix(abs, reqPath) {
			return fmt.Errorf("path %s requires explicit user approval", path)
		}
	}

	return nil
}

// ValidateSize checks if the file size is within policy limits
func (g *Guardrail) ValidateSize(size int64) error {
	if g.policy.MaxArtifactSizeBytes > 0 && size > g.policy.MaxArtifactSizeBytes {
		return fmt.Errorf("file size %d exceeds maximum allowed %d bytes", size, g.policy.MaxArtifactSizeBytes)
	}
	return nil
}

// ValidateMimeType checks if the MIME type is allowed
func (g *Guardrail) ValidateMimeType(mimeType string) error {
	if len(g.policy.AllowedMIMETypes) == 0 {
		return nil // no restrictions
	}
	for _, allowed := range g.policy.AllowedMIMETypes {
		if allowed == mimeType || strings.HasPrefix(mimeType, allowed+"/") {
			return nil
		}
	}
	return fmt.Errorf("MIME type %s is not allowed by policy", mimeType)
}

// ValidateWrite performs a full validation before a file write operation
func (g *Guardrail) ValidateWrite(ctx context.Context, path string, size int64, mimeType string) error {
	if err := g.ValidatePath(path); err != nil {
		return err
	}
	if err := g.ValidateSize(size); err != nil {
		return err
	}
	if err := g.ValidateMimeType(mimeType); err != nil {
		return err
	}
	// Check file existence and size on disk
	if info, err := os.Stat(path); err == nil {
		if err := g.ValidateSize(info.Size()); err != nil {
			return err
		}
	}
	return nil
}
