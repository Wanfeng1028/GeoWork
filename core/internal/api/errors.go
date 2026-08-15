// GeoWork Go Core - API Error Types
// This file is the authoritative source for business error codes.
// Doc mirror: doc/15-Engineering-API-Contract.md §5.1

package api

import (
	"encoding/json"
	"net/http"
)

// ErrorCode is a business error code.
type ErrorCode int

const (
	// Common request errors (10000)
	ErrBadRequest ErrorCode = 10000

	// Task errors (1xxxx)
	ErrTaskNotFound     ErrorCode = 10001
	ErrTaskInvalidState ErrorCode = 10002

	// Tool/Sandbox errors (2xxxx)
	ErrToolTimeout   ErrorCode = 20001
	ErrSandboxDenied ErrorCode = 20002

	// Model errors (3xxxx)
	ErrModelCallFailed ErrorCode = 30001
	ErrContextTooLong  ErrorCode = 30002

	// Permission errors (4xxxx)
	ErrPermissionDenied ErrorCode = 40001

	// System errors (5xxxx)
	ErrInternal ErrorCode = 50001
)

// ApiError is the standard error response structure.
type ApiError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details any       `json:"details,omitempty"`
}

// Error implements the error interface.
func (e ApiError) Error() string {
	return e.Message
}

// NewApiError creates a new ApiError with the given code and message.
func NewApiError(code ErrorCode, message string) ApiError {
	return ApiError{Code: code, Message: message}
}

// WriteError writes a JSON error response with the given HTTP status code and business error code.
func WriteError(w http.ResponseWriter, httpStatus int, code ErrorCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	json.NewEncoder(w).Encode(ApiError{
		Code:    code,
		Message: message,
	})
}

// WriteInternalError writes a 500 internal server error response.
func WriteInternalError(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusInternalServerError, ErrInternal, message)
}

// WriteBadRequest writes a 400 bad request error response.
func WriteBadRequest(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadRequest, ErrBadRequest, message)
}

// WriteNotFound writes a 404 not found error response.
func WriteNotFound(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, ErrTaskNotFound, message)
}
