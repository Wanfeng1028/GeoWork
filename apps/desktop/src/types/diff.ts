// GeoWork Types - Diff

export interface DiffFile {
  path: string;
  oldContent?: string;
  newContent: string;
  status: 'modified' | 'added' | 'deleted';
}

export interface Diff {
  id: string;
  taskId: string;
  workspaceId: string;
  files: DiffFile[];
  patch?: string;
  createdAt: string;
}

export interface DiffState {
  diffs: Diff[];
  currentDiff: Diff | null;
  acceptedFiles: Set<string>;
  rejectedFiles: Set<string>;
}
