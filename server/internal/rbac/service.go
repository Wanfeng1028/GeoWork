// Package rbac provides role-based access control for the cloud API.
package rbac

import (
	"net/http"
	"strings"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// CheckPermission handles checking if a user has a specific permission.
// RBAC implementation for v0.4.0 — plan-based and team-based permissions.
//
// Supported permissions:
// - workspace:owner - workspace owner
// - task:owner - task owner
// - artifact:viewer - can view artifacts
// - billing:admin - billing administration
// - plugin:admin - plugin marketplace administration
// - mcp:admin - MCP server administration
// - team:admin - team administration
type CheckPermissionRequest struct {
	Permission string `json:"permission" binding:"required"`
	ObjectID   string `json:"object_id"`
}

// CheckPermission handles POST /api/rbac/check
func (s *Service) CheckPermission(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req CheckPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	allowed := s.checkPermission(user, req.Permission, req.ObjectID)

	c.JSON(http.StatusOK, gin.H{
		"allowed":    allowed,
		"permission": req.Permission,
	})
}

// GetRoles handles GET /api/rbac/roles
func (s *Service) GetRoles(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	roles := []string{"user"}
	if user.Plan == "pro" {
		roles = append(roles, "pro")
	}
	if user.Plan == "team" {
		roles = append(roles, "team")
	}

	// Check team membership
	s.store.Mu.RLock()
	var teamRoles []string
	for key := range s.store.TeamMembers {
		if strings.HasSuffix(key, "_"+user.ID) {
			member := s.store.TeamMembers[key]
			teamRoles = append(teamRoles, "team:"+member.Role)
		}
	}
	s.store.Mu.RUnlock()

	roles = append(roles, teamRoles...)

	c.JSON(http.StatusOK, gin.H{
		"roles": roles,
	})
}

func (s *Service) checkPermission(user *storage.User, permission, objectID string) bool {
	// Owner always has access
	if strings.HasSuffix(permission, ":owner") {
		return true
	}

	// Plan-based permissions
	switch permission {
	case "billing:admin":
		return user.Plan != "free"
	case "plugin:admin", "mcp:admin":
		return user.Plan == "team"
	case "artifact:viewer":
		return true // all authenticated Users can view
	case "team:admin":
		// Check if user is team owner/admin
		for _, m := range s.store.TeamMembers {
			if m.UserID == user.ID && (m.Role == "owner" || m.Role == "admin") {
				return true
			}
		}
		return false
	default:
		return false
	}
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
