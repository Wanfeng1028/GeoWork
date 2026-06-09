package eino

// Workflow represents an Eino-based AI workflow definition.
type Workflow struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Nodes     []Node            `json:"nodes"`
	Edges     []Edge            `json:"edges"`
	Variables map[string]any    `json:"variables"`
}

// Node is a single step in an Eino workflow.
type Node struct {
	ID       string            `json:"id"`
	Type     string            `json:"type"` // llm | tool | condition | loop | start | output
	Name     string            `json:"name"`
	Config   map[string]any    `json:"config"`
}

// Edge connects two nodes in an Eino workflow.
type Edge struct {
	ID        string `json:"id"`
	Source    string `json:"source"`
	Target    string `json:"target"`
	Condition string `json:"condition,omitempty"`
}

// SchemaResponse is the shape returned by the eino schema API.
type SchemaResponse struct {
	Engine  string   `json:"engine"`
	Mode    string   `json:"mode"`
	Tools   []EinoTool `json:"tools"`
	HIL     bool     `json:"human_in_the_loop"`
}

// EinoTool describes a tool available in the Eino tool registry.
type EinoTool struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Risk        string   `json:"risk"`
	Inputs      []string `json:"inputs"`
}
