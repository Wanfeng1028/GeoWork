package file

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

// FileNode represents a file or folder in the project tree.
type FileNode struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Type       string     `json:"type"` // "file" | "folder"
	ParentID   string     `json:"parentId"`
	ProjectID  string     `json:"projectId"`
	Size       int64      `json:"size,omitempty"`
	MimeType   string     `json:"mimeType,omitempty"`
	ModifiedAt time.Time  `json:"modifiedAt"`
	Path       string     `json:"path,omitempty"`
	Children   []FileNode `json:"children,omitempty"`
}

// FileManager handles file and folder CRUD operations backed by SQLite.
type FileManager struct {
	db      *sql.DB
	logger  *zap.Logger
	watcher *fsnotify.Watcher
}

// NewFileManager creates a new FileManager with an in-memory SQLite database.
func NewFileManager(logger *zap.Logger) (*FileManager, error) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := initSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("create fsnotify watcher: %w", err)
	}

	return &FileManager{
		db:      db,
		logger:  logger,
		watcher: watcher,
	}, nil
}

// Close releases all resources held by the FileManager.
func (m *FileManager) Close() error {
	if m.watcher != nil {
		m.watcher.Close()
	}
	if m.db != nil {
		return m.db.Close()
	}
	return nil
}

// initSchema creates the required tables.
func initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS file_nodes (
		id         TEXT PRIMARY KEY,
		name       TEXT NOT NULL,
		type       TEXT NOT NULL CHECK(type IN ('file', 'folder')),
		parent_id  TEXT,
		project_id TEXT NOT NULL,
		size       INTEGER DEFAULT 0,
		mime_type  TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (parent_id) REFERENCES file_nodes(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_file_nodes_project ON file_nodes(project_id, parent_id);
	CREATE INDEX IF NOT EXISTS idx_file_nodes_parent ON file_nodes(parent_id);
	`
	_, err := db.Exec(schema)
	return err
}

// GetTree returns the full file tree for a project.
func (m *FileManager) GetTree(projectID string) ([]FileNode, error) {
	return m.buildTree(projectID, "")
}

// buildTree recursively builds the tree starting from a parent node.
func (m *FileManager) buildTree(projectID, parentID string) ([]FileNode, error) {
	rows, err := m.db.Query(
		`SELECT id, name, type, parent_id, project_id, size, mime_type, updated_at FROM file_nodes
		 WHERE project_id = ? AND parent_id = ? ORDER BY type DESC, name ASC`,
		projectID, parentID,
	)
	if err != nil {
		return nil, fmt.Errorf("query tree: %w", err)
	}
	defer rows.Close()

	var nodes []FileNode
	for rows.Next() {
		var node FileNode
		if err := rows.Scan(&node.ID, &node.Name, &node.Type, &node.ParentID, &node.ProjectID, &node.Size, &node.MimeType, &node.ModifiedAt); err != nil {
			return nil, fmt.Errorf("scan node: %w", err)
		}
		if node.Type == "folder" {
			children, err := m.buildTree(projectID, node.ID)
			if err != nil {
				return nil, err
			}
			node.Children = children
		}
		nodes = append(nodes, node)
	}
	return nodes, rows.Err()
}

// CreateFolder creates a new folder node.
func (m *FileManager) CreateFolder(projectID, parentID, name string) (*FileNode, error) {
	id := fmt.Sprintf("folder_%s_%d", shortID(), time.Now().UnixNano())
	node := FileNode{
		ID:         id,
		Name:       name,
		Type:       "folder",
		ParentID:   parentID,
		ProjectID:  projectID,
		ModifiedAt: time.Now(),
	}

	result, err := m.db.Exec(
		`INSERT INTO file_nodes (id, name, type, parent_id, project_id, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		node.ID, node.Name, node.Type, node.ParentID, node.ProjectID, node.ModifiedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create folder: %w", err)
	}
	_ = result

	m.logger.Info("folder created", zap.String("id", id), zap.String("project", projectID))
	return &node, nil
}

// UploadFile creates a file node and writes the file content to disk.
func (m *FileManager) UploadFile(projectID, parentID, dir, name string, reader io.Reader) (*FileNode, error) {
	id := fmt.Sprintf("file_%s_%d", shortID(), time.Now().UnixNano())

	// Determine MIME type from extension
	mimeType := detectMimeType(name)

	// Ensure target directory exists
	targetDir := filepath.Join(dir, projectID, parentID)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return nil, fmt.Errorf("create upload dir: %w", err)
	}

	targetPath := filepath.Join(targetDir, name)
	f, err := os.Create(targetPath)
	if err != nil {
		return nil, fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	size, err := io.Copy(f, reader)
	if err != nil {
		return nil, fmt.Errorf("write file: %w", err)
	}

	node := FileNode{
		ID:         id,
		Name:       name,
		Type:       "file",
		ParentID:   parentID,
		ProjectID:  projectID,
		Size:       size,
		MimeType:   mimeType,
		ModifiedAt: time.Now(),
		Path:       targetPath,
	}

	_, err = m.db.Exec(
		`INSERT INTO file_nodes (id, name, type, parent_id, project_id, size, mime_type, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		node.ID, node.Name, node.Type, node.ParentID, node.ProjectID, node.Size, node.MimeType, node.ModifiedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert file node: %w", err)
	}

	m.logger.Info("file uploaded", zap.String("id", id), zap.String("project", projectID), zap.Int64("size", size))
	return &node, nil
}

// DeleteNode removes a file or folder (and all children) from the tree.
func (m *FileManager) DeleteNode(projectID, nodeID string) error {
	var nodeType string
	var path string
	err := m.db.QueryRow(`SELECT type, COALESCE(path, '') FROM file_nodes WHERE id = ?`, nodeID).Scan(&nodeType, &path)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("node not found: %s", nodeID)
		}
		return fmt.Errorf("query node: %w", err)
	}

	// Delete from DB (cascade handles children)
	_, err = m.db.Exec(`DELETE FROM file_nodes WHERE id = ? OR parent_id = ?`, nodeID, nodeID)
	if err != nil {
		return fmt.Errorf("delete node: %w", err)
	}

	// Delete physical file if it exists
	if nodeType == "file" && path != "" {
		_ = os.Remove(path)
	} else if nodeType == "folder" && path != "" {
		_ = os.RemoveAll(path)
	}

	m.logger.Info("node deleted", zap.String("id", nodeID), zap.String("project", projectID))
	return nil
}

// RenameNode updates the name of a file or folder.
func (m *FileManager) RenameNode(projectID, nodeID, newName string) error {
	var nodeType string
	err := m.db.QueryRow(`SELECT type FROM file_nodes WHERE id = ? AND project_id = ?`, nodeID, projectID).Scan(&nodeType)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("node not found: %s", nodeID)
		}
		return fmt.Errorf("query node: %w", err)
	}

	result, err := m.db.Exec(
		`UPDATE file_nodes SET name = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
		newName, time.Now(), nodeID, projectID,
	)
	if err != nil {
		return fmt.Errorf("rename node: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("node not found: %s", nodeID)
	}

	m.logger.Info("node renamed", zap.String("id", nodeID), zap.String("newName", newName))
	return nil
}

// WatchDirectory starts watching a directory for file changes.
func (m *FileManager) WatchDirectory(dir string) error {
	return m.watcher.Add(dir)
}

// Events returns the fsnotify event channel.
func (m *FileManager) Events() <-chan fsnotify.Event {
	return m.watcher.Events
}

// Errors returns the fsnotify error channel.
func (m *FileManager) Errors() <-chan error {
	return m.watcher.Errors
}

// detectMimeType returns a MIME type based on file extension.
func detectMimeType(filename string) string {
	ext := filepath.Ext(filename)
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".json":
		return "application/json"
	case ".geojson":
		return "application/geo+json"
	case ".txt", ".md":
		return "text/plain"
	case ".py":
		return "text/x-python"
	case ".js", ".jsx":
		return "text/javascript"
	case ".ts", ".tsx":
		return "text/typescript"
	case ".html":
		return "text/html"
	case ".css":
		return "text/css"
	case ".xml":
		return "application/xml"
	case ".csv":
		return "text/csv"
	case ".tif", ".tiff":
		return "image/tiff"
	case ".shp":
		return "application/x-shapefile"
	case ".shx":
		return "application/x-shapefile-index"
	case ".dbf":
		return "application/x-dbf"
	case ".prj":
		return "text/plain"
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	default:
		return "application/octet-stream"
	}
}

// shortID generates a short random ID suffix.
func shortID() string {
	return fmt.Sprintf("%x", time.Now().UnixNano()%0xFFFFFF)
}
