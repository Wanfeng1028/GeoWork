// GeoWork Types - Workspace

export type StorageMode = 'local' | 'cloud_reserved';

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  storageMode: StorageMode;
  branch: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  kind: string; // file, directory, symlink
  size: number;
  modifiedAt: string;
  children?: WorkspaceFile[];
}

export interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  fileTree: WorkspaceFile | null;
  branch: string;
  recentFiles: WorkspaceFile[];
  isLoading: boolean;
  error: string | null;
  loadWorkspaces: () => Promise<void>;
  openWorkspace: (workspaceId: string) => Promise<void>;
  readFile: (workspaceId: string, filePath: string) => Promise<string>;
  writeFile: (workspaceId: string, filePath: string, content: string) => Promise<void>;
}
