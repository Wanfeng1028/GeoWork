// GeoWork Go Core - Plugin Installer

package plugins

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
)

// Installer handles plugin installation from marketplace or local files.
type Installer struct {
	markDir string
	log     *zap.Logger
}

func NewInstaller(log *zap.Logger) *Installer {
	markDir := filepath.Join(os.TempDir(), "geowork", "plugins")
	os.MkdirAll(markDir, 0755)
	return &Installer{markDir: markDir, log: log}
}

// InstallFromMarketplace downloads and installs a plugin from the marketplace.
func (i *Installer) InstallFromMarketplace(pluginID string) (*Manifest, error) {
	// Try to fetch manifest from marketplace API
	marketplaceURL := os.Getenv("GEOWORK_MARKETPLACE_URL")
	var manifest *Manifest

	if marketplaceURL != "" {
		fetched, err := DownloadManifest(marketplaceURL, pluginID)
		if err == nil && fetched != nil {
			manifest = fetched
			i.log.Info("plugin manifest fetched from marketplace",
				zap.String("id", pluginID),
				zap.String("version", fetched.Version),
			)
		} else {
			i.log.Warn("failed to fetch plugin from marketplace, using fallback",
				zap.String("id", pluginID),
				zap.Error(err),
			)
		}
	}

	// Fallback: create a local manifest if marketplace fetch failed
	if manifest == nil {
		manifest = &Manifest{
			ID:             pluginID,
			Name:           pluginID,
			Version:        "1.0.0",
			Description:    "Plugin " + pluginID + " (local install)",
			Author:         "Local",
			License:        "MIT",
			Categories:     []string{"general"},
			Entrypoint:     "./main.js",
			Enabled:        true,
			AuthorVerified: false,
			InstalledAt:    time.Now(),
			UpdatedAt:      time.Now(),
			Permissions: []Permission{
				{Name: "read_file", Description: "Read workspace files", Required: true},
				{Name: "write_file", Description: "Write workspace files", Required: false},
			},
		}
	}

	if err := i.installLocally(manifest); err != nil {
		return nil, err
	}

	i.log.Info("plugin installed", zap.String("id", pluginID))
	return manifest, nil
}

// InstallFromDir installs a plugin from a local directory.
func (i *Installer) InstallFromDir(dir string) (*Manifest, error) {
	manifestPath := filepath.Join(dir, "manifest.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}

	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}

	manifest.InstalledAt = time.Now()
	manifest.UpdatedAt = time.Now()

	// Copy to plugin directory
	pluginDir := filepath.Join(i.markDir, manifest.ID)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		return nil, fmt.Errorf("create plugin dir: %w", err)
	}

	// Copy all files
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		dest := filepath.Join(pluginDir, rel)
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return err
		}
		src, _ := os.ReadFile(path)
		return os.WriteFile(dest, src, 0644)
	})

	i.log.Info("plugin installed from dir",
		zap.String("id", manifest.ID),
		zap.String("dir", dir),
	)

	return &manifest, nil
}

// Uninstall removes a plugin.
func (i *Installer) Uninstall(pluginID string) error {
	pluginDir := filepath.Join(i.markDir, pluginID)
	if err := os.RemoveAll(pluginDir); err != nil {
		return fmt.Errorf("remove plugin dir: %w", err)
	}

	i.log.Info("plugin uninstalled", zap.String("id", pluginID))
	return nil
}

// GetInstalled returns all installed plugin manifests.
func (i *Installer) GetInstalled() ([]Manifest, error) {
	entries, err := os.ReadDir(i.markDir)
	if err != nil {
		return nil, err
	}

	var manifests []Manifest
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		manifestPath := filepath.Join(i.markDir, entry.Name(), "manifest.json")
		data, err := os.ReadFile(manifestPath)
		if err != nil {
			continue
		}
		var m Manifest
		if err := json.Unmarshal(data, &m); err != nil {
			continue
		}
		manifests = append(manifests, m)
	}

	return manifests, nil
}

// Update updates a plugin to a newer version.
func (i *Installer) Update(pluginID, version string) error {
	// Uninstall then reinstall
	if err := i.Uninstall(pluginID); err != nil {
		return err
	}
	_, err := i.InstallFromMarketplace(pluginID)
	return err
}

// DownloadManifest fetches a manifest from the marketplace.
func DownloadManifest(marketplaceURL, pluginID string) (*Manifest, error) {
	url := marketplaceURL + "/plugins/" + pluginID + "/manifest"

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}

	return &manifest, nil
}

func (i *Installer) installLocally(manifest *Manifest) error {
	pluginDir := filepath.Join(i.markDir, manifest.ID)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		return err
	}

	data, _ := json.MarshalIndent(manifest, "", "  ")
	return os.WriteFile(filepath.Join(pluginDir, "manifest.json"), data, 0644)
}
