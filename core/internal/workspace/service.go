// GeoWork Go Core - Workspace Service

package workspace

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository
}

func NewService(repo *repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateWorkspace(name, path string, mode string) (*Workspace, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("invalid path: %w", err)
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		if err := os.MkdirAll(absPath, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory: %w", err)
		}
	}

	ws := &Workspace{
		ID:   uuid.New().String(),
		Name: name,
		Path: absPath,
		Mode: mode,
	}

	if err := s.repo.Create(ws); err != nil {
		return nil, fmt.Errorf("failed to save workspace: %w", err)
	}

	return ws, nil
}

func (s *Service) ListWorkspaces() ([]Workspace, error) {
	return s.repo.List()
}

func (s *Service) GetWorkspace(id string) (*Workspace, error) {
	return s.repo.Get(id)
}

func (s *Service) GetTree(workspaceID string) ([]FileTreeNode, error) {
	ws, err := s.repo.Get(workspaceID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTree(ws.Path)
}

func (s *Service) ReadFile(workspaceID, filePath string) ([]byte, error) {
	ws, err := s.repo.Get(workspaceID)
	if err != nil {
		return nil, err
	}
	return s.repo.ReadFile(ws.Path, filePath)
}

func (s *Service) WriteFile(workspaceID, filePath string, content []byte) error {
	ws, err := s.repo.Get(workspaceID)
	if err != nil {
		return err
	}
	return s.repo.WriteFile(ws.Path, filePath, content)
}

func (s *Service) ImportFiles(workspaceID string, srcPaths []string) error {
	ws, err := s.repo.Get(workspaceID)
	if err != nil {
		return err
	}
	return s.repo.ImportFiles(ws.Path, srcPaths)
}
