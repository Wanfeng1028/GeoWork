// GeoWork Go Core - Agent Planner

package aiagent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// modePrompts defines default prompts and tool sets for each mode.
type modePrompt struct {
	Prompt   string
	Tools    []string
	MaxSteps int
}

var modeConfigs = map[string]modePrompt{
	"Work": {
		Prompt:   "You are a GIS research assistant. Help the user analyze geospatial data and generate reports.",
		Tools:    []string{"read_file", "write_file", "list_files", "search_workspace", "create_artifact"},
		MaxSteps: 20,
	},
	"Code": {
		Prompt:   "You are a code assistant. Help the user write, debug, and manage code.",
		Tools:    []string{"read_file", "write_file", "run_shell", "run_python", "search_workspace", "create_artifact"},
		MaxSteps: 30,
	},
	"Paper": {
		Prompt:   "You are a research paper assistant. Help search, read, and write academic papers.",
		Tools:    []string{"read_file", "write_file", "list_files", "search_workspace", "create_artifact"},
		MaxSteps: 15,
	},
	"Analysis": {
		Prompt:   "You are a spatial analysis assistant. Help analyze geospatial data and generate insights.",
		Tools:    []string{"read_file", "run_python", "list_files", "search_workspace", "create_artifact"},
		MaxSteps: 25,
	},
	"Write": {
		Prompt:   "You are a writing assistant. Help compose documents, reports, and presentations.",
		Tools:    []string{"read_file", "write_file", "list_files", "create_artifact"},
		MaxSteps: 15,
	},
}

// Planner generates task plans based on mode and user prompt.
type Planner struct {
	log      *zap.Logger
	registry *toolregistry.Registry
	gateway  *modelgateway.OpenAICompatibleClient
}

func NewPlanner(log *zap.Logger, gateway *modelgateway.OpenAICompatibleClient) *Planner {
	return &Planner{log: log, gateway: gateway}
}

// llmPlanRequest is the JSON structure we ask the LLM to return.
type llmPlanRequest struct {
	Steps []struct {
		Title string `json:"title"`
		Tool  string `json:"tool"`
		Args  string `json:"args"`
	} `json:"steps"`
}

// Plan generates a step-by-step plan for a given mode and prompt.
// It first tries the LLM; on any failure it falls back to keyword matching.
func (p *Planner) Plan(mode, prompt string) ([]Step, error) {
	config, ok := modeConfigs[mode]
	if !ok {
		config = modeConfigs["Work"]
	}

	// Try LLM-based planning first
	if p.gateway != nil {
		steps, err := p.planViaLLM(mode, prompt, config)
		if err == nil && len(steps) > 0 {
			p.log.Info("planned via LLM",
				zap.String("mode", mode),
				zap.Int("steps", len(steps)),
			)
			return steps, nil
		}
		if err != nil {
			p.log.Warn("LLM planning failed, falling back to keyword matching",
				zap.String("mode", mode),
				zap.Error(err),
			)
		}
	}

	// Fallback: keyword-based planning
	steps := p.fallbackPlan(mode, prompt, config)

	p.log.Info("planned steps (fallback)",
		zap.String("mode", mode),
		zap.Int("steps", len(steps)),
	)

	return steps, nil
}

// planViaLLM calls the LLM to generate a plan, with 5s timeout and 3 retries.
func (p *Planner) planViaLLM(mode, prompt string, config modePrompt) ([]Step, error) {
	systemPrompt := config.Prompt + "\n\nYou must respond with a JSON object containing a \"steps\" array. " +
		"Each step must have \"title\" (string), \"tool\" (one of: " + strings.Join(config.Tools, ", ") + "), and \"args\" (JSON string). " +
		fmt.Sprintf("Return at most %d steps.", config.MaxSteps)

	messages := []modelgateway.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: prompt},
	}

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		resp, err := p.gateway.Chat(ctx, messages, nil, false)
		cancel()

		if err != nil {
			lastErr = fmt.Errorf("attempt %d: %w", attempt+1, err)
			continue
		}

		if len(resp.Choices) == 0 {
			lastErr = fmt.Errorf("attempt %d: empty response", attempt+1)
			continue
		}

		content := resp.Choices[0].Message.Content
		var plan llmPlanRequest
		if err := json.Unmarshal([]byte(content), &plan); err != nil {
			// Try to extract JSON from the response
			extracted := extractJSON(content)
			if extracted == "" {
				lastErr = fmt.Errorf("attempt %d: parse JSON: %w", attempt+1, err)
				continue
			}
			if err := json.Unmarshal([]byte(extracted), &plan); err != nil {
				lastErr = fmt.Errorf("attempt %d: parse extracted JSON: %w", attempt+1, err)
				continue
			}
		}

		steps := make([]Step, 0, len(plan.Steps))
		for i, s := range plan.Steps {
			steps = append(steps, Step{
				ID:     fmt.Sprintf("step_%d", i+1),
				Title:  s.Title,
				Tool:   s.Tool,
				Args:   s.Args,
				Status: "pending",
			})
		}

		if len(steps) > config.MaxSteps {
			steps = steps[:config.MaxSteps]
		}

		return steps, nil
	}

	return nil, lastErr
}

// extractJSON tries to find a JSON object in a string.
func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return ""
}

// fallbackPlan is the original keyword-matching logic.
func (p *Planner) fallbackPlan(mode, prompt string, config modePrompt) []Step {
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

	isRemoteSensing := strings.Contains(promptLower, "ndvi") ||
		strings.Contains(promptLower, "sentinel") ||
		strings.Contains(promptLower, "landsat") ||
		strings.Contains(promptLower, "光谱") ||
		strings.Contains(promptLower, "遥感")

	steps := []Step{}

	if isGIS || isRemoteSensing {
		steps = append(steps, Step{
			ID:     fmt.Sprintf("step_%d", len(steps)+1),
			Title:  "检查数据源",
			Tool:   "read_file",
			Args:   `{"path": "data/"}`,
			Status: "pending",
		})
	}

	if isGIS {
		steps = append(steps, Step{
			ID:     fmt.Sprintf("step_%d", len(steps)+1),
			Title:  "规划GIS处理流程",
			Tool:   "run_python",
			Args:   `{"script": "print('Planning GIS workflow...')"}`,
			Status: "pending",
		})
	}

	if isRemoteSensing {
		steps = append(steps, Step{
			ID:     fmt.Sprintf("step_%d", len(steps)+1),
			Title:  "生成遥感分析脚本",
			Tool:   "run_python",
			Args:   `{"script": "print('Generating remote sensing script...')"}`,
			Status: "pending",
		})
	}

	steps = append(steps, Step{
		ID:     fmt.Sprintf("step_%d", len(steps)+1),
		Title:  "执行分析任务",
		Tool:   "run_python",
		Args:   `{"script": "print('Executing analysis...')"}`,
		Status: "pending",
	})

	steps = append(steps, Step{
		ID:     fmt.Sprintf("step_%d", len(steps)+1),
		Title:  "生成分析报告",
		Tool:   "write_file",
		Args:   `{"path": "output/report.md", "content": "# Analysis Report"}`,
		Status: "pending",
	})

	if len(steps) > config.MaxSteps {
		steps = steps[:config.MaxSteps]
	}

	return steps
}

// BuildSystemPrompt constructs a system prompt from the mode config and memory.
func (p *Planner) BuildSystemPrompt(mode, memory string) string {
	config, ok := modeConfigs[mode]
	if !ok {
		config = modeConfigs["Work"]
	}

	prompt := fmt.Sprintf(`你是 GeoWork 的 %s

[能力边界]
你可以调用以下工具：%s
你不能：访问互联网、执行未注册的工具、绕过沙箱限制。

[行为规范]
1. 先思考再行动，每轮只调用必要的工具。
2. 工具结果返回后，判断是否需要继续调用工具。
3. 任务完成时，用自然语言总结结果，不再调用工具。
4. 遇到错误时，尝试调整参数重试，最多 3 次后报告失败。`,
		config.Prompt,
		strings.Join(config.Tools, ", "),
	)

	if memory != "" {
		prompt += "\n\n[记忆上下文]\n" + memory
	}

	return prompt
}
