// Package accounts provides user profile and subscription management.
package accounts

import (
	"net/http"
	"time"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// UpdateProfileRequest represents a profile update request.
type UpdateProfileRequest struct {
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// GetProfile handles GET /api/account/profile
func (s *Service) GetProfile(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// UpdateProfile handles PATCH /api/account/profile
func (s *Service) UpdateProfile(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.AvatarURL != "" {
		user.AvatarURL = req.AvatarURL
	}

	if err := s.store.UpdateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetSubscription handles GET /api/account/subscription
func (s *Service) GetSubscription(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	billing, err := s.store.GetBillingData(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	credits := 0.0
	plan := user.Plan
	if billing != nil {
		credits = billing.Credits
		plan = billing.Plan
	}

	c.JSON(http.StatusOK, gin.H{
		"plan":     plan,
		"credits":  credits,
		"features": getPlanFeatures(plan),
	})
}

func getUserFromContext(c *gin.Context) *storage.User {
	val, ok := c.Get("user")
	if !ok {
		return nil
	}
	u, ok := val.(*storage.User)
	if !ok {
		return nil
	}
	return u
}

func getPlanFeatures(plan string) map[string]bool {
	features := map[string]bool{
		"local_mode":       true,
		"cloud_sync":       false,
		"team_collab":      false,
		"priority_support": false,
	}
	switch plan {
	case "pro":
		features["cloud_sync"] = true
		features["priority_support"] = true
	case "team":
		features["cloud_sync"] = true
		features["team_collab"] = true
		features["priority_support"] = true
	}
	_ = time.Now // avoid unused import if file gets trimmed
	return features
}
