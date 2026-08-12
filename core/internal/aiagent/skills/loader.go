// GeoWork Go Core - Skills Loader (P2-1)
//
// Two-phase loader matching main doc §7.3:
//   - LoadAllMeta(): scan rootDir/<skill-id>/manifest/meta.json, build
//     the index. Cheap; runs at startup.
//   - LoadFullContent(skill): read rootDir/<skill-id>/skill/SKILL.md
//     on demand. Cached on skill.Loaded.
//
// Skills directory layout (per main doc §7.1):
//   skills/
//   ├── gis-analysis/
//   │   ├── manifest/
//   │   │   ├── README.md
//   │   │   └── meta.json
//   │   └── skill/
//   │       └── SKILL.md
//   └── paper-writing/ ...
//
// If the directory is missing or empty, the loader returns an empty
// slice and a nil error — skills are optional, not a hard dependency.

package skills

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"go.uber.org/zap"
)

// Loader scans a skills directory and populates a Registry.
type Loader struct {
	rootDir string
	log     *zap.Logger
}

func NewLoader(rootDir string, log *zap.Logger) *Loader {
	if log == nil {
		log = zap.NewNop()
	}
	return &Loader{rootDir: rootDir, log: log}
}

// LoadAllMeta scans rootDir and reads each skill's manifest/meta.json.
// Returns the list of skills (phase-1 only: Prompt is empty, Loaded=false).
// Missing/invalid skills are skipped with a warning, not fatal.
func (l *Loader) LoadAllMeta() ([]*Skill, error) {
	entries, err := os.ReadDir(l.rootDir)
	if err != nil {
		if os.IsNotExist(err) {
			l.log.Info("skills dir does not exist; skipping skill load",
				zap.String("dir", l.rootDir))
			return nil, nil
		}
		return nil, fmt.Errorf("read skills dir %q: %w", l.rootDir, err)
	}

	var out []*Skill
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		skillDir := filepath.Join(l.rootDir, entry.Name())
		meta, err := l.readMeta(skillDir)
		if err != nil {
			l.log.Warn("failed to load skill meta; skipping",
				zap.String("skill", entry.Name()),
				zap.Error(err))
			continue
		}
		out = append(out, &Skill{
			Meta: meta,
			Dir:  skillDir,
		})
	}
	return out, nil
}

// LoadFullContent reads SKILL.md for one skill and caches it on the
// struct (phase 2). Idempotent: re-calling on an already-loaded skill
// is a no-op.
func (l *Loader) LoadFullContent(s *Skill) error {
	if s == nil {
		return fmt.Errorf("nil skill")
	}
	if s.Loaded {
		return nil
	}
	skillMDPath := filepath.Join(s.Dir, "skill", "SKILL.md")
	data, err := os.ReadFile(skillMDPath)
	if err != nil {
		// Missing SKILL.md is non-fatal — the skill still has its meta
		// and can be listed; it just has no prompt to inject.
		l.log.Warn("SKILL.md missing; skill will have empty prompt",
			zap.String("skill", s.Meta.ID),
			zap.String("path", skillMDPath),
			zap.Error(err))
		s.Prompt = ""
		s.Loaded = true
		return nil
	}
	s.Prompt = string(data)
	s.Loaded = true
	return nil
}

// LoadAllInto loads all skills from rootDir into the registry, performing
// both phase 1 (meta) and phase 2 (full content) in one shot. Used at
// startup when we want everything immediately available. For lazy
// loading, call LoadAllMeta then LoadFullContent on demand.
func (l *Loader) LoadAllInto(reg *Registry) (int, error) {
	skills, err := l.LoadAllMeta()
	if err != nil {
		return 0, err
	}
	for _, s := range skills {
		if err := l.LoadFullContent(s); err != nil {
			l.log.Warn("LoadFullContent failed; registering meta-only",
				zap.String("skill", s.Meta.ID),
				zap.Error(err))
		}
		reg.RegisterOrReplace(s)
	}
	return len(skills), nil
}

// readMeta reads and parses one skill's manifest/meta.json.
func (l *Loader) readMeta(skillDir string) (SkillMeta, error) {
	metaPath := filepath.Join(skillDir, "manifest", "meta.json")
	data, err := os.ReadFile(metaPath)
	if err != nil {
		return SkillMeta{}, fmt.Errorf("read meta.json: %w", err)
	}
	var meta SkillMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return SkillMeta{}, fmt.Errorf("parse meta.json: %w", err)
	}
	if meta.ID == "" {
		// Fall back to the directory name if meta.json omits id.
		meta.ID = filepath.Base(skillDir)
	}
	return meta, nil
}
