// GeoWork Mock - Tasks Data

import type { Task, TaskStep, RuntimeEvent } from '../types/task'

export const mockSteps: TaskStep[] = [
  {
    id: 'step-1',
    title: '分析用户请求',
    status: 'completed',
    toolName: 'intent_parser',
    startedAt: '2026-06-10T10:00:00Z',
    completedAt: '2026-06-10T10:00:05Z'
  },
  {
    id: 'step-2',
    title: '读取工作区文件',
    status: 'completed',
    toolName: 'read_file',
    startedAt: '2026-06-10T10:00:05Z',
    completedAt: '2026-06-10T10:00:10Z'
  },
  {
    id: 'step-3',
    title: '运行 NDVI 分析脚本',
    status: 'running',
    toolName: 'run_python',
    startedAt: '2026-06-10T10:00:10Z'
  },
  {
    id: 'step-4',
    title: '生成地图预览',
    status: 'pending',
    toolName: 'map_preview'
  },
  {
    id: 'step-5',
    title: '创建交付物清单',
    status: 'pending',
    toolName: 'create_artifact'
  }
]

export const mockTask: Task = {
  id: 'task-001',
  workspaceId: 'ws-001',
  mode: 'Analysis',
  permissionLevel: 'limited',
  model: 'gpt-4',
  status: 'running',
  plan: mockSteps,
  artifacts: [
    {
      id: 'art-001',
      taskId: 'task-001',
      workspaceId: 'ws-001',
      type: 'code',
      name: 'ndvi_analysis.py',
      path: '/workspace/scripts/ndvi_analysis.py',
      mimeType: 'text/x-python',
      createdAt: '2026-06-10T10:00:15Z'
    }
  ],
  createdAt: '2026-06-10T10:00:00Z',
  updatedAt: '2026-06-10T10:00:10Z'
}

export const mockEvents: RuntimeEvent[] = [
  {
    id: 'evt-1',
    taskId: 'task-001',
    type: 'task.started',
    message: '任务已创建并开始执行',
    timestamp: '2026-06-10T10:00:00Z'
  },
  {
    id: 'evt-2',
    taskId: 'task-001',
    type: 'task.progress',
    message: '正在分析用户请求...',
    timestamp: '2026-06-10T10:00:02Z'
  },
  {
    id: 'evt-3',
    taskId: 'task-001',
    type: 'tool.call.started',
    message: '调用工具: intent_parser',
    timestamp: '2026-06-10T10:00:02Z'
  },
  {
    id: 'evt-4',
    taskId: 'task-001',
    type: 'tool.call.completed',
    message: '工具调用完成: intent_parser',
    timestamp: '2026-06-10T10:00:05Z'
  },
  {
    id: 'evt-5',
    taskId: 'task-001',
    type: 'tool.call.started',
    message: '调用工具: read_file',
    timestamp: '2026-06-10T10:00:05Z'
  },
  {
    id: 'evt-6',
    taskId: 'task-001',
    type: 'tool.call.completed',
    message: '工具调用完成: read_file',
    timestamp: '2026-06-10T10:00:10Z'
  },
  {
    id: 'evt-7',
    taskId: 'task-001',
    type: 'tool.call.started',
    message: '调用工具: run_python',
    timestamp: '2026-06-10T10:00:10Z'
  }
]
