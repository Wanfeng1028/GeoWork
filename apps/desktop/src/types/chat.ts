// GeoWork Types - Chat

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageType = 'text' | 'tool_call' | 'approval' | 'delivery';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: string;
  toolCall?: ToolCall;
  approval?: ApprovalCard;
  delivery?: DeliveryChecklist;
}

export interface ToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}

export interface ApprovalCard {
  id: string;
  taskId: string;
  action: string;
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  targetPath?: string;
  command?: string;
  networkHost?: string;
  toolName?: string;
  requestedAt: string;
}

export interface DeliveryChecklist {
  taskId: string;
  maps: string[];
  codes: string[];
  documents: string[];
  datasets: string[];
  logs: string[];
}

export interface NavItem {
  id: string;
  type: 'user-question' | 'agent-plan' | 'tool-call' | 'artifact' | 'diff' | 'error' | 'checkpoint';
  messageId: string;
  label: string;
}

export interface ChatState {
  messages: ChatMessage[];
  navItems: NavItem[];
  isLoading: boolean;
}

export interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  addMessages: (messages: ChatMessage[]) => void;
  addToolCall: (toolCall: any, parentMessageId?: string) => void;
  updateToolCall: (toolCallId: string, updates: Partial<any>) => void;
  addApprovalRequest: (approval: any) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  addNavItem: (item: NavItem) => void;
  setNavItems: (items: NavItem[]) => void;
  setLoading: (loading: boolean) => void;
}
