// GeoWork Types - Artifact

export type ArtifactType = 'map' | 'code' | 'document' | 'data' | 'image' | 'ppt' | 'pdf' | 'diff' | 'log';

export interface Artifact {
  id: string;
  taskId: string;
  workspaceId: string;
  type: ArtifactType;
  name: string;
  path: string;
  mimeType: string;
  previewPath?: string;
  createdAt: string;
}

export interface ArtifactState {
  artifacts: Artifact[];
  currentPreview: Artifact | null;
  isLoading: boolean;
  setArtifacts: (artifacts: Artifact[]) => void;
  addArtifact: (artifact: Artifact) => void;
  setPreviewArtifact: (artifact: Artifact | null) => void;
  clearPreview: () => void;
}
