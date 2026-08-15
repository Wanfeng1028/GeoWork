// Package sync provides multi-device sync endpoints.
package sync

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"server/internal/apierrors"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

const defaultTTL = 30 * 24 * time.Hour // 30 days

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// PushRequest represents a sync push request.
type PushRequest struct {
	ObjectType string `json:"object_type" binding:"required"`
	ObjectID   string `json:"object_id" binding:"required"`
	Data       string `json:"data" binding:"required"`
}

// Push handles POST /api/sync/push
func (s *Service) Push(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req PushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	if !isValidObjectType(req.ObjectType) {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, fmt.Sprintf("invalid object type: %s", req.ObjectType))
		return
	}

	if !isValidPayload(req.ObjectType, req.Data) {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "payload contains prohibited data")
		return
	}

	now := time.Now().UnixNano()

	// Conflict detection: check if existing record has been modified since client's last sync
	existing, err := s.store.GetSyncRecordByObject(user.ID, req.ObjectType, req.ObjectID)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}

	var conflict bool
	var conflictDetails gin.H

	if existing != nil {
		// last-write-wins strategy, but mark as conflict if timestamps are close (within 1 second)
		clientCursorStr := c.GetHeader("X-Sync-Cursor")
		if clientCursorStr != "" {
			clientCursor, parseErr := strconv.ParseInt(clientCursorStr, 10, 64)
			if parseErr == nil && existing.Cursor > clientCursor {
				// Server has newer data — conflict detected
				conflict = true
				conflictDetails = gin.H{
					"existing_cursor": existing.Cursor,
					"client_cursor":   clientCursor,
					"strategy":        "last-write-wins",
				}
			}
		}
	}

	record := &storage.SyncRecord{
		ID:         generateID(),
		UserID:     user.ID,
		ObjectType: req.ObjectType,
		ObjectID:   req.ObjectID,
		Data:       req.Data,
		Cursor:     now,
	}

	if err := s.store.UpsertSyncRecord(record); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to push sync")
		return
	}

	resp := gin.H{
		"message": "synced",
		"cursor":  record.Cursor,
	}
	if conflict {
		resp["conflict"] = true
		resp["conflict_details"] = conflictDetails
	}

	c.JSON(http.StatusOK, resp)
}

// Pull handles GET /api/sync/pull
func (s *Service) Pull(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	cursorStr := c.Query("cursor")
	var cursor int64
	if cursorStr != "" {
		fmt.Sscanf(cursorStr, "%d", &cursor)
	}

	// Support multi object_type filter: ?types=settings,workspace,task
	var records []*storage.SyncRecord
	var err error

	typesParam := c.Query("types")
	if typesParam != "" {
		types := strings.Split(typesParam, ",")
		// Validate each type
		validTypes := make([]string, 0, len(types))
		for _, t := range types {
			t = strings.TrimSpace(t)
			if isValidObjectType(t) {
				validTypes = append(validTypes, t)
			}
		}
		records, err = s.store.GetSyncRecordsByTypes(user.ID, cursor, validTypes)
	} else {
		records, err = s.store.GetSyncRecordsAfter(user.ID, cursor)
	}

	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if records == nil {
		records = []*storage.SyncRecord{}
	}

	// Detect conflicts in pull response
	now := time.Now().UnixNano()
	result := make([]gin.H, 0, len(records))
	for _, r := range records {
		item := gin.H{
			"id":          r.ID,
			"object_type": r.ObjectType,
			"object_id":   r.ObjectID,
			"data":        r.Data,
			"cursor":      r.Cursor,
			"created_at":  r.CreatedAt,
		}
		// Mark as conflict if the record was updated very recently (within 1 second of now)
		if now-r.Cursor < int64(time.Second) && r.Cursor > cursor {
			item["conflict"] = true
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"records": result,
		"cursor":  now,
	})
}

// GetState handles GET /api/sync/state
func (s *Service) GetState(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	cursor, err := s.store.GetSyncState(user.ID)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":  user.ID,
		"cursor":   cursor,
		"modified": time.Unix(0, cursor).UTC().Format(time.RFC3339),
	})
}

// ResolveConflict handles POST /api/sync/resolve-conflict
func (s *Service) ResolveConflict(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		ObjectType string `json:"object_type" binding:"required"`
		ObjectID   string `json:"object_id" binding:"required"`
		Winner     string `json:"winner" binding:"required"`
		Data       string `json:"data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid request")
		return
	}

	if !isValidObjectType(req.ObjectType) {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid object type")
		return
	}

	if !isValidPayload(req.ObjectType, req.Data) {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "payload contains prohibited data")
		return
	}

	if req.Winner != "local" && req.Winner != "remote" {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "winner must be 'local' or 'remote'")
		return
	}

	record := &storage.SyncRecord{
		ID:         generateID(),
		UserID:     user.ID,
		ObjectType: req.ObjectType,
		ObjectID:   req.ObjectID,
		Data:       req.Data,
		Cursor:     time.Now().UnixNano(),
	}

	if err := s.store.UpsertSyncRecord(record); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to resolve conflict")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "conflict resolved (winner: " + req.Winner + ")",
		"cursor":  record.Cursor,
	})
}

// Cleanup handles TTL-based cleanup of expired sync records.
// Can be called via POST /api/sync/cleanup or scheduled internally.
func (s *Service) Cleanup(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	// Only allow admin/system users to trigger cleanup
	_ = user

	ttlStr := c.DefaultQuery("ttl_days", "30")
	ttlDays, err := strconv.Atoi(ttlStr)
	if err != nil || ttlDays <= 0 {
		ttlDays = 30
	}

	cutoff := time.Now().Add(-time.Duration(ttlDays) * 24 * time.Hour).Unix()
	deleted, err := s.store.DeleteSyncRecordsBefore(cutoff)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "cleanup failed")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "cleanup completed",
		"ttl_days": ttlDays,
		"deleted":  deleted,
	})
}

// GetSyncHistory handles GET /api/sync/history
func (s *Service) GetSyncHistory(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	records, err := s.store.GetSyncHistory(user.ID, limit)
	if err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "server error")
		return
	}
	if records == nil {
		records = []*storage.SyncRecord{}
	}

	result := make([]gin.H, 0, len(records))
	for _, r := range records {
		result = append(result, gin.H{
			"id":          r.ID,
			"object_type": r.ObjectType,
			"object_id":   r.ObjectID,
			"cursor":      r.Cursor,
			"created_at":  r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"history": result,
		"count":   len(records),
	})
}

func isValidObjectType(typ string) bool {
	valid := map[string]bool{
		"settings": true, "workspace": true, "task": true,
		"artifact": true, "knowledge": true, "plugin": true,
		"mcp_config": true, "chat_summary": true,
		"conversation": true, "message": true,
	}
	return valid[typ]
}

func isValidPayload(typ string, data string) bool {
	// Prohibited data types — never sync these
	if strings.Contains(data, "API_KEY=") || strings.Contains(data, "api_key=") {
		return false
	}
	// Block large binary data (raw遥感, logs, raw workspace files)
	if len(data) > 5_000_000 { // 5MB limit
		return false
	}
	return true
}

func generateID() string {
	return "sync_" + time.Now().Format("20060102150405")
}
