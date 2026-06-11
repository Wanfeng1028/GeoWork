// Package rbac provides role-based access control for the cloud API.
package rbac

import (
	"net/http"

	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// CheckPermissionRequest represents a permission check request.
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

	// Check team membership for additional roles
	var teamRoles []string
	// Iterate over all teams to find user's roles
	rows, err := s.store.DB().Query(`
		SELECT tm.role FROM team_members tm WHERE tm.user_id=?`, user.ID)
	if err == nil {
		for rows.Next() {
			var role string
			if err := rows.Scan(&role); err == nil {
				teamRoles = append(teamRoles, "team:"+role)
			}
		}
		rows.Close()
	}
	roles = append(roles, teamRoles...)

	c.JSON(http.StatusOK, gin.H{
		"roles": roles,
	})
}

// GetPermissions handles GET /api/account/permissions
func (s *Service) GetPermissions(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	permissions := s.getAllPermissions(user)

	c.JSON(http.StatusOK, gin.H{
		"permissions": permissions,
		"roles":       []string{"user", user.Plan},
	})
}

func (s *Service) checkPermission(user *storage.User, permission, objectID string) bool {
	// Owner always has access
	if len(permission) > 6 && permission[len(permission)-6:] == ":owner" {
		return true
	}

	switch permission {
	case "billing:admin":
		return user.Plan != "free"
	case "plugin:admin", "mcp:admin":
		return user.Plan == "team"
	case "artifact:viewer":
		return true
	case "team:admin":
		member, err := s.store.GetTeamMember(objectID, user.ID)
		if err == nil && member != nil {
			return member.Role == "owner" || member.Role == "admin"
		}
		return false
	default:
		return false
	}
}

func (s *Service) getAllPermissions(user *storage.User) []string {
	var perms []string
	perms = append(perms, "workspace:read", "task:read", "task:write")

	switch user.Plan {
	case "pro":
		perms = append(perms, "cloud_sync", "billing:read")
	case "team":
		perms = append(perms, "cloud_sync", "billing:admin", "team:write", "plugin:admin")
	}

	return perms
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
