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

	// Validate email and password
	// For v0.4.0: simple hash-based password verification
	// In production, use bcrypt or argon2id
	hashedPassword := hashPassword(req.Password)

	s.store.Mu.RLock()
	existing, ok := s.store.Users[req.Email]
	s.store.Mu.RUnlock()

	var user *storage.User
	if !ok {
		// Auto-register new Users
		user = &storage.User{
			ID:           generateID(),
			Email:        req.Email,
			Name:         splitEmail(req.Email),
			Plan:         "free",
			PasswordHash: hashedPassword,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		s.store.Mu.Lock()
		s.store.Users[req.Email] = user
		s.store.Mu.Unlock()
	} else {
		// Verify password hash
		if existing.PasswordHash != hashedPassword {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		user = existing
	}

	// Generate Tokens
	accessToken := generateToken(user.ID, "access")
	refreshToken := generateToken(user.ID, "refresh")

	// Store Tokens
	s.store.Mu.Lock()
	s.store.Tokens[accessToken] = &storage.Token{
		ID:        accessToken,
		UserID:    user.ID,
		Type:      "access",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}
	s.store.Tokens[refreshToken] = &storage.Token{
		ID:        refreshToken,
		UserID:    user.ID,
		Type:      "refresh",
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		CreatedAt: time.Now(),
	}
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, LoginResponse{
		User:         user,
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

	s.store.Mu.Lock()
	delete(s.store.Tokens, token)
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// Refresh handles POST /api/auth/refresh
func (s *Service) Refresh(c *gin.Context) {
	refreshToken := extractToken(c)
	if refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}

	s.store.Mu.RLock()
	tok, ok := s.store.Tokens[refreshToken]
	s.store.Mu.RUnlock()

	if !ok || tok.Type != "refresh" || time.Now().After(tok.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// Get user
	s.store.Mu.RLock()
	_, exists := s.store.Users[tok.UserID]
	s.store.Mu.RUnlock()
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Generate new access token
	newAccessToken := generateToken(tok.UserID, "access")
	s.store.Mu.Lock()
	s.store.Tokens[newAccessToken] = &storage.Token{
		ID:        newAccessToken,
		UserID:    tok.UserID,
		Type:      "access",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}
	s.store.Mu.Unlock()

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

	s.store.Mu.RLock()
	tok, ok := s.store.Tokens[token]
	s.store.Mu.RUnlock()

	if !ok || time.Now().After(tok.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
		return
	}

	s.store.Mu.RLock()
	user, ok := s.store.Users[tok.UserID]
	s.store.Mu.RUnlock()

	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Middleware returns a Gin middleware that validates Tokens.
func (s *Service) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			c.Next()
			return
		}

		s.store.Mu.RLock()
		tok, ok := s.store.Tokens[token]
		s.store.Mu.RUnlock()

		if !ok || time.Now().After(tok.ExpiresAt) {
			c.Next()
			return
		}

		s.store.Mu.RLock()
		user, ok := s.store.Users[tok.UserID]
		s.store.Mu.RUnlock()

		if !ok {
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
	// Check Authorization header first
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	// Check query param (for WebSocket etc.)
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

// hashPassword creates a simple SHA-256 hash of the password.
// In production, use bcrypt or argon2id for proper password hashing.
func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}
