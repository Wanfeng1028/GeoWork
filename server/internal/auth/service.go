// Package auth provides login, logout, refresh token, and user info endpoints.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
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

// LoginRequest represents a login request body.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents a login response.
type LoginResponse struct {
	User         *storage.User `json:"user"`
	AccessToken  string        `json:"access_token"`
	RefreshToken string        `json:"refresh_token"`
}

// isAutoRegisterEnabled checks the GEOWORK_AUTO_REGISTER_ENABLED environment variable.
// Default is false (disabled).
func isAutoRegisterEnabled() bool {
	val := os.Getenv("GEOWORK_AUTO_REGISTER_ENABLED")
	if val == "" {
		return false
	}
	enabled, err := strconv.ParseBool(val)
	if err != nil {
		return false
	}
	return enabled
}

// Login handles POST /api/auth/login
func (s *Service) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	// Validate email format using centralized validation
	if err := validation.ValidateEmail(req.Email); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, err.Error())
		return
	}

	user, err := s.store.GetUserByEmail(req.Email)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	if user == nil {
		// Auto-register new users (gated by environment variable)
		if !isAutoRegisterEnabled() {
			apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "invalid credentials")
			return
		}

		// Validate password strength for new registrations
		if err := validation.ValidatePassword(req.Password); err != nil {
			apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, err.Error())
			return
		}

		hashedPassword, err := hashPassword(req.Password)
		if err != nil {
			apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to hash password")
			return
		}

		user = &storage.User{
			ID:           generateID(),
			Email:        req.Email,
			Name:         splitEmail(req.Email),
			Plan:         "free",
			PasswordHash: hashedPassword,
		}
		if err := s.store.CreateUser(user); err != nil {
			apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to create account")
			return
		}
	} else {
		// Dual-mode password verification: bcrypt first, then legacy SHA-256
		if !verifyPassword(user.PasswordHash, req.Password) {
			apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "invalid credentials")
			return
		}

		// Transparent migration: if still using legacy SHA-256, upgrade to bcrypt
		if isLegacySHA256(user.PasswordHash) {
			newHash, err := hashPassword(req.Password)
			if err == nil {
				user.PasswordHash = newHash
				_ = s.store.UpdateUser(user) // best-effort migration
			}
		}
	}

	accessToken := generateToken(user.ID, "access")
	refreshToken := generateToken(user.ID, "refresh")

	now := time.Now()
	accessTokenObj := &storage.Token{
		ID:        accessToken,
		UserID:    user.ID,
		Type:      "access",
		ExpiresAt: now.Add(24 * time.Hour),
		CreatedAt: now,
	}
	refreshTokenObj := &storage.Token{
		ID:        refreshToken,
		UserID:    user.ID,
		Type:      "refresh",
		ExpiresAt: now.Add(7 * 24 * time.Hour),
		CreatedAt: now,
	}

	if err := s.store.CreateToken(accessTokenObj); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to create session")
		return
	}
	if err := s.store.CreateToken(refreshTokenObj); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to create session")
		return
	}

	// Return user without password hash
	c.JSON(http.StatusOK, LoginResponse{
		User: &storage.User{
			ID:        user.ID,
			Email:     user.Email,
			Name:      user.Name,
			AvatarURL: user.AvatarURL,
			Plan:      user.Plan,
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
		},
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
}

// Logout handles POST /api/auth/logout
func (s *Service) Logout(c *gin.Context) {
	token := extractToken(c)
	if token == "" {
		apierrors.Respond(c, apierrors.ErrUnauthorized)
		return
	}

	if err := s.store.DeleteToken(token); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// Refresh handles POST /api/auth/refresh
func (s *Service) Refresh(c *gin.Context) {
	refreshToken := extractToken(c)
	if refreshToken == "" {
		apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "missing refresh token")
		return
	}

	tok, err := s.store.GetToken(refreshToken)
	if err != nil || tok == nil || tok.Type != "refresh" || time.Now().After(tok.ExpiresAt) {
		apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "invalid refresh token")
		return
	}

	// Verify user still exists
	user, err := s.store.GetUserByID(tok.UserID)
	if err != nil || user == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "user not found")
		return
	}

	// Invalidate old tokens for this user
	s.store.InvalidateUserTokens(tok.UserID)

	// Generate new access token
	newAccessToken := generateToken(tok.UserID, "access")
	newToken := &storage.Token{
		ID:        newAccessToken,
		UserID:    tok.UserID,
		Type:      "access",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}
	if err := s.store.CreateToken(newToken); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": newAccessToken,
	})
}

// Me handles GET /api/auth/me
func (s *Service) Me(c *gin.Context) {
	token := extractToken(c)
	if token == "" {
		apierrors.Respond(c, apierrors.ErrUnauthorized)
		return
	}

	tok, err := s.store.GetToken(token)
	if err != nil || tok == nil || time.Now().After(tok.ExpiresAt) {
		apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "token expired")
		return
	}

	user, err := s.store.GetUserByID(tok.UserID)
	if err != nil || user == nil {
		apierrors.Respond(c, apierrors.ErrNotFound)
		return
	}

	c.JSON(http.StatusOK, &storage.User{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		AvatarURL: user.AvatarURL,
		Plan:      user.Plan,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	})
}

// Middleware returns a Gin middleware that validates tokens.
func (s *Service) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			apierrors.Respond(c, apierrors.ErrUnauthorized)
			c.Abort()
			return
		}

		tok, err := s.store.GetToken(token)
		if err != nil || tok == nil || time.Now().After(tok.ExpiresAt) {
			apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		user, err := s.store.GetUserByID(tok.UserID)
		if err != nil || user == nil {
			apierrors.RespondWithMessage(c, apierrors.ErrUnauthorized, "user not found")
			c.Abort()
			return
		}

		servercontext.SetUser(c, user)
		c.Next()
	}
}

func generateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand failed: %v", err))
	}
	return hex.EncodeToString(b)
}

func generateToken(userID, typ string) string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand failed: %v", err))
	}
	return typ + "_" + userID + "_" + hex.EncodeToString(b)
}

// constantTimeCompare performs a constant-time comparison of two strings
// to prevent timing attacks. It uses hmac.Equal for byte-level comparison.
func constantTimeCompare(a, b string) bool {
	if len(a) != len(b) {
		// Use subtle.ConstantTimeCompare which handles length differences
		// by returning 0, but we still need to avoid leaking length info
		// when possible. For tokens of same expected length, this is fine.
		result := subtle.ConstantTimeCompare([]byte(a), []byte(b))
		return result == 1
	}
	return hmac.Equal([]byte(a), []byte(b))
}

func extractToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	if t := c.Query("token"); t != "" {
		return t
	}
	return ""
}

func splitEmail(email string) string {
	for i := 0; i < len(email); i++ {
		if email[i] == '@' {
			return email[:i]
		}
	}
	return email
}

// hashPassword hashes a password using bcrypt.
func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// verifyPassword verifies a password against a hash.
// It supports both bcrypt and legacy SHA-256 hashes for transparent migration.
func verifyPassword(hash, password string) bool {
	// Try bcrypt first
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err == nil {
		return true
	}

	// Fallback: check if it's a legacy SHA-256 hash (64-char hex string)
	if isLegacySHA256(hash) {
		h := sha256.Sum256([]byte(password))
		legacyHash := hex.EncodeToString(h[:])
		return constantTimeCompare(hash, legacyHash)
	}

	return false
}

// isLegacySHA256 checks if the hash is a legacy SHA-256 hex string (64 hex characters).
func isLegacySHA256(hash string) bool {
	if len(hash) != 64 {
		return false
	}
	matched, _ := regexp.MatchString(`^[a-f0-9]{64}$`, hash)
	return matched
}
