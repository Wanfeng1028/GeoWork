// GeoWork Go Core - Built-in Tools

package toolregistry

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"go.uber.org/zap"

	"geowork/core/internal/idgen"
	"geowork/core/internal/sandbox"
)

// builtinToolMemLimitMB caps per-process committed memory for the
// model-driven run_shell / run_python tools (doc/25 W1). Matches the
// sandbox Service's default policy; enforced on Windows via the job
// object, honestly unenforced on Unix.
const builtinToolMemLimitMB = 512

// runSandboxed executes a command under the unified sandbox spawn
// (doc/25 W1) and returns stdout, stderr, and the exit code. It is the
// single choke point for the model-driven run_shell / run_python tools,
// so both share the Job Object / process-group tree-kill. Before this,
// these tools spawned with no SysProcAttr at all, so a timeout killed
// only the direct child and grandchildren escaped.
func runSandboxed(ctx context.Context, log *zap.Logger, cfg sandbox.SpawnConfig) (string, string, int) {
	var stdout, stderr bytes.Buffer
	cfg.Ctx = ctx
	cfg.Stdout = &stdout
	cfg.Stderr = &stderr
	cmd, cleanup, err := sandbox.Spawn(cfg, log)
	if err != nil {
		return "", err.Error(), -1
	}
	waitErr := cmd.Wait()
	cleanup()
	exitCode := 0
	if waitErr != nil {
		var exitErr *exec.ExitError
		if errors.As(waitErr, &exitErr) {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
			stderr.WriteString(waitErr.Error())
		}
	}
	return stdout.String(), stderr.String(), exitCode
}

// workspaceDirKey is the context key for the workspace directory used by
// git tools. doc/22 BP5: aliased onto workspaceKey (context.go) so
// WithWorkspaceDir and WithWorkspacePath address the SAME value — the
// orchestrator injects via WithWorkspacePath; previously git tools read a
// different key and silently fell back to ".".
type workspaceDirKey = workspaceKey

// WithWorkspaceDir attaches a workspace directory to the context for git tools.
func WithWorkspaceDir(ctx context.Context, dir string) context.Context {
	return context.WithValue(ctx, workspaceDirKey{}, dir)
}

// RegisterBuiltinTools registers all built-in tools to the registry.
func RegisterBuiltinTools(reg *Registry) error {
	tools := []Tool{
		NewBuilder("read_file").
			Description("Read the contents of a file at the given path.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{"type": "string", "description": "File path to read"},
				},
				"required": []string{"path"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"content": map[string]any{"type": "string"},
					"path":    map[string]any{"type": "string"},
					"size":    map[string]any{"type": "integer"},
				},
			}).
			Permission("read").
			RiskLevel("low").
			// doc/22 BP5: reads are also confined to the sandbox roots
			// when configured — an unconstrained read_file could exfiltrate
			// any file on disk into the model context.
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				path, ok := args["path"].(string)
				if !ok {
					return nil, fmt.Errorf("path must be a string")
				}
				data, err := os.ReadFile(filepath.Clean(path))
				if err != nil {
					return nil, err
				}
				info, _ := os.Stat(filepath.Clean(path))
				return map[string]any{
					"content": string(data),
					"path":    path,
					"size":    info.Size(),
				}, nil
			}).
			Build(),

		NewBuilder("write_file").
			Description("Write content to a file at the given path.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path":    map[string]any{"type": "string", "description": "File path to write"},
					"content": map[string]any{"type": "string", "description": "Content to write"},
				},
				"required": []string{"path", "content"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path":    map[string]any{"type": "string"},
					"written": map[string]any{"type": "integer"},
				},
			}).
			Permission("write").
			RiskLevel("medium").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				path, _ := args["path"].(string)
				content, _ := args["content"].(string)
				clean := filepath.Clean(path)
				// doc/23 A4: capture the pre-write content so the
				// orchestrator can emit a diff.created event. A missing
				// file reads as "" (new-file diff).
				oldBytes, _ := os.ReadFile(clean)
				if err := os.MkdirAll(filepath.Dir(clean), 0755); err != nil {
					return nil, err
				}
				if err := os.WriteFile(clean, []byte(content), 0644); err != nil {
					return nil, err
				}
				ReportDiff(ctx, DiffRecord{
					Path:       path,
					OldContent: string(oldBytes),
					NewContent: content,
				})
				return map[string]any{"path": path, "written": len(content)}, nil
			}).
			Build(),

		NewBuilder("list_files").
			Description("List files and directories at the given path.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{"type": "string", "description": "Directory path to list"},
				},
				"required": []string{"path"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"files": map[string]any{
						"type": "array",
						"items": map[string]any{"type": "object", "properties": map[string]any{
							"name":  map[string]any{"type": "string"},
							"isDir": map[string]any{"type": "boolean"},
							"size":  map[string]any{"type": "integer"},
						}},
					},
				},
			}).
			Permission("read").
			RiskLevel("low").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				path, _ := args["path"].(string)
				entries, err := os.ReadDir(filepath.Clean(path))
				if err != nil {
					return nil, err
				}
				files := make([]map[string]any, len(entries))
				for i, e := range entries {
					info, _ := e.Info()
					files[i] = map[string]any{
						"name":  e.Name(),
						"isDir": e.IsDir(),
						"size":  info.Size(),
					}
				}
				return map[string]any{"files": files}, nil
			}).
			Build(),

		NewBuilder("search_workspace").
			Description("Search for files in the workspace matching a pattern.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"pattern": map[string]any{"type": "string", "description": "Glob pattern to search"},
					"root":    map[string]any{"type": "string", "description": "Root directory"},
				},
				"required": []string{"pattern"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"matches": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				},
			}).
			Permission("read").
			RiskLevel("low").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				pattern, _ := args["pattern"].(string)
				root, _ := args["root"].(string)
				if root == "" {
					root = "."
				}
				var matches []string
				filepath.Walk(filepath.Clean(root), func(path string, info os.FileInfo, err error) error {
					if err != nil {
						return nil
					}
					matched, _ := filepath.Match(pattern, info.Name())
					if matched {
						matches = append(matches, path)
					}
					return nil
				})
				if matches == nil {
					matches = []string{}
				}
				return map[string]any{"matches": matches}, nil
			}).
			Build(),

		NewBuilder("run_python").
			Description("Execute a Python script in the workspace sandbox.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"script": map[string]any{"type": "string", "description": "Python code to execute"},
					"args":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				},
				"required": []string{"script"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"stdout": map[string]any{"type": "string"},
					"stderr": map[string]any{"type": "string"},
					"exit":   map[string]any{"type": "integer"},
				},
			}).
			Permission("exec").
			RiskLevel("high").
			Sandbox(true).
			Streaming(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				script, _ := args["script"].(string)
				pythonCmd := "python3"
				if runtime.GOOS == "windows" {
					pythonCmd = "python"
				}
				// doc/22 BP1: pin execution to the run's workspace so
				// relative paths resolve inside the sandbox boundary.
				dir := WorkspacePathFromContext(ctx)
				// doc/25 W1: unified sandbox spawn (Job Object / process
				// group) so a timeout kills the whole tree, not just the
				// direct child.
				stdout, stderr, exitCode := runSandboxed(ctx, reg.log, sandbox.SpawnConfig{
					Name:       pythonCmd,
					Args:       []string{"-c", script},
					Dir:        dir,
					MemLimitMB: builtinToolMemLimitMB,
				})
				return map[string]any{
					"stdout": stdout,
					"stderr": stderr,
					"exit":   exitCode,
				}, nil
			}).
			Build(),

		NewBuilder("run_shell").
			Description("Execute a shell command in the workspace sandbox.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"command": map[string]any{"type": "string", "description": "Shell command to execute"},
				},
				"required": []string{"command"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"stdout": map[string]any{"type": "string"},
					"stderr": map[string]any{"type": "string"},
					"exit":   map[string]any{"type": "integer"},
				},
			}).
			Permission("exec").
			RiskLevel("critical").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				command, _ := args["command"].(string)
				var name string
				var shellArgs []string
				if runtime.GOOS == "windows" {
					name, shellArgs = "cmd", []string{"/C", command}
				} else {
					name, shellArgs = "sh", []string{"-c", command}
				}
				// doc/22 BP1 / F5: pin the shell to the run's workspace —
				// relative paths and bare filenames resolve inside the
				// sandbox boundary instead of the process cwd.
				dir := WorkspacePathFromContext(ctx)
				// doc/25 W1: unified sandbox spawn (Job Object / process
				// group) so a timeout kills the whole tree, not just the
				// direct child.
				stdout, stderr, exitCode := runSandboxed(ctx, reg.log, sandbox.SpawnConfig{
					Name:       name,
					Args:       shellArgs,
					Dir:        dir,
					MemLimitMB: builtinToolMemLimitMB,
				})
				return map[string]any{
					"stdout": stdout,
					"stderr": stderr,
					"exit":   exitCode,
				}, nil
			}).
			Build(),

		NewBuilder("create_artifact").
			Description("Create a project artifact (file output) in the workspace.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"name":      map[string]any{"type": "string"},
					"path":      map[string]any{"type": "string"},
					"type":      map[string]any{"type": "string"},
					"mime_type": map[string]any{"type": "string"},
				},
				"required": []string{"name", "path", "type"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"id":   map[string]any{"type": "string"},
					"name": map[string]any{"type": "string"},
					"path": map[string]any{"type": "string"},
				},
			}).
			Permission("write").
			RiskLevel("medium").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				name, _ := args["name"].(string)
				path, _ := args["path"].(string)
				content, hasContent := args["content"].(string)
				// doc/22 BP5: create_artifact previously returned a fake
				// empty-id record without touching the filesystem — the
				// model believed artifacts existed. Now the file is
				// really created inside the workspace (content optional
				// for binary-oriented flows where the writer is another
				// tool).
				if path == "" {
					return nil, fmt.Errorf("create_artifact: path is required")
				}
				dir := WorkspacePathFromContext(ctx)
				full := path
				if dir != "" && !filepath.IsAbs(path) {
					full = filepath.Join(dir, path)
				}
				if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
					return nil, err
				}
				if hasContent {
					// doc/23 A4: capture pre-write content for diff.created.
					oldBytes, _ := os.ReadFile(full)
					if err := os.WriteFile(full, []byte(content), 0644); err != nil {
						return nil, err
					}
					ReportDiff(ctx, DiffRecord{
						Path:       full,
						OldContent: string(oldBytes),
						NewContent: content,
					})
				} else {
					f, err := os.OpenFile(full, os.O_CREATE|os.O_WRONLY, 0644)
					if err != nil {
						return nil, err
					}
					_ = f.Close()
				}
				id := idgen.NewPrefixed("art_")
				return map[string]any{
					"id":      id,
					"name":    name,
					"path":    full,
					"created": true,
				}, nil
			}).
			Build(),

		NewBuilder("delete_file").
			Description("Delete a file at the given path.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{"type": "string", "description": "File path to delete"},
				},
				"required": []string{"path"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path":    map[string]any{"type": "string"},
					"deleted": map[string]any{"type": "boolean"},
				},
			}).
			Permission("delete").
			RiskLevel("high").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				path, _ := args["path"].(string)
				if err := os.Remove(filepath.Clean(path)); err != nil {
					return nil, err
				}
				return map[string]any{"path": path, "deleted": true}, nil
			}).
			Build(),

		NewBuilder("git_commit").
			Description("Commit changes in the workspace repository using git.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"message": map[string]any{"type": "string", "description": "Commit message"},
					"addAll":  map[string]any{"type": "boolean", "description": "Add all changes"},
				},
				"required": []string{"message"},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"hash": map[string]any{"type": "string"},
				},
			}).
			Permission("exec").
			RiskLevel("high").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				message, _ := args["message"].(string)
				addAll, _ := args["addAll"].(bool)

				workspaceDir, _ := ctx.Value(workspaceDirKey{}).(string)
				if workspaceDir == "" {
					workspaceDir = "."
				}

				if addAll {
					addCmd := exec.CommandContext(ctx, "git", "add", "-A")
					addCmd.Dir = workspaceDir
					if out, err := addCmd.CombinedOutput(); err != nil {
						return nil, fmt.Errorf("git add failed: %s: %w", string(out), err)
					}
				}

				cmd := exec.CommandContext(ctx, "git", "commit", "-m", message)
				cmd.Dir = workspaceDir
				output, err := cmd.CombinedOutput()
				if err != nil {
					return nil, fmt.Errorf("git commit failed: %s: %w", strings.TrimSpace(string(output)), err)
				}

				// Extract commit hash
				hashCmd := exec.CommandContext(ctx, "git", "rev-parse", "HEAD")
				hashCmd.Dir = workspaceDir
				hash, _ := hashCmd.Output()

				return map[string]any{"hash": strings.TrimSpace(string(hash))}, nil
			}).
			Build(),

		NewBuilder("git_push").
			Description("Push committed changes to the remote repository using git.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"remote": map[string]any{"type": "string"},
					"branch": map[string]any{"type": "string"},
					"force":  map[string]any{"type": "boolean"},
				},
				"required": []string{},
			}).
			OutputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"success": map[string]any{"type": "boolean"},
				},
			}).
			Permission("exec").
			RiskLevel("critical").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				force, _ := args["force"].(bool)
				if force {
					return nil, fmt.Errorf("git push --force is explicitly blocked")
				}
				return map[string]any{"success": false}, fmt.Errorf("git push is blocked by default policy")
			}).
			Build(),

		NewBuilder("run_git_add").
			Description("Stage files for git commit. Equivalent to 'git add'.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path": map[string]any{"type": "string", "description": "File or directory path"},
				},
				"required": []string{"path"},
			}).
			Permission("exec").
			RiskLevel("high").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				// doc/22 BP5: run_git_add previously did nothing and
				// reported staged:0 — the model then committed nothing
				// while believing files were staged.
				path, _ := args["path"].(string)
				if path == "" {
					path = "."
				}
				workspaceDir, _ := ctx.Value(workspaceDirKey{}).(string)
				if workspaceDir == "" {
					workspaceDir = "."
				}
				cmd := exec.CommandContext(ctx, "git", "add", "--", path)
				cmd.Dir = workspaceDir
				out, err := cmd.CombinedOutput()
				if err != nil {
					return nil, fmt.Errorf("git add failed: %s: %w", strings.TrimSpace(string(out)), err)
				}
				return map[string]any{"staged": true, "path": path}, nil
			}).
			Build(),

		NewBuilder("run_git_reset").
			Description("Reset git state. Equivalent to 'git reset --hard'.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"hard": map[string]any{"type": "boolean"},
				},
			}).
			Permission("exec").
			RiskLevel("critical").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				hard, _ := args["hard"].(bool)
				if hard {
					return nil, fmt.Errorf("git reset --hard is explicitly blocked")
				}
				return map[string]any{}, nil
			}).
			Build(),

		NewBuilder("scan_folder").
			Description("Recursively scan a folder and list all files with metadata.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"path":     map[string]any{"type": "string"},
					"maxDepth": map[string]any{"type": "integer"},
					"pattern":  map[string]any{"type": "string"},
				},
				"required": []string{"path"},
			}).
			Permission("read").
			RiskLevel("medium").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				path, _ := args["path"].(string)
				var files []map[string]any
				filepath.Walk(filepath.Clean(path), func(p string, info os.FileInfo, err error) error {
					if err != nil || info.IsDir() {
						return nil
					}
					files = append(files, map[string]any{
						"path": p,
						"size": info.Size(),
						"name": info.Name(),
					})
					return nil
				})
				if files == nil {
					files = []map[string]any{}
				}
				return map[string]any{"files": files}, nil
			}).
			Build(),
	}

	for _, t := range tools {
		if err := reg.Register(t); err != nil {
			return err
		}
	}
	return nil
}
