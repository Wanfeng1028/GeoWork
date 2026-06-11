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
	return &Service{store: store}
}

// ListPlugins handles GET /api/marketplace/plugins
func (s *Service) ListPlugins(c *gin.Context) {
	items, err := s.store.ListMarketplaceItems()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	result := make([]storage.MarketplaceItem, 0)
	for _, item := range items {
		if item.Type == "plugin" {
			result = append(result, *item)
		}
	}
	if result == nil {
		result = []storage.MarketplaceItem{}
	}
	c.JSON(http.StatusOK, result)
}

// ListSkills handles GET /api/marketplace/skills
func (s *Service) ListSkills(c *gin.Context) {
	items, err := s.store.ListMarketplaceItems()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	result := make([]storage.MarketplaceItem, 0)
	for _, item := range items {
		if item.Type == "skill" {
			result = append(result, *item)
		}
	}
	if result == nil {
		result = []storage.MarketplaceItem{}
	}
	c.JSON(http.StatusOK, result)
}

// ListConnectors handles GET /api/marketplace/connectors
func (s *Service) ListConnectors(c *gin.Context) {
	items, err := s.store.ListMarketplaceItems()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	result := make([]storage.MarketplaceItem, 0)
	for _, item := range items {
		if item.Type == "connector" {
			result = append(result, *item)
		}
	}
	if result == nil {
		result = []storage.MarketplaceItem{}
	}
	c.JSON(http.StatusOK, result)
}

// GetItem handles GET /api/marketplace/items/:id
func (s *Service) GetItem(c *gin.Context) {
	itemID := c.Param("id")

	item, err := s.store.GetMarketplaceItem(itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}
	if item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}

	c.JSON(http.StatusOK, item)
}
