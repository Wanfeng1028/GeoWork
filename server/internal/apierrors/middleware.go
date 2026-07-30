package apierrors

import (
	"log"

	"github.com/gin-gonic/gin"
)

// Recovery 中间件：捕获 panic 并返回统一格式的 500 JSON 响应
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %v", err)
				RespondError(c, ErrInternal)
			}
		}()
		c.Next()
	}
}
