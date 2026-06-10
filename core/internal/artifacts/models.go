// GeoWork Go Core - Artifact Models

package artifacts

import (
	"time"
)

// Type defines the kind of artifact produced by a task
type Type string

const (
	TypeMap       Type = "map"
	TypeCode      Type = "code"
	TypeDocument  Type = "document"
	TypeData      Type = "data"
	TypeImage     Type = "image"
	TypePPT       Type = "ppt"
	TypePDF       Type = "pdf"
	TypeDiff      Type = "diff"
	TypeLog       Type = "log"
	TypeManifest  Type = "manifest"
	TypeNotebook  Type = "notebook"
	TypeSpreadsheet Type = "spreadsheet"
)

// Artifact represents a task output stored in the workspace
type Artifact struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"taskId"`
	WorkspaceID string    `json:"workspaceId"`
	Type        Type      `json:"type"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	MimeType    string    `json:"mimeType"`
	PreviewPath string    `json:"previewPath,omitempty"`
	Size        int64     `json:"size,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// PreviewData holds the content used for artifact preview in the UI
type PreviewData struct {
	ArtifactID string `json:"artifactId"`
	Content    string `json:"content"`
	MimeType   string `json:"mimeType"`
	IsTruncated bool  `json:"isTruncated,omitempty"`
}

// ArtifactListResponse is the response shape for listing artifacts
type ArtifactListResponse struct {
	Total   int         `json:"total"`
	Artifacts []Artifact `json:"artifacts"`
}
