// GeoWork Go Core - Storage Paths

package storage

import (
	"os"
	"path/filepath"
	"runtime"
)

func GetAppDataDir() string {
	var base string
	switch runtime.GOOS {
	case "windows":
		base = os.Getenv("APPDATA")
		if base == "" {
			base = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
		base = filepath.Join(base, "GeoWork")
	case "darwin":
		base = filepath.Join(os.Getenv("HOME"), "Library", "Application Support", "GeoWork")
	case "linux":
		base = os.Getenv("XDG_CONFIG_HOME")
		if base == "" {
			base = filepath.Join(os.Getenv("HOME"), ".config", "geowork")
		}
	default:
		base = filepath.Join(os.Getenv("HOME"), ".geowork")
	}
	return base
}

func GetWorkspaceDir() string {
	return filepath.Join(GetAppDataDir(), "workspaces")
}

func GetArtifactsDir() string {
	return filepath.Join(GetAppDataDir(), "artifacts")
}

func GetLogsDir() string {
	return filepath.Join(GetAppDataDir(), "logs")
}

func GetDBPath() string {
	return filepath.Join(GetAppDataDir(), "geowork.db")
}

func EnsureDirs() error {
	dirs := []string{
		GetAppDataDir(),
		GetWorkspaceDir(),
		GetArtifactsDir(),
		GetLogsDir(),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

func GetPlatformInfo() map[string]string {
	return map[string]string{
		"os":      runtime.GOOS,
		"arch":    runtime.GOARCH,
		"go_ver":  runtime.Version(),
		"app_dir": GetAppDataDir(),
	}
}
