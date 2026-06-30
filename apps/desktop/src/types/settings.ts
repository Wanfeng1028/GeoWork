// GeoWork Types - Settings

import type { PermissionLevel } from './permission'

export interface ModelProvider {
  id: string;
  name: string;
  kind: 'openai_compatible' | 'ollama' | 'lm_studio' | 'custom';
  baseUrl: string;
  apiKeyRef?: string;
  defaultModel?: string;
  enabled: boolean;
}

export interface Settings {
  modelApi: {
    providers: ModelProvider[];
    defaultProvider?: string;
    cacheEnabled: boolean;
  };
  appearance: {
    theme: string;
    fontSize: number;
    sidebarCollapsed: boolean;
    conversationMinimapEnabled: boolean;
  };
  workspace: {
    rootPath: string;
    recentPaths: string[];
    autoSave: boolean;
    autoSaveInterval: number;
  };
  agent: {
    defaultPermission: PermissionLevel;
    defaultMode: string;
    maxSteps: number;
    timeout: number;
  };
}
