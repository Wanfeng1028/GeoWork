// Package accounts provides user profile and subscription management.
package accounts

import (
	"net/http"
	"net/url"
	"time"

	"server/internal/apierrors"
	"server/internal/servercontext"
	"server/internal/storage"
	"server/internal/validation"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, user)
}

// UpdateProfile handles PATCH /api/account/profile
func (s *Service) UpdateProfile(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request body")
		return
	}

	// Input validation: Name 1-100 characters using centralized validation
	if req.Name != "" {
		if err := validation.ValidateName(req.Name, 100); err != nil {
			apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, err.Error())
			return
		}
		user.Name = req.Name
	}

	// Input validation: AvatarURL must be a valid URL
	if req.AvatarURL != "" {
		if !isValidURL(req.AvatarURL) {
			apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "avatar_url must be a valid URL")
			return
		}
		user.AvatarURL = req.AvatarURL
	}

	if err := s.store.UpdateUser(user); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetSubscription handles GET /api/account/subscription
func (s *Service) GetSubscription(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	billing, err := s.store.GetBillingData(user.ID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
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

// DeleteAccount handles DELETE /api/account/me
// Soft-deletes the account. The account can be recovered within 30 days.
func (s *Service) DeleteAccount(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	// Check if already deleted
	if user.DeletedAt != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "account is already deleted")
		return
	}

	if err := s.store.SoftDeleteUser(user.ID); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           "account marked for deletion",
		"deleted_at":        time.Now(),
		"recoverable_until": time.Now().Add(30 * 24 * time.Hour),
	})
}

// ChangePasswordRequest represents a password change request.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// ChangePassword handles PUT /api/account/me/password
func (s *Service) ChangePassword(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "old_password and new_password are required")
		return
	}

	// Verify old password using bcrypt
	if user.PasswordHash == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "account has no password set")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "old password is incorrect")
		return
	}

	// Validate new password strength
	if err := validation.ValidatePassword(req.NewPassword); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, err.Error())
		return
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	if err := s.store.UpdateUserPassword(user.ID, string(newHash)); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password changed successfully"})
}

// GetAccountStats handles GET /api/account/me/stats
func (s *Service) GetAccountStats(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	usageSummary, lastActiveTs, err := s.store.GetUserStats(user.ID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	var lastActive *time.Time
	if lastActiveTs > 0 {
		t := time.Unix(lastActiveTs, 0)
		lastActive = &t
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":       user.ID,
		"created_at":    user.CreatedAt,
		"updated_at":    user.UpdatedAt,
		"last_active":   lastActive,
		"plan":          user.Plan,
		"usage_summary": usageSummary,
	})
}

// isValidURL checks if a string is a valid URL.
func isValidURL(rawURL string) bool {
	u, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
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
	return features
}
