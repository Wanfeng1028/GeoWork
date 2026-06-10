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
  currentWorkspace: Workspace | null;
  fileTree: WorkspaceFile | null;
  branch: string;
  recentFiles: WorkspaceFile[];
  isLoading: boolean;
  error: string | null;
}
