// GeoWork Go Core - Artifact Service

package artifacts

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	db           *sql.DB
	artifactsDir string
}

func NewService(db *sql.DB) *Service {
	return &Service{
		db:           db,
		artifactsDir: getArtifactsDir(),
	}
}

func getArtifactsDir() string {
	// Reuse the same path logic as storage.GetArtifactsDir
	appDir := getAppDataDir()
	return filepath.Join(appDir, "artifacts")
}

func getAppDataDir() string {
	home := os.Getenv("HOME")
	if home == "" {
		home = "."
	}
	return filepath.Join(home, ".geowork")
}

// Init creates the artifacts table if it doesn't exist
func (s *Service) Init() error {
	query := `
	CREATE TABLE IF NOT EXISTS artifacts (
		id TEXT PRIMARY KEY,
		task_id TEXT NOT NULL,
		workspace_id TEXT NOT NULL,
		type TEXT NOT NULL,
		name TEXT NOT NULL,
		path TEXT NOT NULL,
		mime_type TEXT DEFAULT '',
		preview_path TEXT DEFAULT '',
		size INTEGER DEFAULT 0,
		created_at TEXT NOT NULL
	);`
	_, err := s.db.Exec(query)
	return err
}

// Create registers a new artifact in the database.
func (s *Service) Create(ctx context.Context, a *Artifact) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	a.CreatedAt = time.Now().UTC()

	// Ensure artifact directory exists
	if a.Path != "" {
		if err := os.MkdirAll(filepath.Dir(a.Path), 0755); err != nil {
			return fmt.Errorf("failed to create artifact dir: %w", err)
		}
	}

	_, err := s.db.Exec(
		"INSERT OR REPLACE INTO artifacts (id, task_id, workspace_id, type, name, path, mime_type, preview_path, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		a.ID, a.TaskID, a.WorkspaceID, string(a.Type), a.Name, a.Path, a.MimeType, a.PreviewPath, a.Size, a.CreatedAt.Format(time.RFC3339),
	)
	return err
}

// GetByID returns a single artifact by its ID.
func (s *Service) GetByID(ctx context.Context, id string) (*Artifact, error) {
	a := &Artifact{}
	var createdAt string
	err := s.db.QueryRowContext(ctx,
		"SELECT id, task_id, workspace_id, type, name, path, mime_type, preview_path, size, created_at FROM artifacts WHERE id = ?", id).
		Scan(&a.ID, &a.TaskID, &a.WorkspaceID, (*string)(&a.Type), &a.Name, &a.Path, &a.MimeType, &a.PreviewPath, &a.Size, &createdAt)
	if err != nil {
		return nil, err
	}
	a.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return a, nil
}

// ListByTask returns all artifacts for a given task.
func (s *Service) ListByTask(ctx context.Context, taskID string) ([]Artifact, error) {
	return s.listByQuery(ctx, "task_id = ?", taskID)
}

// ListByWorkspace returns all artifacts for a given workspace.
func (s *Service) ListByWorkspace(ctx context.Context, workspaceID string) ([]Artifact, error) {
	if workspaceID == "" {
		return s.listByQuery(ctx, "1=1")
	}
	return s.listByQuery(ctx, "workspace_id = ?", workspaceID)
}

func (s *Service) listByQuery(ctx context.Context, where string, args ...interface{}) ([]Artifact, error) {
	query := fmt.Sprintf(
		"SELECT id, task_id, workspace_id, type, name, path, mime_type, preview_path, size, created_at FROM artifacts WHERE %s ORDER BY created_at DESC",
		where,
	)
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var artifacts []Artifact
	for rows.Next() {
		var a Artifact
		var createdAt string
		if err := rows.Scan(&a.ID, &a.TaskID, &a.WorkspaceID, (*string)(&a.Type), &a.Name, &a.Path, &a.MimeType, &a.PreviewPath, &a.Size, &createdAt); err != nil {
			continue
		}
		a.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		artifacts = append(artifacts, a)
	}
	return artifacts, rows.Err()
}

// Delete removes an artifact record and optionally the file on disk.
func (s *Service) Delete(ctx context.Context, id string) error {
	a, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if a.Path != "" {
		if err := os.Remove(a.Path); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to remove artifact file: %w", err)
		}
	}
	_, err = s.db.Exec("DELETE FROM artifacts WHERE id = ?", id)
	return err
}

// GetPreview returns preview content for a text-based artifact.
func (s *Service) GetPreview(ctx context.Context, id string) (*PreviewData, error) {
	a, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(a.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to read artifact: %w", err)
	}

	const maxPreview = 64 * 1024 // 64KB
	isTruncated := false
	content := string(data)
	if len(content) > maxPreview {
		content = content[:maxPreview]
		isTruncated = true
	}

	return &PreviewData{
		ArtifactID:  a.ID,
		Content:     content,
		MimeType:    a.MimeType,
		IsTruncated: isTruncated,
	}, nil
}
