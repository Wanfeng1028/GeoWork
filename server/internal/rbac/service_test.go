// Package rbac tests for the role/permission matrix and HTTP handlers.
package rbac

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"server/internal/storage"
	"server/internal/testutil"

	"github.com/gin-gonic/gin"
)

func TestRolePermissionMatrix(t *testing.T) {
	tests := []struct {
		role       string
		permission string
		want       bool
	}{
		{"owner", "read", true},
		{"owner", "write", true},
		{"owner", "delete", true},
		{"owner", "admin", true},
		{"owner", "manage_members", true},
		{"admin", "read", true},
		{"admin", "write", true},
		{"admin", "delete", true},
		{"admin", "manage_members", true},
		{"admin", "admin", false},
		{"member", "read", true},
		{"member", "write", true},
		{"member", "delete", false},
		{"member", "manage_members", false},
		{"viewer", "read", true},
		{"viewer", "write", false},
		{"viewer", "delete", false},
		{"unknown_role", "read", false},
		{"", "read", false},
	}
	s := &Service{}
	for _, tt := range tests {
		if got := s.hasPermission(tt.role, tt.permission); got != tt.want {
			t.Errorf("hasPermission(%q, %q) = %v, want %v", tt.role, tt.permission, got, tt.want)
		}
	}
}

func TestRoleHierarchyConsistency(t *testing.T) {
	// Every role in the permission matrix must have a hierarchy rank and
	// vice versa, otherwise AssignRole's rank comparison silently breaks.
	for role := range rolePermissions {
		if _, ok := roleHierarchy[role]; !ok {
			t.Errorf("role %q has permissions but no hierarchy rank", role)
		}
	}
	for role := range roleHierarchy {
		if _, ok := rolePermissions[role]; !ok {
			t.Errorf("role %q has a hierarchy rank but no permissions", role)
		}
	}
	if roleHierarchy["owner"] <= roleHierarchy["admin"] ||
		roleHierarchy["admin"] <= roleHierarchy["member"] ||
		roleHierarchy["member"] <= roleHierarchy["viewer"] {
		t.Error("role hierarchy is not strictly ordered owner > admin > member > viewer")
	}
}

func TestMapPlanToRole(t *testing.T) {
	tests := []struct{ plan, want string }{
		{"team", "admin"},
		{"pro", "member"},
		{"free", "viewer"},
		{"", "viewer"},
	}
	for _, tt := range tests {
		if got := mapPlanToRole(tt.plan); got != tt.want {
			t.Errorf("mapPlanToRole(%q) = %q, want %q", tt.plan, got, tt.want)
		}
	}
}

func TestMapLegacyPermission(t *testing.T) {
	tests := []struct{ perm, want string }{
		{"billing:admin", "admin"},
		{"plugin:admin", "admin"},
		{"mcp:admin", "admin"},
		{"artifact:viewer", "read"},
		{"unknown:thing", ""},
		{"", ""},
	}
	for _, tt := range tests {
		if got := mapLegacyPermission(tt.perm); got != tt.want {
			t.Errorf("mapLegacyPermission(%q) = %q, want %q", tt.perm, got, tt.want)
		}
	}
}

func TestCheckResourcePermissionForUser(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	s := NewService(store)

	assign := func(wsID, role string) {
		t.Helper()
		err := store.UpsertWorkspaceRole(&storage.WorkspaceRole{
			ID: generateID(), WorkspaceID: wsID, UserID: user.ID, Role: role, AssignedBy: "seed",
		})
		if err != nil {
			t.Fatalf("UpsertWorkspaceRole: %v", err)
		}
	}

	assign("ws_owner", "owner")
	assign("ws_viewer", "viewer")

	tests := []struct {
		name       string
		resourceID string
		action     string
		want       bool
	}{
		{"owner can delete", "ws_owner", "delete", true},
		{"owner can manage members", "ws_owner", "manage_members", true},
		{"viewer can read", "ws_viewer", "read", true},
		{"viewer cannot write", "ws_viewer", "write", false},
		{"viewer cannot delete", "ws_viewer", "delete", false},
		{"no role denies read", "ws_unknown", "read", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := s.CheckResourcePermissionForUser(user.ID, "workspace", tt.resourceID, tt.action); got != tt.want {
				t.Fatalf("CheckResourcePermissionForUser(%s, %s) = %v, want %v", tt.resourceID, tt.action, got, tt.want)
			}
		})
	}
}

func TestGetUserWorkspaceRoleFallsBackToTeamMember(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	s := NewService(store)

	if err := store.CreateTeam(&storage.Team{ID: "team_ws", Name: "Team", OwnerID: user.ID, CreatedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddTeamMember(&storage.TeamMember{TeamID: "team_ws", UserID: user.ID, Role: "admin"}); err != nil {
		t.Fatal(err)
	}

	if got := s.getUserWorkspaceRole(user.ID, "team_ws"); got != "admin" {
		t.Fatalf("fallback role = %q, want admin", got)
	}
	// Explicit workspace role wins over team membership.
	_ = store.UpsertWorkspaceRole(&storage.WorkspaceRole{
		ID: generateID(), WorkspaceID: "team_ws", UserID: user.ID, Role: "viewer", AssignedBy: "seed",
	})
	if got := s.getUserWorkspaceRole(user.ID, "team_ws"); got != "viewer" {
		t.Fatalf("role = %q, want viewer (workspace_roles takes precedence)", got)
	}
}

// ---------- HTTP handler tests ----------

func newRBACRouter(t *testing.T, user *storage.User, store *storage.Store) *gin.Engine {
	t.Helper()
	r := testutil.NewAuthedRouter(user)
	s := NewService(store)
	r.POST("/api/rbac/check", s.CheckPermission)
	r.GET("/api/rbac/roles", s.GetRoles)
	r.GET("/api/account/permissions", s.GetPermissions)
	r.POST("/api/rbac/check-resource", s.CheckResourcePermission)
	r.POST("/api/rbac/assign-role", s.AssignRole)
	return r
}

func doJSON(t *testing.T, r *gin.Engine, method, path string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]any
	if w.Body.Len() > 0 {
		_ = json.Unmarshal(w.Body.Bytes(), &out)
	}
	return w, out
}

func TestCheckPermissionHandler(t *testing.T) {
	store := testutil.NewTestStore(t)

	tests := []struct {
		name       string
		plan       string
		permission string
		want       bool
	}{
		{"team plan has billing admin", "team", "billing:admin", true},
		{"free plan lacks billing admin", "free", "billing:admin", false},
		{"pro plan can read artifacts", "pro", "artifact:viewer", true},
		{"owner suffix always allowed", "free", "workspace:write:owner", true},
		{"unknown permission denied", "team", "nonexistent:perm", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &storage.User{ID: "user_" + tt.plan + "_" + tt.permission, Plan: tt.plan}
			r := newRBACRouter(t, user, store)
			w, out := doJSON(t, r, http.MethodPost, "/api/rbac/check",
				map[string]string{"permission": tt.permission})
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
			}
			if out["allowed"] != tt.want {
				t.Fatalf("allowed = %v, want %v", out["allowed"], tt.want)
			}
		})
	}

	t.Run("missing permission field is 400", func(t *testing.T) {
		user := &storage.User{ID: "u1", Plan: "free"}
		r := newRBACRouter(t, user, store)
		w, _ := doJSON(t, r, http.MethodPost, "/api/rbac/check", map[string]string{})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})
}

func TestGetRolesHandler(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)

	if err := store.CreateTeam(&storage.Team{ID: "team_1", Name: "T", OwnerID: user.ID, CreatedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddTeamMember(&storage.TeamMember{TeamID: "team_1", UserID: user.ID, Role: "owner"}); err != nil {
		t.Fatal(err)
	}

	r := newRBACRouter(t, user, store)
	w, out := doJSON(t, r, http.MethodGet, "/api/rbac/roles", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	roles, _ := out["roles"].([]any)
	joined := ""
	for _, v := range roles {
		joined += v.(string) + ","
	}
	for _, want := range []string{"user", "team:owner"} {
		found := false
		for _, v := range roles {
			if v.(string) == want {
				found = true
			}
		}
		if !found {
			t.Errorf("roles = %s, want to contain %q", joined, want)
		}
	}
}

func TestGetPermissionsHandler(t *testing.T) {
	store := testutil.NewTestStore(t)

	tests := []struct {
		plan     string
		mustHave []string
	}{
		{"free", []string{"workspace:read", "task:read", "task:write", "read"}},
		{"pro", []string{"cloud_sync", "billing:read"}},
		{"team", []string{"cloud_sync", "billing:admin", "team:write", "plugin:admin"}},
	}
	for _, tt := range tests {
		t.Run(tt.plan, func(t *testing.T) {
			user := &storage.User{ID: "user_plan_" + tt.plan, Plan: tt.plan}
			r := newRBACRouter(t, user, store)
			w, out := doJSON(t, r, http.MethodGet, "/api/account/permissions", nil)
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d", w.Code)
			}
			perms, _ := out["permissions"].([]any)
			set := map[string]bool{}
			for _, v := range perms {
				set[v.(string)] = true
			}
			for _, want := range tt.mustHave {
				if !set[want] {
					t.Errorf("plan %s permissions missing %q (got %v)", tt.plan, want, perms)
				}
			}
		})
	}
}

func TestCheckResourcePermissionHandler(t *testing.T) {
	store := testutil.NewTestStore(t)
	user := testutil.SeedTestUser(t, store)
	if err := store.UpsertWorkspaceRole(&storage.WorkspaceRole{
		ID: generateID(), WorkspaceID: "ws_1", UserID: user.ID, Role: "viewer", AssignedBy: "seed",
	}); err != nil {
		t.Fatal(err)
	}

	r := newRBACRouter(t, user, store)

	w, out := doJSON(t, r, http.MethodPost, "/api/rbac/check-resource", map[string]string{
		"resource_type": "workspace", "resource_id": "ws_1", "action": "read",
	})
	if w.Code != http.StatusOK || out["allowed"] != true {
		t.Fatalf("viewer read: status=%d allowed=%v, want 200/true", w.Code, out["allowed"])
	}

	w, out = doJSON(t, r, http.MethodPost, "/api/rbac/check-resource", map[string]string{
		"resource_type": "workspace", "resource_id": "ws_1", "action": "delete",
	})
	if w.Code != http.StatusOK || out["allowed"] != false {
		t.Fatalf("viewer delete: status=%d allowed=%v, want 200/false", w.Code, out["allowed"])
	}

	w, _ = doJSON(t, r, http.MethodPost, "/api/rbac/check-resource", map[string]string{
		"resource_type": "workspace",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("missing fields: status = %d, want 400", w.Code)
	}
}

func TestAssignRoleHandler(t *testing.T) {
	newSetup := func(t *testing.T, callerRole string) (*gin.Engine, *storage.User) {
		t.Helper()
		store := testutil.NewTestStore(t)
		caller := testutil.SeedTestUser(t, store)
		target := testutil.SeedSecondUser(t, store)
		if callerRole != "" {
			if err := store.UpsertWorkspaceRole(&storage.WorkspaceRole{
				ID: generateID(), WorkspaceID: "ws_1", UserID: caller.ID, Role: callerRole, AssignedBy: "seed",
			}); err != nil {
				t.Fatal(err)
			}
		}
		return newRBACRouter(t, caller, store), target
	}

	t.Run("owner assigns member", func(t *testing.T) {
		r, target := newSetup(t, "owner")
		w, out := doJSON(t, r, http.MethodPost, "/api/rbac/assign-role", map[string]string{
			"workspace_id": "ws_1", "user_id": target.ID, "role": "member",
		})
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
		}
		if out["role"] != "member" {
			t.Fatalf("role = %v, want member", out["role"])
		}
	})

	t.Run("owner cannot assign owner (equal rank)", func(t *testing.T) {
		r, target := newSetup(t, "owner")
		w, _ := doJSON(t, r, http.MethodPost, "/api/rbac/assign-role", map[string]string{
			"workspace_id": "ws_1", "user_id": target.ID, "role": "owner",
		})
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})

	t.Run("admin cannot assign admin (equal rank)", func(t *testing.T) {
		r, target := newSetup(t, "admin")
		w, _ := doJSON(t, r, http.MethodPost, "/api/rbac/assign-role", map[string]string{
			"workspace_id": "ws_1", "user_id": target.ID, "role": "admin",
		})
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})

	t.Run("member cannot assign (no manage_members)", func(t *testing.T) {
		r, target := newSetup(t, "member")
		w, _ := doJSON(t, r, http.MethodPost, "/api/rbac/assign-role", map[string]string{
			"workspace_id": "ws_1", "user_id": target.ID, "role": "viewer",
		})
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})

	t.Run("stranger without any role cannot assign", func(t *testing.T) {
		r, target := newSetup(t, "")
		w, _ := doJSON(t, r, http.MethodPost, "/api/rbac/assign-role", map[string]string{
			"workspace_id": "ws_1", "user_id": target.ID, "role": "viewer",
		})
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})

	t.Run("invalid role is 400", func(t *testing.T) {
		r, target := newSetup(t, "owner")
		w, _ := doJSON(t, r, http.MethodPost, "/api/rbac/assign-role", map[string]string{
			"workspace_id": "ws_1", "user_id": target.ID, "role": "superuser",
		})
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})
}

func TestGenerateIDIsUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		id := generateID()
		if len(id) != 32 {
			t.Fatalf("id length = %d, want 32 hex chars", len(id))
		}
		if seen[id] {
			t.Fatalf("duplicate id generated: %s", id)
		}
		seen[id] = true
	}
}
