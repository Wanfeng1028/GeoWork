// GeoWork Go Core - Plugin Manifest

package plugins

import "time"

// Permission defines a permission required by a plugin.
type Permission struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

// Manifest describes a plugin.
type Manifest struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	Version        string         `json:"version"`
	Description    string         `json:"description"`
	Author         string         `json:"author"`
	License        string         `json:"license"`
	Icon           string         `json:"icon,omitempty"`
	Categories     []string       `json:"categories"`
	Permissions    []Permission   `json:"permissions"`
	Entrypoint     string         `json:"entrypoint"`
	Scripts        []Script       `json:"scripts,omitempty"`
	MinGeoWorkVer  string         `json:"minGeoWorkVersion,omitempty"`
	InstalledAt    time.Time      `json:"installedAt,omitempty"`
	UpdatedAt      time.Time      `json:"updatedAt,omitempty"`
	Enabled        bool           `json:"enabled"`
	AuthorVerified bool           `json:"authorVerified"`
	Downloads      int            `json:"downloads"`
	Rating         float64        `json:"rating"`
	Dependencies   []Dependency   `json:"dependencies,omitempty"`
}

// Script defines a lifecycle script.
type Script struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Hook  string `json:"hook"` // install | uninstall | enable | disable
}

// Dependency defines a plugin dependency.
type Dependency struct {
	ID       string `json:"id"`
	Required bool   `json:"required"`
}
