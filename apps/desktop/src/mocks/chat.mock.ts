// GeoWork Mock - Chat Data

import type { ChatMessage, NavItem } from '../types/chat'

export const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    type: 'text',
    content: '请帮我运行 NDVI 分析，使用 Sentinel-2 数据生成植被指数地图和报告',
    timestamp: '2026-06-10T10:00:00Z'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    type: 'text',
    content: '好的，我将为您执行 NDVI 分析。首先让我检查工作区文件结构...',
    timestamp: '2026-06-10T10:00:02Z',
    toolCall: {
      id: 'tc-1',
      toolName: 'list_files',
      input: { path: '/workspace' },
      status: 'completed',
      output: '找到 15 个文件',
      duration: 0.5
    }
  },
  {
    id: 'msg-3',
    role: 'assistant',
    type: 'approval',
    content: '需要运行 Python 脚本，这将执行本地计算',
    timestamp: '2026-06-10T10:00:05Z',
    approval: {
      id: 'approval-1',
      taskId: 'task-001',
      action: 'run_python',
      title: '运行 Python 脚本',
      description: '将执行 ndvi_analysis.py 脚本进行植被指数计算',
      riskLevel: 'medium',
      command: 'python ndvi_analysis.py',
      requestedAt: '2026-06-10T10:00:05Z'
    }
  },
  {
    id: 'msg-4',
    role: 'assistant',
    type: 'text',
    content: '脚本执行完成，正在生成地图预览...',
    timestamp: '2026-06-10T10:01:00Z',
    toolCall: {
      id: 'tc-2',
      toolName: 'map_preview',
      input: { data: 'ndvi_results' },
      status: 'completed',
      output: '地图已生成',
      duration: 5.2
    }
  }
]

export const mockNavItems: NavItem[] = [
  { id: 'nav-1', type: 'user-question', messageId: 'msg-1', label: '用户提问' },
  { id: 'nav-2', type: 'agent-plan', messageId: 'msg-2', label: 'Agent 计划' },
  { id: 'nav-3', type: 'tool-call', messageId: 'msg-2', label: '工具调用' },
  { id: 'nav-4', type: 'error', messageId: 'msg-3', label: '审批请求' },
  { id: 'nav-5', type: 'artifact', messageId: 'msg-4', label: '产物生成' }
]
