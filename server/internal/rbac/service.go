// Package rbac provides role-based access control for the cloud API.
package rbac

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"server/internal/apierrors"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

// rolePermissions defines the permission matrix for each role.
var rolePermissions = map[string]map[string]bool{
	"owner":  {"read": true, "write": true, "delete": true, "admin": true, "manage_members": true},
	"admin":  {"read": true, "write": true, "delete": true, "manage_members": true},
	"member": {"read": true, "write": true},
	"viewer": {"read": true},
}

// roleHierarchy defines the relative rank of each role (higher = more privileged).
var roleHierarchy = map[string]int{
	"owner":  4,
	"admin":  3,
	"member": 2,
	"viewer": 1,
}

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
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req CheckPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
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
	user, ok := servercontext.RequireUser(c)
	if !ok {
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
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	permissions := s.getAllPermissions(user)

	c.JSON(http.StatusOK, gin.H{
		"permissions": permissions,
		"roles":       []string{"user", user.Plan},
	})
}

// CheckResourcePermissionRequest represents a resource-level permission check.
type CheckResourcePermissionRequest struct {
	ResourceType string `json:"resource_type" binding:"required"` // workspace | task
	ResourceID   string `json:"resource_id" binding:"required"`
	Action       string `json:"action" binding:"required"` // read | write | delete | admin | manage_members
}

// CheckResourcePermission handles POST /api/rbac/check-resource
func (s *Service) CheckResourcePermission(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req CheckResourcePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	allowed := s.CheckResourcePermissionForUser(user.ID, req.ResourceType, req.ResourceID, req.Action)

	c.JSON(http.StatusOK, gin.H{
		"allowed":       allowed,
		"resource_type": req.ResourceType,
		"resource_id":   req.ResourceID,
		"action":        req.Action,
	})
}

// AssignRoleRequest represents a role assignment request.
type AssignRoleRequest struct {
	WorkspaceID string `json:"workspace_id" binding:"required"`
	UserID      string `json:"user_id" binding:"required"`
	Role        string `json:"role" binding:"required"`
}

// AssignRole handles POST /api/rbac/assign-role
func (s *Service) AssignRole(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	// Validate role
	if _, valid := rolePermissions[req.Role]; !valid {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "invalid role: "+req.Role)
		return
	}

	// Check if the caller has permission to manage members in this workspace
	callerRole := s.getUserWorkspaceRole(user.ID, req.WorkspaceID)
	if !s.hasPermission(callerRole, "manage_members") {
		apierrors.Respond(c, apierrors.ErrForbidden)
		return
	}

	// Cannot assign a role higher than or equal to own role
	targetRank := roleHierarchy[req.Role]
	callerRank := roleHierarchy[callerRole]
	if targetRank >= callerRank {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "cannot assign a role higher than or equal to your own")
		return
	}

	// Perform the assignment
	wr := &storage.WorkspaceRole{
		ID:          generateID(),
		WorkspaceID: req.WorkspaceID,
		UserID:      req.UserID,
		Role:        req.Role,
		AssignedBy:  user.ID,
	}
	if err := s.store.UpsertWorkspaceRole(wr); err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "role assigned successfully",
		"workspace_id": req.WorkspaceID,
		"user_id":      req.UserID,
		"role":         req.Role,
	})
}

// CheckResourcePermissionForUser checks if a user has permission on a resource.
func (s *Service) CheckResourcePermissionForUser(userID, resourceType, resourceID, action string) bool {
	// Determine the user's role for this resource
	role := s.getUserWorkspaceRole(userID, resourceID)
	return s.hasPermission(role, action)
}

// getUserWorkspaceRole returns the user's role for a given workspace/resource.
func (s *Service) getUserWorkspaceRole(userID, workspaceID string) string {
	// First check workspace_roles table
	wr, err := s.store.GetWorkspaceRole(workspaceID, userID)
	if err == nil && wr != nil {
		return wr.Role
	}

	// Fallback: check team_members for the workspace (treated as team)
	tm, err := s.store.GetTeamMember(workspaceID, userID)
	if err == nil && tm != nil {
		return tm.Role
	}

	return ""
}

// hasPermission checks if a role has the given permission using the matrix.
func (s *Service) hasPermission(role, permission string) bool {
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	return perms[permission]
}

// checkPermission is the legacy permission check (kept for backward compatibility).
func (s *Service) checkPermission(user *storage.User, permission, objectID string) bool {
	// Owner always has access
	if len(permission) > 6 && permission[len(permission)-6:] == ":owner" {
		return true
	}

	// Grant when the permission appears in the user's plan-derived list —
	// the same source GetPermissions advertises, so the two endpoints agree
	// (e.g. team plans carry billing:admin there but the role matrix alone
	// would deny it here).
	for _, p := range s.getAllPermissions(user) {
		if p == permission {
			return true
		}
	}

	// Data-driven check using rolePermissions matrix
	// Map legacy permission strings to matrix actions
	action := mapLegacyPermission(permission)
	if action != "" {
		// Check via user's plan role as fallback
		planRole := mapPlanToRole(user.Plan)
		if s.hasPermission(planRole, action) {
			return true
		}
	}

	// Specific resource checks
	switch permission {
	case "team:admin":
		member, err := s.store.GetTeamMember(objectID, user.ID)
		if err == nil && member != nil {
			return s.hasPermission(member.Role, "admin")
		}
		return false
	default:
		return false
	}
}

// mapLegacyPermission maps legacy permission strings to matrix actions.
func mapLegacyPermission(perm string) string {
	switch perm {
	case "billing:admin":
		return "admin"
	case "plugin:admin", "mcp:admin":
		return "admin"
	case "artifact:viewer":
		return "read"
	default:
		return ""
	}
}

// mapPlanToRole maps a user plan to a default role for permission checks.
func mapPlanToRole(plan string) string {
	switch plan {
	case "team":
		return "admin"
	case "pro":
		return "member"
	default:
		return "viewer"
	}
}

func (s *Service) getAllPermissions(user *storage.User) []string {
	var perms []string
	perms = append(perms, "workspace:read", "task:read", "task:write")

	// Use the rolePermissions matrix to derive permissions
	role := mapPlanToRole(user.Plan)
	if matrixPerms, ok := rolePermissions[role]; ok {
		for action, allowed := range matrixPerms {
			if allowed {
				perms = append(perms, action)
			}
		}
	}

	switch user.Plan {
	case "pro":
		perms = append(perms, "cloud_sync", "billing:read")
	case "team":
		perms = append(perms, "cloud_sync", "billing:admin", "team:write", "plugin:admin")
	}

	return perms
}

// generateID generates a random hex ID.
func generateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}
