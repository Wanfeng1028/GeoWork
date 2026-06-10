// GeoWork Types - Shell Layout

export type AppMode = 'work' | 'code' | 'paper' | 'ppt';

export type RightPanelType = 'task' | 'artifacts' | 'diff' | 'context';

export type BottomPanelType = 'terminal' | 'browser' | 'logs' | 'problems' | 'output';

export interface ShellState {
  activeMode: AppMode;
  activeNavKey: string;
  sidebarCollapsed: boolean;
  rightDockVisible: boolean;
  activeRightPanel: RightPanelType;
  bottomDockVisible: boolean;
  activeBottomPanel: BottomPanelType;
  conversationMinimapEnabled: boolean;
}

export interface ShellActions {
  setActiveMode: (mode: AppMode) => void;
  setActiveNavKey: (key: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightDock: () => void;
  setActiveRightPanel: (panel: RightPanelType) => void;
  toggleBottomDock: () => void;
  setActiveBottomPanel: (panel: BottomPanelType) => void;
  setConversationMinimapEnabled: (enabled: boolean) => void;
}

export type ShellStore = ShellState & ShellActions;
