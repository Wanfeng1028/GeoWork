// GeoWork Go Core - Agent Planner

package aiagent

import (
	"fmt"
	"strings"

	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// modePrompts defines default prompts and tool sets for each mode.
type modePrompt struct {
	Prompt    string
	Tools     []string
	MaxSteps  int
}

var modeConfigs = map[string]modePrompt{
	"Work": {
		Prompt: "You are a GIS research assistant. Help the user analyze geospatial data and generate reports.",
		Tools:  []string{"read_file", "write_file", "list_files", "search_workspace", "create_artifact"},
		MaxSteps: 20,
	},
	"Code": {
		Prompt: "You are a code assistant. Help the user write, debug, and manage code.",
		Tools:  []string{"read_file", "write_file", "run_shell", "run_python", "search_workspace", "create_artifact"},
		MaxSteps: 30,
	},
	"Paper": {
		Prompt: "You are a research paper assistant. Help search, read, and write academic papers.",
		Tools:  []string{"read_file", "write_file", "list_files", "search_workspace", "create_artifact"},
		MaxSteps: 15,
	},
	"Analysis": {
		Prompt: "You are a spatial analysis assistant. Help analyze geospatial data and generate insights.",
		Tools:  []string{"read_file", "run_python", "list_files", "search_workspace", "create_artifact"},
		MaxSteps: 25,
	},
	"Write": {
		Prompt: "You are a writing assistant. Help compose documents, reports, and presentations.",
		Tools:  []string{"read_file", "write_file", "list_files", "create_artifact"},
		MaxSteps: 15,
	},
}

// Planner generates task plans based on mode and user prompt.
type Planner struct {
	log    *zap.Logger
	registry *toolregistry.Registry
}

func NewPlanner(log *zap.Logger) *Planner {
	return &Planner{log: log}
}

// Plan generates a step-by-step plan for a given mode and prompt.
func (p *Planner) Plan(mode, prompt string) ([]Step, error) {
	config, ok := modeConfigs[mode]
	if !ok {
		config = modeConfigs["Work"]
	}

	// Detect GIS-specific keywords
	promptLower := strings.ToLower(prompt)
	isGIS := strings.Contains(promptLower, "gis") ||
		strings.Contains(promptLower, "shapefile") ||
		strings.Contains(promptLower, "raster") ||
		strings.Contains(promptLower, "vector") ||
		strings.Contains(promptLower, "buffer") ||
		strings.Contains(promptLower, "投影") ||
		strings.Contains(promptLower, "裁剪") ||
		strings.Contains(promptLower, "缓冲") ||
		strings.Contains(promptLower, "地图")

	// Detect NDVI/spectral keywords
	isRemoteSensing := strings.Contains(promptLower, "ndvi") ||
		strings.Contains(promptLower, "sentinel") ||
		strings.Contains(promptLower, "landsat") ||
		strings.Contains(promptLower, "光谱") ||
		strings.Contains(promptLower, "遥感")

	steps := []Step{}

	// Step 1: Understand the data
	if isGIS || isRemoteSensing {
		steps = append(steps, Step{
			ID:    fmt.Sprintf("step_%d", len(steps)+1),
			Title: "检查数据源",
			Tool:  "read_file",
			Args:  `{"path": "data/"}`,
			Status: "pending",
		})
	}

	// Step 2: Plan the analysis
	if isGIS {
		steps = append(steps, Step{
			ID:    fmt.Sprintf("step_%d", len(steps)+1),
			Title: "规划GIS处理流程",
			Tool:  "run_python",
			Args:  `{"script": "print('Planning GIS workflow...')"}`,
			Status: "pending",
		})
	}

	if isRemoteSensing {
		steps = append(steps, Step{
			ID:    fmt.Sprintf("step_%d", len(steps)+1),
			Title: "生成遥感分析脚本",
			Tool:  "run_python",
			Args:  `{"script": "print('Generating remote sensing script...')"}`,
			Status: "pending",
		})
	}

	// Step 3: Execute
	steps = append(steps, Step{
		ID:    fmt.Sprintf("step_%d", len(steps)+1),
		Title: "执行分析任务",
		Tool:  "run_python",
		Args:  `{"script": "print('Executing analysis...')"}`,
		Status: "pending",
	})

	// Step 4: Generate artifacts
	steps = append(steps, Step{
		ID:    fmt.Sprintf("step_%d", len(steps)+1),
		Title: "生成分析报告",
		Tool:  "write_file",
		Args:  `{"path": "output/report.md", "content": "# Analysis Report"}`,
		Status: "pending",
	})

	// Limit to max steps
	if len(steps) > config.MaxSteps {
		steps = steps[:config.MaxSteps]
	}

	p.log.Info("planned steps",
		zap.String("mode", mode),
		zap.Int("steps", len(steps)),
		zap.Bool("gis", isGIS),
		zap.Bool("remoteSensing", isRemoteSensing),
	)

	return steps, nil
}

// BuildSystemPrompt constructs a system prompt from the mode config and memory.
func (p *Planner) BuildSystemPrompt(mode, memory string) string {
	config, ok := modeConfigs[mode]
	if !ok {
		config = modeConfigs["Work"]
	}

	prompt := config.Prompt
	if memory != "" {
		prompt += "\n\nPrevious context:\n" + memory
	}
	return prompt
}
