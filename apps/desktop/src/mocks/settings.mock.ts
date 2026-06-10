// GeoWork Mock - Settings Data

import type { Settings } from '../types/settings'

export const mockSettings: Settings = {
  modelApi: {
    providers: [
      {
        id: 'prov-1',
        name: 'OpenAI Compatible',
        kind: 'openai_compatible',
        baseUrl: 'https://api.example.com/v1',
        defaultModel: 'gpt-4',
        enabled: true
      },
      {
        id: 'prov-2',
        name: 'Ollama Local',
        kind: 'ollama',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3',
        enabled: false
      }
    ],
    defaultProvider: 'prov-1',
    cacheEnabled: true
  },
  appearance: {
    theme: 'dark-geo',
    fontSize: 14,
    sidebarCollapsed: false,
    conversationMinimapEnabled: true
  },
  workspace: {
    rootPath: '',
    recentPaths: [],
    autoSave: true,
    autoSaveInterval: 30
  },
  agent: {
    defaultPermission: 'limited',
    defaultMode: 'Analysis',
    maxSteps: 50,
    timeout: 300
  }
}
