// GeoWork Go Core - Built-in Skills (P2-1)
//
// Five built-in skills covering the most common GeoWork use cases.
// These are registered programmatically at startup so the system is
// usable even without a skills/ directory on disk. User-supplied
// skills loaded from disk supplement (not shadow) these.

package skills

// RegisterBuiltins registers the five built-in skills. Called once at
// startup by the orchestrator wiring. Returns an error only if a
// duplicate ID is encountered (which would indicate a bug).
func RegisterBuiltins(reg *Registry) error {
	builtins := []*Skill{
		{
			Meta: SkillMeta{
				ID:          "gis-analysis",
				Name:        "GIS 空间分析",
				Version:     "1.0.0",
				Description: "Geospatial analysis with Python (GDAL/rasterio/geopandas). Prefer Python for spatial ops; save outputs as artifacts.",
				Tags:        []string{"gis", "raster", "vector", "ndvi"},
				Mode:        "Work",
			},
			Prompt: "You are a GIS specialist. Prefer Python (rasterio/geopandas) for spatial computation. Save computed raster/vector outputs as artifacts. Always state the CRS and resolution of geospatial data you process.",
			RecommendedTools: []string{"run_python", "read_file", "create_artifact"},
			DefaultArgs:     map[string]any{"language": "python"},
		},
		{
			Meta: SkillMeta{
				ID:          "paper-writing",
				Name:        "论文写作",
				Version:     "1.0.0",
				Description: "Academic paper drafting in LaTeX with proper citations.",
				Tags:        []string{"paper", "latex", "writing"},
				Mode:        "Paper",
			},
			Prompt: "You are an academic writing assistant. Produce LaTeX-formatted output. Use \\cite{} for references and follow the venue's bibliography style. Structure papers as Introduction → Related Work → Methods → Experiments → Conclusion.",
			RecommendedTools: []string{"read_file", "write_file", "search_workspace"},
		},
		{
			Meta: SkillMeta{
				ID:          "code-review",
				Name:        "代码审查",
				Version:     "1.0.0",
				Description: "Review code for security, performance, and readability issues.",
				Tags:        []string{"code", "review", "security"},
				Mode:        "Code",
			},
			Prompt: "You are a senior code reviewer. Focus on: (1) security vulnerabilities (injection, path traversal, secrets), (2) performance hotspots (N+1 queries, unbounded loops), (3) readability (naming, complexity). Cite file:line for each finding.",
			RecommendedTools: []string{"read_file", "search_workspace", "scan_folder"},
		},
		{
			Meta: SkillMeta{
				ID:          "data-cleaning",
				Name:        "数据清洗",
				Version:     "1.0.0",
				Description: "Clean and normalize datasets using Pandas. Handle missing values, outliers, type coercion.",
				Tags:        []string{"data", "pandas", "cleaning"},
				Mode:        "Work",
			},
			Prompt: "You are a data engineer. Use Pandas for tabular data cleaning. Report missing-value ratios, outlier counts, and dtype issues. Save cleaned datasets as CSV/Parquet artifacts.",
			RecommendedTools: []string{"run_python", "read_file", "write_file"},
		},
		{
			Meta: SkillMeta{
				ID:          "report-generation",
				Name:        "报告生成",
				Version:     "1.0.0",
				Description: "Generate Markdown reports with embedded charts and tables.",
				Tags:        []string{"report", "markdown"},
				Mode:        "Write",
			},
			Prompt: "You are a technical report writer. Produce well-structured Markdown with headers, tables, and embedded image references. Each section should have a one-line summary then the detail.",
			RecommendedTools: []string{"create_artifact", "write_file"},
		},
	}
	for _, s := range builtins {
		if err := reg.Register(s); err != nil {
			return err
		}
	}
	return nil
}
