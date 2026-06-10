// GeoWork Frontend - Runtime Client
// TypeScript client for Go Core API via Electron IPC

import type { PermissionRequest, PermissionPolicy, PermissionLevel, RiskLevel, DangerousAction } from '../types/permission'

export interface Workspace {
  id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
  mode: string;
  files: number;
  recent_files: string[];
}

export interface FileTreeNode {
  path: string;
  name: string;
  is_dir: boolean;
  children?: FileTreeNode[];
}

export interface Task {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SandboxProcess {
  id: string;
  taskId: string;
  type: string;
  command: string;
  workspace: string;
  status: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface ScriptRunRequest {
  scriptPath?: string;
  inlineCode?: string;
  workspaceId?: string;
  env?: Record<string, string>;
  timeout?: number;
  workingDir?: string;
}

export interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts: Array<{ name: string; path: string; type: string; size: number }>;
  durationMs: number;
}

export { PermissionRequest, PermissionPolicy, PermissionLevel, RiskLevel, DangerousAction }

class RuntimeClient {
  private geowork: typeof window.geowork;

  constructor() {
    this.geowork = window.geowork;
  }

  // === Workspace ===

  async listWorkspaces(): Promise<Workspace[]> {
    return this.geowork.runtime.listWorkspaces();
  }

  async createWorkspace(name: string, path: string, mode: string = 'Analysis'): Promise<Workspace> {
    return this.geowork.runtime.createWorkspace({ name, path, mode });
  }

  async getWorkspaceTree(workspaceId: string): Promise<FileTreeNode[]> {
    return this.geowork.runtime.getWorkspaceTree(workspaceId);
  }

  async readFile(workspaceId: string, filePath: string): Promise<string> {
    const result = await this.geowork.runtime.readFile(workspaceId, filePath);
    return result?.content || '';
  }

  async writeFile(workspaceId: string, filePath: string, content: string): Promise<void> {
    await this.geowork.runtime.writeFile({ workspaceId, path: filePath, content });
  }

  async importFiles(workspaceId: string, srcPaths: string[]): Promise<void> {
    await this.geowork.runtime.importFiles({ workspaceId, srcPaths });
  }

  // === Tasks ===

  async listTasks(): Promise<Task[]> {
    return this.geowork.runtime.listTasks();
  }

  async createTask(data: Record<string, any>): Promise<Task> {
    return this.geowork.runtime.createTask(data);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.geowork.runtime.getTask(taskId);
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.geowork.runtime.cancelTask(taskId);
  }

  subscribeTaskEvents(taskId: string, callback: (data: any) => void): () => void {
    return this.geowork.runtime.subscribeTaskEvents(taskId, callback);
  }

  // === Permissions ===

  async getPermissionRequests(): Promise<PermissionRequest[]> {
    return this.geowork.runtime.getPermissionRequests();
  }

  async approvePermission(id: string, reason: string = 'User approved'): Promise<void> {
    await this.geowork.runtime.approvePermission(id, reason);
  }

  async denyPermission(id: string, reason: string = 'User denied'): Promise<void> {
    await this.geowork.runtime.denyPermission(id, reason);
  }

  async getPermissions(taskId: string): Promise<Record<string, PermissionPolicy>> {
    return this.geowork.runtime.getPermissions(taskId);
  }

  async updatePermissions(data: Record<string, any>): Promise<void> {
    await this.geowork.runtime.updatePermissions(data);
  }

  // === Sandbox ===

  async runCommand(data: { taskId: string; workspace: string; command: string }): Promise<SandboxProcess> {
    return this.geowork.runtime.runCommand(data);
  }

  async runPython(data: { taskId: string; workspace: string; scriptPath: string; env?: Record<string, string>; timeout?: number }): Promise<SandboxProcess> {
    return this.geowork.runtime.runPython(data);
  }

  async listProcesses(taskId: string): Promise<SandboxProcess[]> {
    return this.geowork.runtime.listProcesses(taskId);
  }

  async stopProcess(processId: string): Promise<void> {
    await this.geowork.runtime.stopProcess(processId);
  }

  // === Diagnostics ===

  async health(): Promise<any> {
    return this.geowork.runtime.health();
  }

  async performance(): Promise<any> {
    return this.geowork.runtime.performance();
  }

  async getLogs(): Promise<string[]> {
    return this.geowork.runtime.getLogs();
  }

  // === SSE ===

  connectSSE(url: string, onMessage: (data: any) => void, onError?: (err: any) => void, onDone?: () => void): () => void {
    return this.geowork.runtime.connectSSE(url, onMessage, onError || (() => {}), onDone || (() => {}));
  }
}

export const runtimeClient = new RuntimeClient();
export default runtimeClient;
