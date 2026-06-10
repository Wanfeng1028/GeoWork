// GeoWork Types - Task

import type { Artifact } from './artifact'

export type TaskStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'recovered';

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskStep {
  id: string;
  title: string;
  status: TaskStepStatus;
  toolName?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  mode: string;
  permissionLevel: string;
  model?: string;
  status: TaskStatus;
  plan: TaskStep[];
  artifacts: Artifact[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface RuntimeEvent {
  id: string;
  taskId: string;
  type: string; // task.started, task.progress, tool.call.started, etc.
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  events: RuntimeEvent[];
  isLoading: boolean;
  error: string | null;
}
