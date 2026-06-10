// Package teams provides team CRUD and member management.
package teams

import (
	"net/http"
	"strings"
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

// CreateTeam handles POST /api/Teams
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

	s.store.Mu.Lock()
	s.store.Teams[teamID] = team
	s.store.TeamMembers[teamID+"_"+user.ID] = &storage.TeamMember{
		TeamID: teamID,
		UserID: user.ID,
		Role:   "owner",
	}
	s.store.Mu.Unlock()

	c.JSON(http.StatusCreated, team)
}

// ListTeams handles GET /api/Teams
func (s *Service) ListTeams(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	s.store.Mu.RLock()
	var result []*storage.Team
	for _, team := range s.store.Teams {
		memberKey := team.ID + "_" + user.ID
		if _, ok := s.store.TeamMembers[memberKey]; ok {
			result = append(result, team)
		}
	}
	s.store.Mu.RUnlock()

	if result == nil {
		result = []*storage.Team{}
	}
	c.JSON(http.StatusOK, result)
}

// InviteMember handles POST /api/Teams/{id}/invite
func (s *Service) InviteMember(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	teamID := c.Param("id")
	if !isTeamMember(s.store, teamID, user.ID, "owner", "admin") {
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

	s.store.Mu.Lock()
	s.store.TeamMembers[teamID+"_"+req.UserID] = &storage.TeamMember{
		TeamID: teamID,
		UserID: req.UserID,
		Role:   role,
	}
	s.store.Mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"team_id": teamID,
		"user_id": req.UserID,
		"role":    role,
		"message": "member invited (placeholder)",
	})
}

// UpdateMember handles PATCH /api/Teams/{id}/members/{userId}
func (s *Service) UpdateMember(c *gin.Context) {
	user := getUserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	teamID := c.Param("id")
	targetUserID := c.Param("userid")
	if !isTeamMember(s.store, teamID, user.ID, "owner") {
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

	s.store.Mu.Lock()
	key := teamID + "_" + targetUserID
	if m, ok := s.store.TeamMembers[key]; ok {
		m.Role = req.Role
	}
	s.store.Mu.Unlock()

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

func isTeamMember(store *storage.Store, teamID, userID string, roles ...string) bool {
	key := teamID + "_" + userID
	member, ok := store.TeamMembers[key]
	if !ok {
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

// Helper to extract team ID from path
func extractTeamID(c *gin.Context) string {
	id := c.Param("id")
	return strings.TrimPrefix(id, "Teams/")
}
