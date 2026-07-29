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
  activeDiffId: string | null;
  acceptedFiles: Set<string>;
  rejectedFiles: Set<string>;
  setActiveDiffId: (diffId: string | null) => void;
  setDiffs: (diffs: Diff[]) => void;
  addDiff: (diff: Diff) => void;
  acceptFile: (filePath: string) => void;
  rejectFile: (filePath: string) => void;
  acceptAll: (diffId?: string) => void;
  rejectAll: (diffId?: string) => void;
  setAcceptedFile: (filePath: string) => void;
  setRejectedFile: (filePath: string) => void;
  setAllAccepted: (filePath: string) => void;
  setAllRejected: (filePath: string) => void;
}
