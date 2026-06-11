// GeoWork Go Core - Workspace Repository

package workspace

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	_ "modernc.org/sqlite"
)

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *repository {
	return &repository{db: db}
}

func (r *repository) Init() error {
	query := `
	CREATE TABLE IF NOT EXISTS workspaces (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		path TEXT NOT NULL UNIQUE,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		mode TEXT DEFAULT 'Analysis',
		recent_files TEXT DEFAULT '[]'
	);`
	_, err := r.db.Exec(query)
	return err
}

func (r *repository) Create(ws *Workspace) error {
	ws.CreatedAt = time.Now()
	ws.UpdatedAt = time.Now()
	recentFiles, _ := json.Marshal(ws.RecentFiles)
	_, err := r.db.Exec(
		"INSERT OR REPLACE INTO workspaces (id, name, path, created_at, updated_at, mode, recent_files) VALUES (?, ?, ?, ?, ?, ?, ?)",
		ws.ID, ws.Name, ws.Path, ws.CreatedAt, ws.UpdatedAt, ws.Mode, string(recentFiles),
	)
	return err
}

func (r *repository) Get(id string) (*Workspace, error) {
	ws := &Workspace{}
	var recentFilesStr string
	err := r.db.QueryRow("SELECT id, name, path, created_at, updated_at, mode, recent_files FROM workspaces WHERE id = ?", id).
		Scan(&ws.ID, &ws.Name, &ws.Path, &ws.CreatedAt, &ws.UpdatedAt, &ws.Mode, &recentFilesStr)
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(recentFilesStr), &ws.RecentFiles)
	return ws, nil
}

func (r *repository) List() ([]Workspace, error) {
	rows, err := r.db.Query("SELECT id, name, path, created_at, updated_at, mode FROM workspaces ORDER BY updated_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workspaces []Workspace
	for rows.Next() {
		var ws Workspace
		err := rows.Scan(&ws.ID, &ws.Name, &ws.Path, &ws.CreatedAt, &ws.UpdatedAt, &ws.Mode)
		if err != nil {
			continue
		}
		workspaces = append(workspaces, ws)
	}
	return workspaces, rows.Err()
}

func (r *repository) UpdateRecentFiles(id string, files []string) error {
	recentFiles, _ := json.Marshal(files)
	_, err := r.db.Exec("UPDATE workspaces SET recent_files = ?, updated_at = ? WHERE id = ?",
		string(recentFiles), time.Now(), id)
	return err
}

func buildFileTree(rootPath string) ([]FileTreeNode, error) {
	var nodes []FileTreeNode

	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if len(nodes) == 0 {
			nodes = append(nodes, FileTreeNode{
				Path:  path,
				Name:  info.Name(),
				IsDir: info.IsDir(),
			})
			return nil
		}

		rel, _ := filepath.Rel(rootPath, path)
		parts := filepath.SplitList(rel)

		current := &nodes[0]
		for _, part := range parts[1:] {
			found := false
			for i := range current.Children {
				if current.Children[i].Name == part {
					current = &current.Children[i]
					found = true
					break
				}
			}
			if !found {
				newNode := FileTreeNode{
					Path:  filepath.Join(current.Path, part),
					Name:  part,
					IsDir: info.IsDir(),
				}
				current.Children = append(current.Children, newNode)
				current = &current.Children[len(current.Children)-1]
			}
		}
		return nil
	})

	// Sort: directories first, then alphabetically
	sortNodes(nodes)

	return nodes, err
}

func sortNodes(nodes []FileTreeNode) {
	for i := range nodes {
		sortNodes(nodes[i].Children)
	}
	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].IsDir != nodes[j].IsDir {
			return nodes[i].IsDir
		}
		return nodes[i].Name < nodes[j].Name
	})
}

func (r *repository) GetTree(workspacePath string) ([]FileTreeNode, error) {
	return buildFileTree(workspacePath)
}

func (r *repository) ReadFile(workspacePath, filePath string) ([]byte, error) {
	fullPath := filepath.Join(workspacePath, filePath)
	if !isPathSafe(fullPath, workspacePath) {
		return nil, fmt.Errorf("path traversal detected")
	}
	return os.ReadFile(fullPath)
}

func (r *repository) WriteFile(workspacePath, filePath string, content []byte) error {
	fullPath := filepath.Join(workspacePath, filePath)
	if !isPathSafe(fullPath, workspacePath) {
		return fmt.Errorf("path traversal detected")
	}
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, content, 0644)
}

func (r *repository) ImportFiles(workspacePath string, srcPaths []string) error {
	for _, src := range srcPaths {
		data, err := os.ReadFile(src)
		if err != nil {
			continue
		}
		name := filepath.Base(src)
		dst := filepath.Join(workspacePath, name)
		if err := os.WriteFile(dst, data, 0644); err != nil {
			return err
		}
	}
	return nil
}

func isPathSafe(path, base string) bool {
	rel, err := filepath.Rel(base, path)
	if err != nil {
		return false
	}
	return rel != ".." && !filepath.IsAbs(rel)
}
