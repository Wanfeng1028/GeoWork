package agent

import "strings"

type Step struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ToolName    string `json:"toolName"`
	Status      string `json:"status"`
	RiskLevel   string `json:"riskLevel"`
}

type Planner struct{}

func (p Planner) CreatePlan(prompt string) []Step {
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
