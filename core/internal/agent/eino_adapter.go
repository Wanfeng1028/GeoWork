package agent

type EinoTool struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Risk        string   `json:"risk"`
	Inputs      []string `json:"inputs"`
}

type EinoAdapter struct {
	Enabled bool       `json:"enabled"`
	Tools   []EinoTool `json:"tools"`
}

func NewEinoAdapter(tools []EinoTool) EinoAdapter {
	return EinoAdapter{Enabled: true, Tools: tools}
}

func (a EinoAdapter) PlanAndExecuteSchema() map[string]any {
	return map[string]any{
		"engine": "cloudwego-eino-adapter",
		"mode": "bridge-only",
		"description": "GeoWork exposes the guarded Tool Registry to Eino while keeping the transparent Planner/Executor as the execution authority.",
		"tools": a.Tools,
		"human_in_the_loop": true,
	}
}
