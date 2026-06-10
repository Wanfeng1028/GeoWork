// GeoWork Go Core - Permission Models

package permissions

import "time"

// PermissionLevel defines the access level for agent operations
type PermissionLevel string

const (
	ReadOnly     PermissionLevel = "read_only"
	AskEveryTime PermissionLevel = "ask_every_time"
	Limited      PermissionLevel = "limited"
	FullAccess   PermissionLevel = "full_access"
)

// DangerousAction defines actions that require explicit approval
type DangerousAction string

const (
	ActionRunShell      DangerousAction = "run_shell"
	ActionWriteFile     DangerousAction = "write_file"
	ActionDeleteFile    DangerousAction = "delete_file"
	ActionRunPython     DangerousAction = "run_python"
	ActionInstallPkg    DangerousAction = "install_package"
	ActionNetworkAccess DangerousAction = "network_access"
	ActionReadEnv       DangerousAction = "read_env"
	ActionWriteEnv      DangerousAction = "write_env"
	ActionExecBinary    DangerousAction = "exec_binary"
	ActionModifySystem  DangerousAction = "modify_system"
	ActionAccessSecrets DangerousAction = "access_secrets"
)

// PermissionRequest represents a request for permission
type PermissionRequest struct {
	ID          string            `json:"id"`
	TaskID      string            `json:"taskId"`
	Action      DangerousAction   `json:"action"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Command     string            `json:"command,omitempty"`
	RiskLevel   string            `json:"riskLevel"`
	RequestedAt time.Time         `json:"requestedAt"`
	ResolvedAt  time.Time         `json:"resolvedAt,omitempty"`
	Decision    string            `json:"decision,omitempty"`
	Reason      string            `json:"reason,omitempty"`
}

// PermissionPolicy defines default permission behavior
type PermissionPolicy struct {
	DefaultLevel PermissionLevel   `json:"defaultLevel"`
	Actions      map[string]string `json:"actions"` // action -> permission level
	Remembered   map[string]bool   `json:"remembered"`
}
