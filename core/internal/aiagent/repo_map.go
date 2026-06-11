// GeoWork Go Core - Repository Map

package aiagent

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// RepoMap provides a lightweight snapshot of the repository structure.
// It is used to give the LLM awareness of project layout without loading
// every file's contents into the context.
type RepoMap struct {
	mu       sync.RWMutex
	roots    []string       // top-level directories to scan
	exclude  map[string]struct{} // dir/file basenames to skip
	entries  []RepoEntry
	loaded   bool
}

// RepoEntry is a single node in the repository tree.
type RepoEntry struct {
	Path     string // relative to repo root
	IsDir    bool
	Language string // derived from extension, e.g. "go", "python", "javascript"
	Size     int64  // 0 for directories
}

// DefaultExcludeDirs are common directories to skip when scanning.
var DefaultExcludeDirs = map[string]struct{}{
	".git": {}, "node_modules": {}, "vendor": {}, ".venv": {}, "venv": {},
	".tox": {}, "__pycache__": {}, ".idea": {}, ".vscode": {},
	"dist": {}, "build": {}, ".next": {}, ".nuxt": {}, ".output": {},
	".mypy_cache": {}, ".pytest_cache": {}, ".ruff_cache": {},
	".terraform": {}, ".cache": {}, "coverage": {}, ".eggs": {},
	"*.egg-info": {}, ".history": {}, ".DS_Store": {},
}

var DefaultExcludeExts = map[string]struct{}{
	".pyc": {}, ".pyo": {}, ".class": {}, ".jar": {}, ".so": {}, ".dll": {},
	".dylib": {}, ".o": {}, ".obj": {}, ".exe": {}, ".pdb": {},
	".map": {}, ".min.js": {}, ".min.css": {}, ".snap": {}, ".otf": {},
	".ttf": {}, ".woff": {}, ".woff2": {}, ".png": {}, ".jpg": {}, ".jpeg": {},
	".gif": {}, ".svg": {}, ".bmp": {},
}

// NewRepoMap creates a repo map scanner rooted at the given directories.
func NewRepoMap(roots []string) *RepoMap {
	return &RepoMap{
		roots:   roots,
		exclude: make(map[string]struct{}),
	}
}

// WithExcludeDirs adds directory names that should be skipped during scanning.
func (r *RepoMap) WithExcludeDirs(names ...string) *RepoMap {
	for _, n := range names {
		r.exclude[n] = struct{}{}
	}
	return r
}

// WithExcludeExts adds file extensions that should be skipped during scanning.
func (r *RepoMap) WithExcludeExts(exts ...string) *RepoMap {
	for _, ext := range exts {
		r.exclude[strings.ToLower(ext)] = struct{}{}
	}
	return r
}

// Load scans the repo and populates the entry list.
func (r *RepoMap) Load() ([]RepoEntry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var entries []RepoEntry
	skipDirs := make(map[string]struct{})
	for k := range DefaultExcludeDirs {
		skipDirs[k] = struct{}{}
	}
	for k := range r.exclude {
		skipDirs[k] = struct{}{}
	}
	skipExts := make(map[string]struct{})
	for k := range DefaultExcludeExts {
		skipExts[k] = struct{}{}
	}
	for k := range r.exclude {
		// If it starts with dot, treat as extension
		if strings.HasPrefix(k, ".") {
			skipExts[k] = struct{}{}
		}
	}

	for _, root := range r.roots {
		absRoot, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		err = filepath.Walk(absRoot, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil // skip errors
			}
			rel, err := filepath.Rel(absRoot, path)
			if err != nil {
				return nil
			}
			if rel == "." {
				return nil
			}

			// Skip excluded dirs
			if info.IsDir() {
				if _, skip := skipDirs[info.Name()]; skip {
					return filepath.SkipDir
				}
			} else {
				ext := strings.ToLower(filepath.Ext(info.Name()))
				if _, skip := skipExts[ext]; skip {
					return nil
				}
			}

			language := inferLanguage(info.Name(), info.IsDir())
			entries = append(entries, RepoEntry{
				Path:     rel,
				IsDir:    info.IsDir(),
				Language: language,
				Size:     info.Size(),
			})
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	r.entries = entries
	r.loaded = true
	return entries, nil
}

// FormatAsMarkdown renders the repo map as a Markdown tree.
func (r *RepoMap) FormatAsMarkdown(maxDepth int) string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if !r.loaded {
		return "# Repository Map (not loaded)"
	}

	var sb strings.Builder
	sb.WriteString("# Repository Map\n\n")

	// Group by top-level directory
	type entry struct {
		path string
		isDir bool
		language string
	}
	var grouped map[string][]entry
	if grouped == nil {
		grouped = make(map[string][]entry)
	}
	for _, e := range r.entries {
		parts := strings.Split(e.Path, string(filepath.Separator))
		top := parts[0]
		grouped[top] = append(grouped[top], entry{
			path: e.Path,
			isDir: e.IsDir,
			language: e.Language,
		})
	}

	for top, children := range grouped {
		sb.WriteString("## " + top + "\n\n")
		sb.WriteString("```\n")

		// Simple tree: up to maxDepth
		for _, c := range children {
			parts := strings.Split(c.path, string(filepath.Separator))
			depth := len(parts) - 1
			if depth > maxDepth {
				continue
			}
			indent := strings.Repeat("  ", depth)
			suffix := ""
			if c.language != "" {
				suffix = " [" + c.language + "]"
			}
			if c.isDir {
				sb.WriteString(indent + c.path + "/" + suffix + "\n")
			} else {
				sb.WriteString(indent + c.path + suffix + "\n")
			}
		}
		sb.WriteString("```\n\n")
	}

	return sb.String()
}

// FormatAsContext returns a compact representation suitable for LLM context.
func (r *RepoMap) FormatAsContext(maxFiles int) string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if !r.loaded {
		return ""
	}

	count := maxFiles
	if count <= 0 || count > len(r.entries) {
		count = len(r.entries)
	}

	var sb strings.Builder
	sb.WriteString("Project structure (top " + string(rune(count+'0')) + " files):\n")
	for i := 0; i < count; i++ {
		e := r.entries[i]
		suffix := ""
		if e.Language != "" {
			suffix = " (" + e.Language + ")"
		}
		prefix := "  "
		if e.IsDir {
			prefix = "/ "
		}
		sb.WriteString(prefix + e.Path + suffix + "\n")
	}

	return sb.String()
}

// inferLanguage returns a short language identifier based on the file name.
func inferLanguage(filename string, isDir bool) string {
	if isDir {
		return ""
	}
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".go":
		return "go"
	case ".py":
		return "python"
	case ".js", ".mjs", ".cjs":
		return "javascript"
	case ".ts", ".tsx", ".d.ts":
		return "typescript"
	case ".rs":
		return "rust"
	case ".java":
		return "java"
	case ".cs":
		return "csharp"
	case ".rb":
		return "ruby"
	case ".php":
		return "php"
	case ".cpp", ".cc", ".cxx":
		return "cpp"
	case ".c", ".h":
		return "c"
	case ".swift":
		return "swift"
	case ".kt":
		return "kotlin"
	case ".scala":
		return "scala"
	case ".sh", ".bash":
		return "shell"
	case ".ps1":
		return "powershell"
	case ".sql":
		return "sql"
	case ".html", ".htm":
		return "html"
	case ".css", ".scss", ".less":
		return "css"
	case ".json":
		return "json"
	case ".yaml", ".yml":
		return "yaml"
	case ".toml":
		return "toml"
	case ".md":
		return "markdown"
	case ".proto":
		return "protobuf"
	case ".vue", ".svelte":
		return "frontend"
	default:
		return ""
	}
}
