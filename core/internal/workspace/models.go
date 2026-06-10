// GeoWork Go Core - Workspace Models

package workspace

import "time"

// Workspace represents a local project workspace
type Workspace struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Mode        string    `json:"mode"`
	Files       int       `json:"files"`
	RecentFiles []string  `json:"recent_files"`
}

// WorkspaceFile represents a file within a workspace
type WorkspaceFile struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	IsDir    bool   `json:"is_dir"`
	Modified time.Time `json:"modified"`
}

// FileTreeNode represents a node in the file tree
type FileTreeNode struct {
	Path     string          `json:"path"`
	Name     string          `json:"name"`
	IsDir    bool            `json:"is_dir"`
	Children []FileTreeNode  `json:"children,omitempty"`
}
