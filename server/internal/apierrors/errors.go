// Package apierrors provides unified error response types and helpers.
package apierrors

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AppError is the standard error response structure.
type AppError struct {
	Code      int         `json:"code"`
	ErrorCode string      `json:"error_code"`
	Message   string      `json:"message"`
	Details   interface{} `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

// 预定义错误常量
var (
	ErrBadRequest   = &AppError{Code: http.StatusBadRequest, ErrorCode: "BAD_REQUEST", Message: "invalid request"}
	ErrUnauthorized = &AppError{Code: http.StatusUnauthorized, ErrorCode: "UNAUTHORIZED", Message: "unauthorized"}
	ErrForbidden    = &AppError{Code: http.StatusForbidden, ErrorCode: "FORBIDDEN", Message: "forbidden"}
	ErrNotFound     = &AppError{Code: http.StatusNotFound, ErrorCode: "NOT_FOUND", Message: "resource not found"}
	ErrConflict     = &AppError{Code: http.StatusConflict, ErrorCode: "CONFLICT", Message: "resource conflict"}
	ErrInternal     = &AppError{Code: http.StatusInternalServerError, ErrorCode: "INTERNAL_ERROR", Message: "internal server error"}
)

// Respond 发送统一格式的错误响应
func Respond(c *gin.Context, err *AppError) {
	c.JSON(err.Code, err)
}

// RespondError 发送统一格式的错误响应（Respond 的别名）
func RespondError(c *gin.Context, err *AppError) {
	Respond(c, err)
}

// RespondWithMessage 发送带自定义消息的错误响应
func RespondWithMessage(c *gin.Context, err *AppError, message string) {
	c.JSON(err.Code, &AppError{
		Code:      err.Code,
		ErrorCode: err.ErrorCode,
		Message:   message,
	})
}

// RespondWithDetails 发送带详细信息的错误响应
func RespondWithDetails(c *gin.Context, err *AppError, details interface{}) {
	c.JSON(err.Code, &AppError{
		Code:      err.Code,
		ErrorCode: err.ErrorCode,
		Message:   err.Message,
		Details:   details,
	})
}

// New 创建自定义错误
func New(code int, errorCode, message string) *AppError {
	return &AppError{Code: code, ErrorCode: errorCode, Message: message}
}
