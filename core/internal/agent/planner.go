package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"geowork/core/internal/modelgateway"

	"go.uber.org/zap"
)

// Step represents a single step in an agent plan.
type Step struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ToolName    string `json:"toolName"`
	Status      string `json:"status"`
	RiskLevel   string `json:"riskLevel"`
}

// Planner creates execution plans, optionally backed by an LLM.
type Planner struct {
	gateway *modelgateway.OpenAICompatibleClient
	log     *zap.Logger
}

// NewPlanner creates a new Planner with an optional LLM gateway.
func NewPlanner(log *zap.Logger, gateway *modelgateway.OpenAICompatibleClient) *Planner {
	return &Planner{log: log, gateway: gateway}
}

// llmPlanResponse is the JSON structure we ask the LLM to return.
type llmPlanResponse struct {
	Steps []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		ToolName    string `json:"toolName"`
		RiskLevel   string `json:"riskLevel"`
	} `json:"steps"`
}

// CreatePlan generates a step-by-step plan.
// It first tries the LLM; on failure it falls back to keyword matching.
func (p Planner) CreatePlan(prompt string) []Step {
	if p.gateway != nil {
		steps, err := p.createPlanViaLLM(prompt)
		if err == nil && len(steps) > 0 {
			p.log.Info("plan created via LLM", zap.Int("steps", len(steps)))
			return steps
		}
		if err != nil {
			p.log.Warn("LLM plan failed, falling back to keyword matching", zap.Error(err))
		}
	}

	return p.fallbackPlan(prompt)
}

// createPlanViaLLM calls the LLM with 5s timeout and up to 3 retries.
func (p Planner) createPlanViaLLM(prompt string) ([]Step, error) {
	systemPrompt := "You are a task planning agent. Respond with a JSON object containing a \"steps\" array. " +
		"Each step must have: \"title\" (string), \"description\" (string), \"toolName\" (string), \"riskLevel\" (\"low\"|\"medium\"|\"high\"). " +
		"Return at most 10 steps."

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
		var plan llmPlanResponse
		if err := json.Unmarshal([]byte(content), &plan); err != nil {
			// Try to extract JSON
			extracted := extractJSONFromText(content)
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
			risk := s.RiskLevel
			if risk == "" {
				risk = "low"
			}
			steps = append(steps, Step{
				ID:          fmt.Sprintf("step_%d", i+1),
				Title:       s.Title,
				Description: s.Description,
				ToolName:    s.ToolName,
				Status:      "pending",
				RiskLevel:   risk,
			})
		}
		return steps, nil
	}

	return nil, lastErr
}

// extractJSONFromText tries to find a JSON object in arbitrary text.
func extractJSONFromText(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return ""
}

// fallbackPlan is the original keyword-matching logic.
func (p Planner) fallbackPlan(prompt string) []Step {
	lower := strings.ToLower(prompt)
	steps := []Step{
		{ID: "step_1", Title: "解析任务", Description: "识别研究目标、数据、输出格式和安全边界。", ToolName: "task.parse", Status: "pending", RiskLevel: "low"},
	}
	if strings.Contains(lower, "paper") || strings.Contains(prompt, "论文") || strings.Contains(prompt, "综述") {
		steps = append(steps, Step{ID: "step_2", Title: "检索论文并生成综述矩阵", Description: "通过论文搜索工具形成可追溯的研究脉络。", ToolName: "research.openalex.search", Status: "pending", RiskLevel: "low"})
		steps = append(steps, Step{ID: "step_3", Title: "写作研究报告草稿", Description: "输出 Markdown 综述和后续实验建议。", ToolName: "geo.office.write_report", Status: "pending", RiskLevel: "medium"})
		return steps
	}
	if strings.Contains(lower, "gis") || strings.Contains(prompt, "裁剪") || strings.Contains(prompt, "缓冲") || strings.Contains(prompt, "投影") {
		steps = append(steps, Step{ID: "step_2", Title: "检查 GIS 数据质量", Description: "检查坐标系、几何和属性字段。", ToolName: "geo.gdal.inspect_dataset", Status: "pending", RiskLevel: "low"})
		steps = append(steps, Step{ID: "step_3", Title: "生成工程成果包", Description: "生成地图、统计表和工程报告。", ToolName: "geo.office.write_report", Status: "pending", RiskLevel: "medium"})
		return steps
	}
	steps = append(steps,
		Step{ID: "step_2", Title: "生成 GEE NDVI 脚本", Description: "生成 Sentinel-2 云掩膜与 NDVI 时序脚本。", ToolName: "geo.gee.generate_ndvi_script", Status: "pending", RiskLevel: "medium"},
		Step{ID: "step_3", Title: "生成实验报告", Description: "生成 DOCX 与 Markdown 实验报告。", ToolName: "geo.office.write_report", Status: "pending", RiskLevel: "medium"},
	)
	return steps
}
