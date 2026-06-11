// GeoWork Types - Shell Layout

export type AppMode = 'general' | 'map' | 'gee' | 'paper' | 'automation' | 'research' | 'data' | 'geocode' | 'analysis' | 'write';

export type RightPanelType = 'task' | 'artifacts' | 'diff' | 'context';

export type BottomPanelType = 'terminal' | 'browser' | 'events' | 'logs' | 'problems' | 'output';

export interface ShellState {
  activeMode: AppMode;
  activeNavKey: string;
  sidebarCollapsed: boolean;
  rightDockVisible: boolean;
  activeRightPanel: RightPanelType;
  bottomDockVisible: boolean;
  activeBottomPanel: BottomPanelType;
  conversationMinimapEnabled: boolean;
  commandPaletteOpen: boolean;
  composerFocusToken: number;
}

export interface ShellActions {
  setActiveMode: (mode: AppMode) => void;
  setActiveNavKey: (key: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightDock: () => void;
  setActiveRightPanel: (panel: RightPanelType) => void;
  openRightDock: (panel?: RightPanelType) => void;
  closeRightDock: () => void;
  toggleBottomDock: () => void;
  setActiveBottomPanel: (panel: BottomPanelType) => void;
  openBottomDock: (panel?: BottomPanelType) => void;
  closeBottomDock: () => void;
  setConversationMinimapEnabled: (enabled: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  focusComposer: () => void;
}

export type ShellStore = ShellState & ShellActions;
