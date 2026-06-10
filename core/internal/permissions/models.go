// GeoWork Go Core - Permission Models

package permissions

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
