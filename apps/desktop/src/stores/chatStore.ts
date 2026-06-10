// GeoWork Store - Chat Store

import { create } from 'zustand'
import type { ChatMessage, NavItem, ChatState } from '../types/chat'

const useChatStore = create<ChatState>((set) => ({
  messages: [],
  navItems: [],
  isLoading: false
}))

export default useChatStore
