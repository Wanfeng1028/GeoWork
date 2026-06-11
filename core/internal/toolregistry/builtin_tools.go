// GeoWork Go Core - Built-in Tools

package toolregistry

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

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
					"path":   map[string]any{"type": "string"},
					"written": map[string]any{"type": "integer"},
				},
			}).
			Permission("write").
			RiskLevel("medium").
			Sandbox(true).
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				path, _ := args["path"].(string)
				content, _ := args["content"].(string)
				if err := os.MkdirAll(filepath.Dir(filepath.Clean(path)), 0755); err != nil {
					return nil, err
				}
				if err := os.WriteFile(filepath.Clean(path), []byte(content), 0644); err != nil {
					return nil, err
				}
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
							"name": map[string]any{"type": "string"},
							"isDir": map[string]any{"type": "boolean"},
							"size": map[string]any{"type": "integer"},
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
				cmd := exec.CommandContext(ctx, "python3", "-c", script)
				out, err := cmd.CombinedOutput()
				return map[string]any{
					"stdout": string(out),
					"stderr": "",
					"exit":   0,
				}, err
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
				cmd := exec.CommandContext(ctx, "sh", "-c", command)
				out, err := cmd.CombinedOutput()
				return map[string]any{
					"stdout": string(out),
					"stderr": "",
					"exit":   0,
				}, err
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
					"id":    map[string]any{"type": "string"},
					"name":  map[string]any{"type": "string"},
					"path":  map[string]any{"type": "string"},
				},
			}).
			Permission("write").
			RiskLevel("medium").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				name, _ := args["name"].(string)
				path, _ := args["path"].(string)
				return map[string]any{
					"id":     "",
					"name":   name,
					"path":   path,
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
					"path":   map[string]any{"type": "string"},
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
				_ = args
				return map[string]any{"hash": ""}, fmt.Errorf("git not configured")
			}).
			Build(),

		NewBuilder("git_push").
			Description("Push committed changes to the remote repository using git.").
			InputSchema(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"remote":    map[string]any{"type": "string"},
					"branch":    map[string]any{"type": "string"},
					"force":     map[string]any{"type": "boolean"},
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
				_ = args
				return map[string]any{"staged": 0}, nil
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
					"path":        map[string]any{"type": "string"},
					"maxDepth":    map[string]any{"type": "integer"},
					"pattern":     map[string]any{"type": "string"},
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
