// GeoWork Mock - Artifacts Data

import type { Artifact } from '../types/artifact'

export const mockArtifacts: Artifact[] = [
  {
    id: 'art-001',
    taskId: 'task-001',
    workspaceId: 'ws-001',
    type: 'code',
    name: 'ndvi_analysis.py',
    path: '/workspace/scripts/ndvi_analysis.py',
    mimeType: 'text/x-python',
    createdAt: '2026-06-10T10:00:15Z'
  },
  {
    id: 'art-002',
    taskId: 'task-001',
    workspaceId: 'ws-001',
    type: 'map',
    name: 'ndvi_map_preview.png',
    path: '/workspace/artifacts/ndvi_map_preview.png',
    mimeType: 'image/png',
    previewPath: '/workspace/artifacts/ndvi_map_preview_thumb.png',
    createdAt: '2026-06-10T10:01:00Z'
  },
  {
    id: 'art-003',
    taskId: 'task-001',
    workspaceId: 'ws-001',
    type: 'document',
    name: 'ndvi_report.md',
    path: '/workspace/docs/ndvi_report.md',
    mimeType: 'text/markdown',
    createdAt: '2026-06-10T10:01:30Z'
  },
  {
    id: 'art-004',
    taskId: 'task-001',
    workspaceId: 'ws-001',
    type: 'data',
    name: 'ndvi_results.csv',
    path: '/workspace/data/ndvi_results.csv',
    mimeType: 'text/csv',
    createdAt: '2026-06-10T10:01:45Z'
  },
  {
    id: 'art-005',
    taskId: 'task-001',
    workspaceId: 'ws-001',
    type: 'log',
    name: 'task_001.log',
    path: '/workspace/logs/task_001.log',
    mimeType: 'text/plain',
    createdAt: '2026-06-10T10:02:00Z'
  }
]
