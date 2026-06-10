// GeoWork Store - Chat Store

import { create } from 'zustand'
import type { ChatMessage, NavItem, ChatState, ChatActions } from '../types/chat'

const useChatStore = create<ChatState & ChatActions>((set) => ({
  messages: [],
  navItems: [],
  isLoading: false,

  addMessage: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  addMessages: (messages: ChatMessage[]) => {
    set((state) => ({
      messages: [...state.messages, ...messages],
    }))
  },

  addToolCall: (toolCall: any, parentMessageId?: string) => {
    const message: ChatMessage = {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role: 'assistant',
      type: 'tool_call',
      content: `正在调用工具: ${toolCall.toolName || 'unknown'}`,
      timestamp: new Date().toISOString(),
      toolCall: {
        id: toolCall.id || `tool-${Date.now()}`,
        toolName: toolCall.toolName || 'unknown',
        input: toolCall.input || {},
        status: 'running',
      },
    }
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  updateToolCall: (toolCallId: string, updates: Partial<any>) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.toolCall?.id === toolCallId) {
          return {
            ...msg,
            toolCall: { ...msg.toolCall, ...updates },
            content: updates.status === 'completed'
              ? `工具调用完成: ${msg.toolCall?.toolName}`
              : updates.status === 'failed'
                ? `工具调用失败: ${msg.toolCall?.toolName}`
                : msg.content,
          }
        }
        return msg
      }),
    }))
  },

  addApprovalRequest: (approval: any) => {
    const message: ChatMessage = {
      id: `approval-${Date.now()}`,
      role: 'system',
      type: 'approval',
      content: approval.title || '需要审批',
      timestamp: new Date().toISOString(),
      approval: {
        id: approval.id || `approval-${Date.now()}`,
        taskId: approval.taskId || '',
        action: approval.action || '',
        title: approval.title || '需要审批',
        description: approval.description || '',
        riskLevel: approval.riskLevel || 'medium',
        requestedAt: new Date().toISOString(),
      },
    }
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  removeMessage: (messageId: string) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }))
  },

  clearMessages: () => {
    set({ messages: [], navItems: [] })
  },

  addNavItem: (item: NavItem) => {
    set((state) => ({
      navItems: [...state.navItems, item],
    }))
  },

  setNavItems: (items: NavItem[]) => {
    set({ navItems: items })
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },
}))

export default useChatStore
