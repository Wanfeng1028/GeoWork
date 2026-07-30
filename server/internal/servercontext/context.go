// Package servercontext provides shared gin context helpers for user extraction.
package servercontext

import (
	"net/http"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

const userKey = "user"

// SetUser 将用户信息存入 gin context（由 auth middleware 调用）
func SetUser(c *gin.Context, user *storage.User) {
	c.Set(userKey, user)
}

// RequireUser 从 gin context 提取用户信息。
// 若不存在，返回 (nil, false)，调用方只需 if !ok { return } 即可。
func RequireUser(c *gin.Context) (*storage.User, bool) {
	val, exists := c.Get(userKey)
	if !exists {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}
	user, ok := val.(*storage.User)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}
	return user, true
}
