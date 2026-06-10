// GeoWork Go Core - Plugin Permissions

package plugins

// CheckPermission validates that a plugin has required permissions for an action.
func CheckPermission(manifest *Manifest, action string) (bool, string) {
	if manifest == nil {
		return false, "plugin not found"
	}

	if !manifest.Enabled {
		return false, "plugin is disabled"
	}

	for _, p := range manifest.Permissions {
		if p.Name == action {
			if !p.Required {
				return true, "" // optional permission, not required
			}
			return true, ""
		}
	}

	return false, "permission denied: " + action
}

// GetRequiredPermissions returns the list of required permissions for a plugin.
func GetRequiredPermissions(manifest *Manifest) []Permission {
	if manifest == nil {
		return nil
	}

	var required []Permission
	for _, p := range manifest.Permissions {
		if p.Required {
			required = append(required, p)
		}
	}
	return required
}

// DangerousActions lists actions that require explicit user approval.
var DangerousActions = map[string]string{
	"run_shell":        "Executes arbitrary shell commands",
	"run_python":       "Executes arbitrary Python code",
	"write_file":       "Modifies files in the workspace",
	"delete":           "Deletes files or directories",
	"browser_control":  "Controls the built-in browser",
	"network_access":   "Makes network requests",
	"system_info":      "Reads system information",
}

// IsDangerous checks if an action requires explicit approval.
func IsDangerous(action string) bool {
	_, ok := DangerousActions[action]
	return ok
}

// GetDangerousActionDescription returns the description of a dangerous action.
func GetDangerousActionDescription(action string) string {
	desc, ok := DangerousActions[action]
	if !ok {
		return ""
	}
	return desc
}
