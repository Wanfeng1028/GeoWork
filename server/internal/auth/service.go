// Package auth provides login, logout, refresh token, and user info endpoints.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
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

// Login handles POST /api/auth/login
func (s *Service) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	hashedPassword := hashPassword(req.Password)

	user, err := s.store.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	if user == nil {
		// Auto-register new users
		user = &storage.User{
			ID:           generateID(),
			Email:        req.Email,
			Name:         splitEmail(req.Email),
			Plan:         "free",
			PasswordHash: hashedPassword,
		}
		if err := s.store.CreateUser(user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create account"})
			return
		}
	} else {
		if user.PasswordHash != hashedPassword {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}
	if err := s.store.CreateToken(refreshTokenObj); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	if err := s.store.DeleteToken(token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// Refresh handles POST /api/auth/refresh
func (s *Service) Refresh(c *gin.Context) {
	refreshToken := extractToken(c)
	if refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}

	tok, err := s.store.GetToken(refreshToken)
	if err != nil || tok == nil || tok.Type != "refresh" || time.Now().After(tok.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// Verify user still exists
	user, err := s.store.GetUserByID(tok.UserID)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	tok, err := s.store.GetToken(token)
	if err != nil || tok == nil || time.Now().After(tok.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
		return
	}

	user, err := s.store.GetUserByID(tok.UserID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
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
			c.Next()
			return
		}

		tok, err := s.store.GetToken(token)
		if err != nil || tok == nil || time.Now().After(tok.ExpiresAt) {
			c.Next()
			return
		}

		user, err := s.store.GetUserByID(tok.UserID)
		if err != nil || user == nil {
			c.Next()
			return
		}

		c.Set("user_id", tok.UserID)
		c.Set("user", user)
		c.Next()
	}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateToken(userID, typ string) string {
	b := make([]byte, 32)
	rand.Read(b)
	return typ + "_" + userID + "_" + hex.EncodeToString(b)
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

func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}
