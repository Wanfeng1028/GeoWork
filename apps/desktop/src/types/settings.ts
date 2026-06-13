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

export interface SpeedProfile {
  id: '1x' | '2x';
  maxParallelRequests: number;
  tokenBudgetMultiplier: number;
  rateLimitMultiplier: number;
}

export interface Settings {
  modelApi: {
    providers: ModelProvider[];
    defaultProvider?: string;
    cacheEnabled: boolean;
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
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

export interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Settings['appearance']['theme']) => void;
  setResolvedTheme: (theme: 'dark' | 'light') => void;
  updateSetting: (path: string, value: unknown) => void;
}
