// Package marketplace provides plugin/skill/connector marketplace endpoints.
package marketplace

import (
	"net/http"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	s := &Service{store: store}
	s.seedItems()
	return s
}

// ListPlugins handles GET /api/marketplace/plugins
func (s *Service) ListPlugins(c *gin.Context) {
	s.store.Mu.RLock()
	result := make([]storage.MarketplaceItem, 0)
	for _, item := range s.store.MarketplaceItems {
		if item.Type == "plugin" {
			result = append(result, *item)
		}
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []storage.MarketplaceItem{}
	}
	c.JSON(http.StatusOK, result)
}

// ListSkills handles GET /api/marketplace/skills
func (s *Service) ListSkills(c *gin.Context) {
	s.store.Mu.RLock()
	result := make([]storage.MarketplaceItem, 0)
	for _, item := range s.store.MarketplaceItems {
		if item.Type == "skill" {
			result = append(result, *item)
		}
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []storage.MarketplaceItem{}
	}
	c.JSON(http.StatusOK, result)
}

// ListConnectors handles GET /api/marketplace/connectors
func (s *Service) ListConnectors(c *gin.Context) {
	s.store.Mu.RLock()
	result := make([]storage.MarketplaceItem, 0)
	for _, item := range s.store.MarketplaceItems {
		if item.Type == "connector" {
			result = append(result, *item)
		}
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []storage.MarketplaceItem{}
	}
	c.JSON(http.StatusOK, result)
}

// GetItem handles GET /api/marketplace/items/{id}
func (s *Service) GetItem(c *gin.Context) {
	itemID := c.Param("id")

	s.store.Mu.RLock()
	var item *storage.MarketplaceItem
	for _, it := range s.store.MarketplaceItems {
		if it.ID == itemID {
			item = it
			break
		}
	}
	s.store.Mu.RUnlock()

	if item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}

	c.JSON(http.StatusOK, item)
}

func (s *Service) seedItems() {
	items := []*storage.MarketplaceItem{
		{
			ID:           "plugin-openalex",
			Name:         "OpenAlex Plugin",
			Type:         "plugin",
			Version:      "1.0.0",
			Description:  "Search and import papers from OpenAlex database",
			Author:       "GeoWork Team",
			Permissions:  []string{"network", "file_write"},
			InstallCount: 1250,
			Signature:    "sha256:abc123",
		},
		{
			ID:           "plugin-zotero",
			Name:         "Zotero Plugin",
			Type:         "plugin",
			Version:      "1.2.0",
			Description:  "Import papers and notes from Zotero library",
			Author:       "GeoWork Team",
			Permissions:  []string{"network", "file_read"},
			InstallCount: 890,
			Signature:    "sha256:def456",
		},
		{
			ID:           "skill-ndvi",
			Name:         "NDVI Analysis Skill",
			Type:         "skill",
			Version:      "2.0.0",
			Description:  "Automated NDVI time series analysis with GEE",
			Author:       "GeoWork Team",
			Permissions:  []string{"python", "network", "file_write"},
			InstallCount: 3400,
			Signature:    "sha256:ghi789",
		},
		{
			ID:           "skill-map-export",
			Name:         "Map Export Skill",
			Type:         "skill",
			Version:      "1.1.0",
			Description:  "Generate publication-quality maps with QGIS",
			Author:       "GeoWork Team",
			Permissions:  []string{"shell", "file_write"},
			InstallCount: 2100,
			Signature:    "sha256:jkl012",
		},
		{
			ID:           "connector-feishu",
			Name:         "Feishu Connector",
			Type:         "connector",
			Version:      "1.0.0",
			Description:  "Create tasks from Feishu messages",
			Author:       "GeoWork Team",
			Permissions:  []string{"webhook"},
			InstallCount: 340,
			Signature:    "sha256:mno345",
		},
	}

	s.store.Mu.Lock()
	for _, item := range items {
		s.store.MarketplaceItems = append(s.store.MarketplaceItems, item)
	}
	s.store.Mu.Unlock()
}
