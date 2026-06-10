// GeoWork Types - Permission

export type PermissionLevel = 'read_only' | 'ask_every_time' | 'limited' | 'full_access';

export type DangerousAction = 
  | 'read_folder'
  | 'write_file'
  | 'delete_file'
  | 'run_python'
  | 'run_shell'
  | 'launch_process'
  | 'network_request'
  | 'browser_control'
  | 'system_api'
  | 'long_running'
  | 'install_plugin';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PermissionPolicy {
  level: PermissionLevel;
  rememberedDecisions: Record<string, 'allowed' | 'denied'>;
}

export interface PermissionRequest {
  id: string;
  taskId: string;
  action: DangerousAction;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  targetPath?: string;
  command?: string;
  networkHost?: string;
  toolName?: string;
  requestedAt: string;
}

export interface PermissionState {
  defaultLevel: PermissionLevel;
  pendingRequests: PermissionRequest[];
  policies: Record<string, PermissionPolicy>;
  loadPendingRequests: () => Promise<void>;
  approveRequest: (id: string, reason?: string) => Promise<void>;
  denyRequest: (id: string, reason?: string) => Promise<void>;
  setDefaultLevel: (level: PermissionLevel) => void;
}
