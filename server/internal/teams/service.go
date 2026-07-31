// Package teams provides team CRUD and member management.
package teams

import (
	"net/http"
	"time"

	"server/internal/apierrors"
	"server/internal/idgen"
	"server/internal/servercontext"
	"server/internal/storage"

	"github.com/gin-gonic/gin"
)

type Service struct {
	store *storage.Store
}

func NewService(store *storage.Store) *Service {
	return &Service{store: store}
}

// CreateTeamRequest represents a team creation request.
type CreateTeamRequest struct {
	Name string `json:"name" binding:"required"`
}

// InviteMemberRequest represents a team invite request.
type InviteMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"oneof=admin member viewer"`
}

// CreateTeam handles POST /api/teams
func (s *Service) CreateTeam(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	var req CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	teamID := idgen.New("team_")
	team := &storage.Team{
		ID:        teamID,
		Name:      req.Name,
		OwnerID:   user.ID,
		CreatedAt: time.Now(),
	}

	if err := s.store.CreateTeam(team); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to create team")
		return
	}

	if err := s.store.AddTeamMember(&storage.TeamMember{
		TeamID: teamID,
		UserID: user.ID,
		Role:   "owner",
	}); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to add owner")
		return
	}

	c.JSON(http.StatusCreated, team)
}

// ListTeams handles GET /api/teams
func (s *Service) ListTeams(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teams, err := s.store.ListTeamsByUser(user.ID)
	if err != nil {
		apierrors.Respond(c, apierrors.ErrInternal)
		return
	}
	if teams == nil {
		teams = []*storage.Team{}
	}
	c.JSON(http.StatusOK, teams)
}

// GetTeamWorkspaces handles GET /api/teams/:id/workspaces
func (s *Service) GetTeamWorkspaces(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner", "admin", "member", "viewer") {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "permission denied")
		return
	}

	workspaceIDs, err := s.store.ListTeamWorkspaces(teamID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if workspaceIDs == nil {
		workspaceIDs = []string{}
	}

	c.JSON(http.StatusOK, gin.H{
		"team_id":    teamID,
		"workspaces": workspaceIDs,
	})
}

// InviteMember handles POST /api/teams/:id/invite
func (s *Service) InviteMember(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner", "admin") {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "permission denied")
		return
	}

	var req InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	role := req.Role
	if role == "" {
		role = "member"
	}

	if err := s.store.AddTeamMember(&storage.TeamMember{
		TeamID: teamID,
		UserID: req.UserID,
		Role:   role,
	}); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to invite member")
		return
	}

	// Record team invite event
	s.store.AppendTelemetryEvent(&storage.TelemetryEvent{
		ID:   idgen.New("team_"),
		UserID: user.ID,
		Type: "team_invite",
		Value: 1,
		Metadata: map[string]interface{}{
			"team_id": teamID,
			"target_user_id": req.UserID,
			"role": role,
		},
	})

	c.JSON(http.StatusOK, gin.H{
		"team_id":    teamID,
		"user_id":    req.UserID,
		"role":       role,
		"message":    "member invited successfully",
		"invite_sent": true,
	})
}

// UpdateMember handles PATCH /api/teams/:id/members/:userid
func (s *Service) UpdateMember(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")
	targetUserID := c.Param("userid")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner") {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only team owner can modify members")
		return
	}

	var req struct {
		Role string `json:"role" binding:"oneof=owner admin member viewer"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.Respond(c, apierrors.ErrBadRequest)
		return
	}

	if err := s.store.UpdateTeamMemberRole(teamID, targetUserID, req.Role); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrInternal, "failed to update member")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"team_id": teamID,
		"user_id": targetUserID,
		"role":    req.Role,
	})
}

// DeleteTeam handles DELETE /api/teams/:id
// Only the team owner can delete a team. Performs cascade soft-delete of all members.
func (s *Service) DeleteTeam(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")

	// Verify team exists
	team, err := s.store.GetTeam(teamID)
	if err != nil || team == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "team not found")
		return
	}

	// Only owner can delete
	if team.OwnerID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only team owner can delete the team")
		return
	}

	if err := s.store.SoftDeleteTeam(teamID); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "team deleted successfully",
		"team_id": teamID,
	})
}

// RemoveMember handles DELETE /api/teams/:id/members/:userid
// Only owner/admin can remove members. Cannot remove the owner.
func (s *Service) RemoveMember(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")
	targetUserID := c.Param("userid")

	// Check caller has owner/admin role
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner", "admin") {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only owner or admin can remove members")
		return
	}

	// Cannot remove yourself (owner should use TransferOwnership first)
	if targetUserID == user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "cannot remove yourself from the team")
		return
	}

	// Cannot remove the owner
	team, err := s.store.GetTeam(teamID)
	if err != nil || team == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "team not found")
		return
	}
	if team.OwnerID == targetUserID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "cannot remove the team owner")
		return
	}

	if err := s.store.RemoveTeamMember(teamID, targetUserID); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "member removed successfully",
		"team_id": teamID,
		"user_id": targetUserID,
	})
}

// GetTeamMembers handles GET /api/teams/:id/members
// Returns member list with username, email, and role.
func (s *Service) GetTeamMembers(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner", "admin", "member", "viewer") {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "permission denied")
		return
	}

	members, err := s.store.ListTeamMembersWithUser(teamID)
	if err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}
	if members == nil {
		members = []*storage.TeamMemberInfo{}
	}

	c.JSON(http.StatusOK, gin.H{
		"team_id": teamID,
		"members": members,
	})
}

// TransferOwnership handles POST /api/teams/:id/transfer
// Only the current owner can transfer ownership to an existing team member.
func (s *Service) TransferOwnership(c *gin.Context) {
	user, ok := servercontext.RequireUser(c)
	if !ok {
		return
	}

	teamID := c.Param("id")

	// Verify team exists and caller is owner
	team, err := s.store.GetTeam(teamID)
	if err != nil || team == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrNotFound, "team not found")
		return
	}
	if team.OwnerID != user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrForbidden, "only team owner can transfer ownership")
		return
	}

	var req struct {
		NewOwnerID string `json:"new_owner_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "new_owner_id is required")
		return
	}

	// Target must be an existing team member
	targetMember, err := s.store.GetTeamMember(teamID, req.NewOwnerID)
	if err != nil || targetMember == nil {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "target user is not a team member")
		return
	}

	// Cannot transfer to yourself
	if req.NewOwnerID == user.ID {
		apierrors.RespondWithMessage(c, apierrors.ErrBadRequest, "cannot transfer ownership to yourself")
		return
	}

	if err := s.store.TransferTeamOwnership(teamID, user.ID, req.NewOwnerID); err != nil {
		apierrors.RespondError(c, apierrors.ErrInternal)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "ownership transferred successfully",
		"team_id":      teamID,
		"new_owner_id": req.NewOwnerID,
	})
}

func isTeamMemberStore(store *storage.Store, teamID, userID string, roles ...string) bool {
	member, err := store.GetTeamMember(teamID, userID)
	if err != nil || member == nil {
		return false
	}
	for _, r := range roles {
		if member.Role == r {
			return true
		}
	}
	return false
}
