// GeoWork Go Core - Tool Risk and Policy

package toolregistry

// DangerousAction defines actions that require explicit approval.
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

// ToolRisk represents the risk level of a tool.
type ToolRisk string

const (
	RiskLow      ToolRisk = "low"
	RiskMedium   ToolRisk = "medium"
	RiskHigh     ToolRisk = "high"
	RiskCritical ToolRisk = "critical"
)

// IsDangerous returns true if the risk level warrants additional scrutiny.
func (r ToolRisk) IsDangerous() bool {
	return r == RiskHigh || r == RiskCritical
}

// ToolPolicy defines the governance rules for a specific tool.
type ToolPolicy struct {
	// Name is the tool name this policy applies to.
	Name string
	// Risk is the risk classification of the tool.
	Risk ToolRisk
	// RequiredPermission lists dangerous actions that must be approved for this tool.
	RequiredPermission []DangerousAction
	// MaxCallsPerTask is the maximum number of times the tool can be called per task.
	MaxCallsPerTask int
	// MaxCallsPerTurn is the maximum number of times the tool can be called per turn.
	MaxCallsPerTurn int
	// RequiresApproval indicates whether each invocation needs explicit user approval.
	RequiresApproval bool
	// AlwaysDeny when true, the tool can never be executed.
	AlwaysDeny bool
}

// DefaultToolPolicies returns the default policy set for all governed tools.
func DefaultToolPolicies() []ToolPolicy {
	return []ToolPolicy{
		{
			Name:               "read_file",
			Risk:               RiskLow,
			MaxCallsPerTask:    100,
			MaxCallsPerTurn:    5,
			RequiresApproval:   false,
			RequiredPermission: nil,
		},
		{
			Name:               "write_file",
			Risk:               RiskMedium,
			MaxCallsPerTask:    50,
			MaxCallsPerTurn:    3,
			RequiresApproval:   false,
			RequiredPermission: []DangerousAction{"write_file"},
		},
		{
			Name:               "scan_folder",
			Risk:               RiskMedium,
			MaxCallsPerTask:    20,
			MaxCallsPerTurn:    3,
			RequiresApproval:   false,
		},
		{
			Name:               "run_shell",
			Risk:               RiskCritical,
			MaxCallsPerTask:    10,
			MaxCallsPerTurn:    1,
			RequiresApproval:   true,
			RequiredPermission: []DangerousAction{"run_shell"},
		},
		{
			Name:               "run_python",
			Risk:               RiskHigh,
			MaxCallsPerTask:    20,
			MaxCallsPerTurn:    2,
			RequiresApproval:   true,
			RequiredPermission: []DangerousAction{"run_python"},
		},
		{
			Name:               "open_local_app",
			Risk:               RiskHigh,
			MaxCallsPerTask:    5,
			MaxCallsPerTurn:    1,
			RequiresApproval:   true,
			RequiredPermission: []DangerousAction{"exec_binary"},
		},
		{
			Name:               "browser_control",
			Risk:               RiskHigh,
			MaxCallsPerTask:    10,
			MaxCallsPerTurn:    1,
			RequiresApproval:   true,
		},
		{
			Name:               "screenshot",
			Risk:               RiskMedium,
			MaxCallsPerTask:    10,
			MaxCallsPerTurn:    2,
			RequiresApproval:   false,
		},
		{
			Name:               "network_request",
			Risk:               RiskHigh,
			MaxCallsPerTask:    20,
			MaxCallsPerTurn:    3,
			RequiresApproval:   true,
			RequiredPermission: []DangerousAction{"network_access"},
		},
		{
			Name:               "git_commit",
			Risk:               RiskHigh,
			MaxCallsPerTask:    10,
			MaxCallsPerTurn:    2,
			RequiresApproval:   true,
			RequiredPermission: []DangerousAction{"write_file"},
		},
		{
			Name:               "git_push",
			Risk:               RiskCritical,
			MaxCallsPerTask:    2,
			MaxCallsPerTurn:    1,
			RequiresApproval:   true,
			AlwaysDeny:         true, // git push is always denied by default
		},
		{
			Name:               "delete_file",
			Risk:               RiskHigh,
			MaxCallsPerTask:    20,
			MaxCallsPerTurn:    3,
			RequiresApproval:   true,
			RequiredPermission: []DangerousAction{"delete_file"},
		},
		{
			Name:               "list_files",
			Risk:               RiskLow,
			MaxCallsPerTask:    50,
			MaxCallsPerTurn:    5,
			RequiresApproval:   false,
		},
		{
			Name:               "search_workspace",
			Risk:               RiskLow,
			MaxCallsPerTask:    50,
			MaxCallsPerTurn:    5,
			RequiresApproval:   false,
		},
		{
			Name:               "create_artifact",
			Risk:               RiskMedium,
			MaxCallsPerTask:    50,
			MaxCallsPerTurn:    5,
			RequiresApproval:   false,
		},
	}
}

// GetGovernedToolNames returns the list of tool names that have explicit policies.
func GetGovernedToolNames() []string {
	policies := DefaultToolPolicies()
	names := make([]string, 0, len(policies))
	for _, p := range policies {
		names = append(names, p.Name)
	}
	return names
}
