// Package teams provides team CRUD and member management.
package teams

import (
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
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	teamID := generateID()
	team := &storage.Team{
		ID:        teamID,
		Name:      req.Name,
		OwnerID:   user.ID,
		CreatedAt: time.Now(),
	}

	if err := s.store.CreateTeam(team); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create team"})
		return
	}

	if err := s.store.AddTeamMember(&storage.TeamMember{
		TeamID: teamID,
		UserID: user.ID,
		Role:   "owner",
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add owner"})
		return
	}

	c.JSON(http.StatusCreated, team)
}

// ListTeams handles GET /api/teams
func (s *Service) ListTeams(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	teams, err := s.store.ListTeamsByUser(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
		return
	}
	if teams == nil {
		teams = []*storage.Team{}
	}
	c.JSON(http.StatusOK, teams)
}

// GetTeamWorkspaces handles GET /api/teams/{id}/workspaces
func (s *Service) GetTeamWorkspaces(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	teamID := c.Param("id")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner", "admin", "member", "viewer") {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	// Return workspace list for the team (in v0.5.0, just metadata)
	c.JSON(http.StatusOK, gin.H{
		"team_id":     teamID,
		"workspaces":  []gin.H{},
		"message":     "team workspaces list",
	})
}

// InviteMember handles POST /api/teams/{id}/invite
func (s *Service) InviteMember(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	teamID := c.Param("id")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner", "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied"})
		return
	}

	var req InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to invite member"})
		return
	}

	// Record team invite event
	s.store.AppendTelemetryEvent(&storage.TelemetryEvent{
		ID:   generateID(),
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

// UpdateMember handles PATCH /api/teams/{id}/members/{userid}
func (s *Service) UpdateMember(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	teamID := c.Param("id")
	targetUserID := c.Param("userid")
	if !isTeamMemberStore(s.store, teamID, user.ID, "owner") {
		c.JSON(http.StatusForbidden, gin.H{"error": "only team owner can modify members"})
		return
	}

	var req struct {
		Role string `json:"role" binding:"oneof=owner admin member viewer"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := s.store.UpdateTeamMemberRole(teamID, targetUserID, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"team_id": teamID,
		"user_id": targetUserID,
		"role":    req.Role,
	})
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

func generateID() string {
	return "team_" + time.Now().Format("20060102150405")
}
