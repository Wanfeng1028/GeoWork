// GeoWork Go Core - MCP Server Config

package mcp

import "time"

// ServerConfig defines an MCP server connection configuration.
type ServerConfig struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Command   string        `json:"command"`
	Args      []string      `json:"args,omitempty"`
	Env       []string      `json:"env,omitempty"`
	Enabled   bool          `json:"enabled"`
	Timeout   time.Duration `json:"timeout,omitempty"`
	BuiltIn   bool          `json:"builtIn"`
	CreatedAt time.Time     `json:"createdAt"`
	UpdatedAt time.Time     `json:"updatedAt"`
}

// IsStdio checks if the server runs via stdio.
func (c *ServerConfig) IsStdio() bool {
	return c.Command != "" && len(c.Args) > 0
}

// DefaultConfigs returns built-in MCP server configs.
func DefaultConfigs() []ServerConfig {
	return []ServerConfig{
		{
			ID:      "filesystem",
			Name:    "Filesystem MCP",
			Command: "npx",
			Args:    []string{"-y", "@modelcontextprotocol/server-filesystem", "."},
			Enabled: false,
			BuiltIn: true,
		},
		{
			ID:      "git",
			Name:    "Git MCP",
			Command: "npx",
			Args:    []string{"-y", "@modelcontextprotocol/server-git"},
			Enabled: false,
			BuiltIn: true,
		},
	}
}
