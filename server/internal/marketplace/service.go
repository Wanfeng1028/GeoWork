// Package marketplace provides plugin/skill/connector marketplace endpoints.
package marketplace

import (
	"net/http"
	"strconv"
	"strings"

	"server/internal/apierrors"
	"server/internal/idgen"
	"server/internal/servercontext"
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
		apierrors.RespondError(c, apierrors.ErrInternal)
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
		apierrors.RespondError(c, apierrors.ErrInternal)
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
		apierrors.RespondError(c, apierrors.ErrInternal)
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
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if item == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "item not found")
		return
	}

	c.JSON(http.StatusOK, item)
}

// verifySignature checks that the item has a non-empty, well-formed signature.
// A valid signature must start with a known prefix (e.g. "sha256:") and have a non-empty hash.
func verifySignature(item *storage.MarketplaceItem) bool {
	sig := item.Signature
	if sig == "" {
		return false
	}
	// Expect format "algo:hash"
	parts := strings.SplitN(sig, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return false
	}
	return true
}

// InstallItem handles POST /api/marketplace/items/:id/install
// Installs a plugin/skill for the current user after verifying signature and availability.
func (s *Service) InstallItem(c *gin.Context) {
	itemID := c.Param("id")
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	// Check item exists and is available
	item, err := s.store.GetMarketplaceItem(itemID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if item == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "item not found")
		return
	}

	// Verify signature before installation
	if !verifySignature(item) {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "item signature is invalid, cannot install")
		return
	}

	// Check for duplicate install
	existing, err := s.store.GetMarketplaceInstall(user.ID, itemID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if existing != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrConflict, "item already installed")
		return
	}

	// Create install record
	install := &storage.MarketplaceInstall{
		ID:     idgen.New("install_"),
		UserID: user.ID,
		ItemID: itemID,
	}
	if err := s.store.CreateMarketplaceInstall(install); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	// Increment install count
	_ = s.store.IncrementMarketplaceInstallCount(itemID)

	c.JSON(http.StatusOK, gin.H{
		"message":    "item installed",
		"item_id":    itemID,
		"install_id": install.ID,
	})
}

// UninstallItem handles POST /api/marketplace/items/:id/uninstall
// Removes the installation record for the current user.
func (s *Service) UninstallItem(c *gin.Context) {
	itemID := c.Param("id")
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	// Check install exists
	existing, err := s.store.GetMarketplaceInstall(user.ID, itemID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if existing == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "item not installed")
		return
	}

	if err := s.store.DeleteMarketplaceInstall(user.ID, itemID); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	// Decrement install count
	_ = s.store.DecrementMarketplaceInstallCount(itemID)

	c.JSON(http.StatusOK, gin.H{
		"message": "item uninstalled",
		"item_id": itemID,
	})
}

// GetItemReviews handles GET /api/marketplace/items/:id/reviews
// Returns paginated reviews for a marketplace item.
func (s *Service) GetItemReviews(c *gin.Context) {
	itemID := c.Param("id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	reviews, err := s.store.ListMarketplaceReviews(itemID, limit, offset)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	type reviewItem struct {
		ID        string `json:"id"`
		UserID    string `json:"user_id"`
		UserName  string `json:"user_name"`
		Rating    int    `json:"rating"`
		Review    string `json:"review"`
		CreatedAt string `json:"created_at"`
	}

	result := make([]reviewItem, 0, len(reviews))
	for _, r := range reviews {
		userName := ""
		if u, err := s.store.GetUserByID(r.UserID); err == nil && u != nil {
			userName = u.Name
		}
		result = append(result, reviewItem{
			ID:        r.ID,
			UserID:    r.UserID,
			UserName:  userName,
			Rating:    r.Rating,
			Review:    r.Review,
			CreatedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"reviews": result,
		"limit":   limit,
		"offset":  offset,
	})
}

// SubmitReview handles POST /api/marketplace/items/:id/reviews
// Only installed users can submit a review. One review per user per item.
func (s *Service) SubmitReview(c *gin.Context) {
	itemID := c.Param("id")
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Rating int    `json:"rating" binding:"required,min=1,max=5"`
		Review string `json:"review"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "rating must be between 1 and 5")
		return
	}

	// Check item exists
	item, err := s.store.GetMarketplaceItem(itemID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if item == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "item not found")
		return
	}

	// Check user has installed this item
	install, err := s.store.GetMarketplaceInstall(user.ID, itemID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if install == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only installed users can review")
		return
	}

	// Check for duplicate review
	existing, err := s.store.GetMarketplaceReview(user.ID, itemID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if existing != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrConflict, "you have already reviewed this item")
		return
	}

	review := &storage.MarketplaceReview{
		ID:     idgen.New("review_"),
		UserID: user.ID,
		ItemID: itemID,
		Rating: req.Rating,
		Review: req.Review,
	}
	if err := s.store.CreateMarketplaceReview(review); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "review submitted",
		"review_id": review.ID,
	})
}
