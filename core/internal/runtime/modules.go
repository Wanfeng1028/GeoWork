package runtime

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Expert struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Mode        string   `json:"mode"`
	Description string   `json:"description"`
	Tools       []string `json:"tools"`
	Skills      []string `json:"skills"`
}

type Paper struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Authors    []string  `json:"authors"`
	Year       int       `json:"year"`
	Source     string    `json:"source"`
	Abstract   string    `json:"abstract"`
	Tags       []string  `json:"tags"`
	ImportedAt time.Time `json:"importedAt"`
}

type KnowledgeItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	Path      string    `json:"path"`
	Summary   string    `json:"summary"`
	IndexedAt time.Time `json:"indexedAt"`
}

type Dataset struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Path      string    `json:"path"`
	CRS       string    `json:"crs"`
	Status    string    `json:"status"`
	Quality   map[string]any `json:"quality"`
	CreatedAt time.Time `json:"createdAt"`
}

type MapLayer struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	Name      string    `json:"name"`
	Kind      string    `json:"kind"`
	Source    string    `json:"source"`
	Visible   bool      `json:"visible"`
	Opacity   float64   `json:"opacity"`
	Style     map[string]any `json:"style"`
	CreatedAt time.Time `json:"createdAt"`
}

type DeliveryPackage struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Artifacts []Artifact `json:"artifacts"`
	Formats   []string  `json:"formats"`
	CreatedAt time.Time `json:"createdAt"`
}

type AutomationRun struct {
	ID           string    `json:"id"`
	AutomationID string    `json:"automationId"`
	TaskID       string    `json:"taskId"`
	Status       string    `json:"status"`
	Message      string    `json:"message"`
	StartedAt    time.Time `json:"startedAt"`
}

type SecurityDecision struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	Tool      string    `json:"tool"`
	Risk      string    `json:"risk"`
	Decision  string    `json:"decision"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"createdAt"`
}

type SkillManifest struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Version       string         `json:"version"`
	Description   string         `json:"description"`
	RequiredTools []string       `json:"required_tools"`
	Permissions   map[string]any `json:"permissions"`
}

type PluginManifest struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Version     string         `json:"version"`
	Author      string         `json:"author"`
	Description string         `json:"description"`
	Permissions map[string]any `json:"permissions"`
}

type MCPConnector struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Status      string   `json:"status"`
	Permissions []string `json:"permissions"`
}

func LoadSkills(root string, fallback []Skill) []Skill {
	entries, err := os.ReadDir(root)
	if err != nil {
		return fallback
	}
	out := []Skill{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(root, entry.Name(), "manifest.json"))
		if err != nil {
			continue
		}
		var manifest SkillManifest
		if json.Unmarshal(raw, &manifest) != nil || manifest.ID == "" {
			continue
		}
		out = append(out, Skill{ID: manifest.ID, Name: manifest.Name, Version: manifest.Version, Description: manifest.Description, RequiredTools: manifest.RequiredTools, Permissions: manifest.Permissions, Status: "ready"})
	}
	seen := map[string]bool{}
	for _, skill := range out {
		seen[skill.ID] = true
	}
	for _, skill := range fallback {
		if !seen[skill.ID] {
			out = append(out, skill)
		}
	}
	return out
}

func LoadPlugins(root string, fallback []Plugin) []Plugin {
	entries, err := os.ReadDir(root)
	if err != nil {
		return fallback
	}
	out := []Plugin{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(root, entry.Name(), "plugin.json"))
		if err != nil {
			continue
		}
		var manifest PluginManifest
		if json.Unmarshal(raw, &manifest) != nil || manifest.ID == "" {
			continue
		}
		out = append(out, Plugin{ID: manifest.ID, Name: manifest.Name, Version: manifest.Version, Author: manifest.Author, Description: manifest.Description, Permissions: manifest.Permissions, Enabled: manifest.ID == "openalex"})
	}
	seen := map[string]bool{}
	for _, plugin := range out {
		seen[plugin.ID] = true
	}
	for _, plugin := range fallback {
		if !seen[plugin.ID] {
			out = append(out, plugin)
		}
	}
	return out
}

func LoadMCPConnectors(root string) []MCPConnector {
	raw, err := os.ReadFile(filepath.Join(root, "connectors.json"))
	if err != nil {
		return defaultMCPConnectors()
	}
	var connectors []MCPConnector
	if json.Unmarshal(raw, &connectors) != nil || len(connectors) == 0 {
		return defaultMCPConnectors()
	}
	return connectors
}

func defaultMCPConnectors() []MCPConnector {
	return []MCPConnector{
		{ID: "zotero", Name: "Zotero", Category: "research", Status: "configured", Permissions: []string{"network", "local_app"}},
		{ID: "postgis", Name: "PostGIS", Category: "data", Status: "available", Permissions: []string{"network", "database"}},
		{ID: "qgis", Name: "QGIS", Category: "gis", Status: "detect-local", Permissions: []string{"process", "file_read", "file_write"}},
		{ID: "filesystem", Name: "Guarded File System", Category: "workspace", Status: "guarded", Permissions: []string{"file_read", "file_write"}},
		{ID: "papers", Name: "Paper Search", Category: "research", Status: "available", Permissions: []string{"network"}},
		{ID: "data-sources", Name: "Remote Sensing Data Sources", Category: "data", Status: "available", Permissions: []string{"network"}},
		{ID: "model-providers", Name: "Model Providers", Category: "model", Status: "user-configured", Permissions: []string{"network", "secret"}},
	}
}

func defaultExperts() []Expert {
	return []Expert{
		{ID: "chief", Name: "总控专家", Mode: "Research", Description: "拆解目标、选择专家、审核成果。", Tools: []string{"task.parse"}, Skills: []string{"graduate-thesis-outline"}},
		{ID: "paper", Name: "论文专家", Mode: "Research", Description: "论文搜索、精读、综述矩阵。", Tools: []string{"research.openalex.search", "papers.parse_pdf"}, Skills: []string{"paper-reading-geography", "literature-review-remote-sensing"}},
		{ID: "data", Name: "数据专家", Mode: "Data", Description: "数据源推荐、元数据与质量检查。", Tools: []string{"geo.gdal.inspect_dataset"}, Skills: []string{"dem-terrain-analysis"}},
		{ID: "gee", Name: "GEE 专家", Mode: "GeoCode", Description: "Earth Engine 脚本与云端遥感处理。", Tools: []string{"geo.gee.generate_ndvi_script"}, Skills: []string{"gee-sentinel2-cloudfree-composite", "ndvi-timeseries-analysis"}},
		{ID: "qgis", Name: "QGIS 专家", Mode: "GeoCode", Description: "QGIS Processing、本机环境检测和工程流程。", Tools: []string{"qgis.processing.run"}, Skills: []string{"map-layout-export"}},
		{ID: "gdal", Name: "GDAL 专家", Mode: "Data", Description: "栅格/矢量批处理、投影转换和 COG 输出。", Tools: []string{"geo.gdal.inspect_dataset"}, Skills: []string{"land-cover-classification"}},
		{ID: "rs", Name: "遥感分析专家", Mode: "Analysis", Description: "NDVI、LST、NDWI、分类和变化检测。", Tools: []string{"geo.gee.generate_ndvi_script"}, Skills: []string{"landsat-lst-retrieval", "water-extraction-ndwi"}},
		{ID: "writer", Name: "写作专家", Mode: "Write", Description: "实验报告、论文大纲、项目报告和 PPT。", Tools: []string{"geo.office.write_report"}, Skills: []string{"undergraduate-experiment-report", "graduate-thesis-outline"}},
		{ID: "qa", Name: "QA 专家", Mode: "Write", Description: "可复现性、引用、数据和成果完整性检查。", Tools: []string{"task.audit"}, Skills: []string{"paper-reading-geography"}},
		{ID: "automation", Name: "自动化专家", Mode: "Analysis", Description: "文件变化、定时任务和批处理编排。", Tools: []string{"automation.trigger"}, Skills: []string{"urban-expansion-analysis"}},
		{ID: "model", Name: "模型路由专家", Mode: "Research", Description: "模型选择、成本和可用性检查。", Tools: []string{"model.test"}},
		{ID: "security", Name: "安全专家", Mode: "Data", Description: "权限审批、工作区保护和插件安全审查。", Tools: []string{"security.review"}},
	}
}

func defaultPapers() []Paper {
	return []Paper{
		{ID: "paper_ndvi_review", Title: "Remote sensing vegetation index time-series review", Authors: []string{"GeoWork Seed"}, Year: 2024, Source: "OpenAlex seed", Abstract: "A seed record for NDVI literature workflows.", Tags: []string{"NDVI", "time-series"}, ImportedAt: time.Now()},
		{ID: "paper_urban_expansion", Title: "Urban expansion analysis with multi-source imagery", Authors: []string{"GeoWork Seed"}, Year: 2023, Source: "OpenAlex seed", Abstract: "A seed record for urban expansion workflows.", Tags: []string{"urban", "classification"}, ImportedAt: time.Now()},
	}
}

func defaultKnowledge(workspace string) []KnowledgeItem {
	return []KnowledgeItem{
		{ID: "kb_product_docs", Title: "GeoWork product specification", Type: "markdown", Path: filepath.Join(workspace, "knowledge", "product.md"), Summary: "Product, architecture, UI and roadmap documents.", IndexedAt: time.Now()},
	}
}

func riskForTool(tool string) string {
	if strings.Contains(tool, "delete") || strings.Contains(tool, "shell") || strings.Contains(tool, "qgis.processing") {
		return "high"
	}
	if strings.Contains(tool, "write") || strings.Contains(tool, "gee") || strings.Contains(tool, "gdal") {
		return "medium"
	}
	return "low"
}
