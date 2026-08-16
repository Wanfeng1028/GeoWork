// GeoWork Go Core - Safety Guardrails Tests

package safety

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultPolicy(t *testing.T) {
	ws := filepath.Join(t.TempDir(), "project")
	p := DefaultPolicy(ws)

	artifacts := filepath.Join(filepath.Dir(ws), "artifacts")
	if len(p.AllowedPaths) != 2 || p.AllowedPaths[0] != ws || p.AllowedPaths[1] != artifacts {
		t.Fatalf("AllowedPaths = %v, want [%s, %s]", p.AllowedPaths, ws, artifacts)
	}

	for _, blocked := range []string{"/etc", "/root", `C:\Windows`, `C:\Program Files`} {
		found := false
		for _, b := range p.BlockedPaths {
			if b == blocked {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("BlockedPaths missing %q", blocked)
		}
	}

	if want := int64(512 * 1024 * 1024); p.MaxArtifactSizeBytes != want {
		t.Errorf("MaxArtifactSizeBytes = %d, want %d", p.MaxArtifactSizeBytes, want)
	}
	if len(p.AllowedMIMETypes) == 0 {
		t.Error("AllowedMIMETypes is empty, want fixed whitelist")
	}
	for _, mime := range []string{"image/tiff", "application/json"} {
		found := false
		for _, m := range p.AllowedMIMETypes {
			if m == mime {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("AllowedMIMETypes missing %q", mime)
		}
	}
	if len(p.RequireApprovalForPaths) != 0 {
		t.Errorf("RequireApprovalForPaths = %v, want empty", p.RequireApprovalForPaths)
	}
}

// TestMatchesPathPrefix pins the separator-boundary semantics: a path is
// inside a prefix only when it equals the prefix or continues with a path
// separator. "/etcetera" must NOT match "/etc".
func TestMatchesPathPrefix(t *testing.T) {
	tests := []struct {
		abs    string
		prefix string
		want   bool
	}{
		{"/etc/passwd", "/etc", true},
		{"/etc", "/etc", true},
		{"/etcetera", "/etc", false},
		{"/et", "/etc", false},
		{`C:\work\file.txt`, `C:\work`, true},
		{`C:\work`, `C:\work`, true},
		{`C:\work-evil\file.txt`, `C:\work`, false},
		{"/a/b", "", false},
		{"", "/etc", false},
	}
	for _, tt := range tests {
		if got := pathMatchesPrefix(tt.abs, tt.prefix); got != tt.want {
			t.Errorf("pathMatchesPrefix(%q, %q) = %v, want %v", tt.abs, tt.prefix, got, tt.want)
		}
	}
}

func TestValidatePath(t *testing.T) {
	workspace := t.TempDir()
	outside := t.TempDir()
	sibling := workspace + "-evil"

	g := NewGuardrail(&Policy{
		AllowedPaths:            []string{workspace},
		BlockedPaths:            []string{filepath.Join(workspace, "secret")},
		RequireApprovalForPaths: []string{filepath.Join(workspace, "review")},
	})

	tests := []struct {
		name    string
		path    string
		wantErr string // substring; empty means the path is allowed
	}{
		{"file inside workspace", filepath.Join(workspace, "out.tif"), ""},
		{"nested file", filepath.Join(workspace, "a", "b", "out.tif"), ""},
		{"workspace root itself", workspace, ""},
		{"outside workspace", filepath.Join(outside, "out.tif"), "outside allowed"},
		{"sibling prefix of workspace", filepath.Join(sibling, "out.tif"), "outside allowed"},
		{"blocked dir itself", filepath.Join(workspace, "secret"), "blocked"},
		{"file in blocked dir", filepath.Join(workspace, "secret", "x.txt"), "blocked"},
		{"sibling prefix of blocked dir", filepath.Join(workspace, "secret-stuff", "x.txt"), ""},
		{"approval required dir", filepath.Join(workspace, "review", "x.txt"), "approval"},
		{"sibling prefix of approval dir", filepath.Join(workspace, "reviewed", "x.txt"), ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := g.ValidatePath(tt.path)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("ValidatePath(%q) = %v, want nil", tt.path, err)
				}
				return
			}
			if err == nil {
				t.Fatalf("ValidatePath(%q) = nil, want error containing %q", tt.path, tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("ValidatePath(%q) error = %q, want substring %q", tt.path, err.Error(), tt.wantErr)
			}
		})
	}
}

func TestValidatePathBlockedBeatsAllowed(t *testing.T) {
	workspace := t.TempDir()
	g := NewGuardrail(&Policy{
		AllowedPaths: []string{workspace},
		BlockedPaths: []string{filepath.Join(workspace, "secret")},
	})
	// Inside the allowed workspace AND inside the blocked subdir: blocked wins.
	if err := g.ValidatePath(filepath.Join(workspace, "secret", "x.txt")); err == nil {
		t.Fatal("blocked path inside allowed dir should be rejected")
	}
}

func TestValidateSize(t *testing.T) {
	g := NewGuardrail(&Policy{MaxArtifactSizeBytes: 100})

	tests := []struct {
		name    string
		size    int64
		wantErr bool
	}{
		{"under limit", 99, false},
		{"exactly at limit", 100, false},
		{"over limit", 101, true},
		{"zero size", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := g.ValidateSize(tt.size)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateSize(%d) = %v, wantErr %v", tt.size, err, tt.wantErr)
			}
		})
	}

	t.Run("zero limit means unlimited", func(t *testing.T) {
		unlimited := NewGuardrail(&Policy{MaxArtifactSizeBytes: 0})
		if err := unlimited.ValidateSize(1 << 40); err != nil {
			t.Fatalf("ValidateSize with zero limit = %v, want nil", err)
		}
	})
}

func TestValidateMimeType(t *testing.T) {
	g := NewGuardrail(&Policy{AllowedMIMETypes: []string{"image/tiff", "application/json"}})

	tests := []struct {
		mime    string
		wantErr bool
	}{
		{"image/tiff", false},
		{"application/json", false},
		{"image/png", true},
		{"image/tiffx", true}, // partial token must not match
		{"text/html", true},
	}
	for _, tt := range tests {
		t.Run(tt.mime, func(t *testing.T) {
			err := g.ValidateMimeType(tt.mime)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateMimeType(%q) = %v, wantErr %v", tt.mime, err, tt.wantErr)
			}
		})
	}

	t.Run("empty whitelist means unrestricted", func(t *testing.T) {
		open := NewGuardrail(&Policy{})
		if err := open.ValidateMimeType("application/x-anything"); err != nil {
			t.Fatalf("ValidateMimeType with empty whitelist = %v, want nil", err)
		}
	})

	t.Run("bare type entry allows subtree", func(t *testing.T) {
		open := NewGuardrail(&Policy{AllowedMIMETypes: []string{"image"}})
		if err := open.ValidateMimeType("image/png"); err != nil {
			t.Fatalf("ValidateMimeType(image/png) under image/* = %v, want nil", err)
		}
		if err := open.ValidateMimeType("text/html"); err == nil {
			t.Fatal("ValidateMimeType(text/html) under image/* should fail")
		}
	})
}

func TestValidateWrite(t *testing.T) {
	workspace := t.TempDir()
	g := NewGuardrail(&Policy{
		AllowedPaths:         []string{workspace},
		MaxArtifactSizeBytes: 100,
		AllowedMIMETypes:     []string{"image/tiff"},
	})
	ctx := context.Background()

	t.Run("all valid", func(t *testing.T) {
		err := g.ValidateWrite(ctx, filepath.Join(workspace, "new.tif"), 50, "image/tiff")
		if err != nil {
			t.Fatalf("ValidateWrite = %v, want nil", err)
		}
	})

	t.Run("path error wins", func(t *testing.T) {
		err := g.ValidateWrite(ctx, filepath.Join(t.TempDir(), "x.tif"), 999, "text/evil")
		if err == nil || !strings.Contains(err.Error(), "outside allowed") {
			t.Fatalf("ValidateWrite = %v, want path error first", err)
		}
	})

	t.Run("size error", func(t *testing.T) {
		err := g.ValidateWrite(ctx, filepath.Join(workspace, "big.tif"), 101, "image/tiff")
		if err == nil || !strings.Contains(err.Error(), "exceeds maximum") {
			t.Fatalf("ValidateWrite = %v, want size error", err)
		}
	})

	t.Run("mime error", func(t *testing.T) {
		err := g.ValidateWrite(ctx, filepath.Join(workspace, "x.bin"), 10, "application/x-binary")
		if err == nil || !strings.Contains(err.Error(), "MIME type") {
			t.Fatalf("ValidateWrite = %v, want MIME error", err)
		}
	})

	t.Run("existing file size on disk is enforced", func(t *testing.T) {
		path := filepath.Join(workspace, "existing.tif")
		if err := os.WriteFile(path, bytes.Repeat([]byte("a"), 200), 0o644); err != nil {
			t.Fatal(err)
		}
		// Declared size is fine, but the file already on disk exceeds the cap.
		err := g.ValidateWrite(ctx, path, 10, "image/tiff")
		if err == nil || !strings.Contains(err.Error(), "exceeds maximum") {
			t.Fatalf("ValidateWrite = %v, want on-disk size error", err)
		}
	})
}

func TestRoutes(t *testing.T) {
	workspace := t.TempDir()
	policy := DefaultPolicy(workspace)
	// doc/22 BP4: hosts whose TEMP lives under C:\Windows hit the
	// (now case-folding) OS blocklist with every fixture path; this
	// route test exercises wiring, not the OS blocklist.
	policy.BlockedPaths = []string{filepath.Join(workspace, "blocked-dir")}
	mux := http.NewServeMux()
	NewRoutes(NewGuardrail(policy), policy).Register(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	t.Run("GET policy", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/api/safety/policy")
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d, want 200", resp.StatusCode)
		}
		var got Policy
		if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		if len(got.AllowedPaths) == 0 || got.AllowedPaths[0] != workspace {
			t.Fatalf("AllowedPaths = %v, want first entry %s", got.AllowedPaths, workspace)
		}
	})

	validate := func(t *testing.T, body string) (int, map[string]any) {
		t.Helper()
		resp, err := http.Post(srv.URL+"/api/safety/validate", "application/json", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode, out
	}

	t.Run("validate allowed write", func(t *testing.T) {
		// doc/22 BP4: on hosts whose TEMP resolves under C:\Windows the
		// (now case-folding) OS blocklist would swallow the fixture;
		// this route test exercises allow/deny wiring, not the blocklist.
		path := filepath.Join(workspace, "out.tif")
		body, _ := json.Marshal(map[string]any{"path": path, "size": 10, "mimeType": "image/tiff"})
		status, out := validate(t, string(body))
		if status != http.StatusOK {
			t.Fatalf("status = %d, want 200", status)
		}
		if out["allowed"] != true {
			t.Fatalf("allowed = %v, want true (resp=%v)", out["allowed"], out)
		}
		if _, hasErr := out["error"]; hasErr {
			t.Fatalf("unexpected error field: %v", out)
		}
	})

	t.Run("validate rejected write", func(t *testing.T) {
		outsidePath := filepath.Join(t.TempDir(), "out.tif")
		body, _ := json.Marshal(map[string]any{"path": outsidePath, "size": 10, "mimeType": "image/tiff"})
		status, out := validate(t, string(body))
		if status != http.StatusOK {
			t.Fatalf("status = %d, want 200 with allowed=false", status)
		}
		if out["allowed"] != false {
			t.Fatalf("allowed = %v, want false", out["allowed"])
		}
		if msg, _ := out["error"].(string); msg == "" {
			t.Fatal("error message missing on rejection")
		}
	})

	t.Run("validate malformed body", func(t *testing.T) {
		status, out := validate(t, "{not json")
		if status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", status)
		}
		if out["error"] == nil {
			t.Fatal("error message missing on 400")
		}
	})
}

// doc/22 BP4 / S5: symlink escape and Windows case-folding regressions.

func TestValidatePath_SymlinkEscape(t *testing.T) {
	ws := t.TempDir()
	outside := t.TempDir() // a second root the policy does not allow
	// BlockedPaths narrowed to a specific outside dir: on hosts whose
	// TEMP lives under C:\Windows the OS-wide blocklist would swallow
	// every fixture path once case-folding is enabled (doc/22 BP4).
	g := NewGuardrail(&Policy{
		AllowedPaths: []string{ws},
		BlockedPaths: []string{filepath.Join(outside, "secret")},
	})

	link := filepath.Join(ws, "escape-link")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink creation unavailable on this host: %v", err)
	}
	target := filepath.Join(link, "evil.txt")

	if err := g.ValidatePath(target); err == nil {
		t.Fatalf("symlink pointing outside allowed roots must be rejected")
	}
	// Direct outside path stays rejected (control).
	if err := g.ValidatePath(filepath.Join(outside, "direct.txt")); err == nil {
		t.Fatalf("direct outside path must be rejected")
	}
	// A plain in-workspace path that does not exist yet stays allowed
	// (resolveSymlinksSafe handles the missing leaf).
	if err := g.ValidatePath(filepath.Join(ws, "new", "file.txt")); err != nil {
		t.Fatalf("missing in-workspace path should be allowed: %v", err)
	}
}

func TestValidatePath_WindowsCaseFolding(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("case-folding is a Windows-specific bypass")
	}
	ws := t.TempDir()
	// A blocklist entry stored in UPPER case must catch the lower-cased
	// variant of the same directory (and vice versa) — previously
	// "c:\windows" bypassed "C:\Windows" (doc/22 BP4 / S5).
	g := NewGuardrail(&Policy{
		AllowedPaths: []string{ws},
		BlockedPaths: []string{strings.ToUpper(filepath.Join(ws, "secret"))},
	})

	if err := g.ValidatePath(filepath.Join(ws, "x.tif")); err != nil {
		t.Fatalf("plain in-workspace path must stay allowed: %v", err)
	}
	lowered := strings.ToLower(filepath.Join(ws, "secret", "x.tif"))
	if err := g.ValidatePath(lowered); err == nil {
		t.Fatalf("case-variant of a blocked path must be rejected")
	}
}
