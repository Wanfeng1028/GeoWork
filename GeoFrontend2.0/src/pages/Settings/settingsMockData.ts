/**
 * GeoWork 设置中心 — Mock 数据
 */

export interface ArchivedTask {
  id: string
  title: string
  archivedAt: string
}

export const MOCK_ARCHIVED_TASKS: ArchivedTask[] = [
  { id: 'arch-1', title: 'DEM 坡度分析', archivedAt: '2026-06-28 14:30' },
  { id: 'arch-2', title: '生成 NDVI 变化检测报告', archivedAt: '2026-06-27 09:15' },
  { id: 'arch-3', title: '武汉缓冲区分析', archivedAt: '2026-06-25 16:42' },
  { id: 'arch-4', title: '规划地块适宜性评估', archivedAt: '2026-06-23 11:08' },
  { id: 'arch-5', title: '遥感影像云量检查', archivedAt: '2026-06-20 08:55' },
  { id: 'arch-6', title: '专题图制图说明', archivedAt: '2026-06-18 17:20' },
  { id: 'arch-7', title: 'GeoJSON 字段清洗', archivedAt: '2026-06-15 10:33' },
  { id: 'arch-8', title: '城市更新单元识别', archivedAt: '2026-06-12 13:47' },
]

export interface WorkspaceTemplate {
  id: string
  title: string
  description: string
  color: string
}

export const MOCK_WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  { id: 'tpl-1', title: '空间分析报告', description: '缓冲区、叠加、网络分析等空间操作结果汇总', color: '#2F80ED' },
  { id: 'tpl-2', title: '遥感监测周报', description: '多时相遥感影像变化检测与趋势分析', color: '#52C41A' },
  { id: 'tpl-3', title: '城市规划评估', description: '用地适宜性、容积率、交通可达性综合评估', color: '#FA8C16' },
  { id: 'tpl-4', title: '灾害风险简报', description: '洪涝、地质灾害风险快速研判与预警摘要', color: '#F5222D' },
  { id: 'tpl-5', title: '数据质检清单', description: '空间数据拓扑、属性完整性和坐标系统检查', color: '#722ED1' },
  { id: 'tpl-6', title: '专题地图说明', description: '地图图例、符号化和标注方案自动生成', color: '#13C2C2' },
]

export interface ShortcutItem {
  id: string
  title: string
  keys: string
  description: string
  group: string
}

export const MOCK_SHORTCUTS: ShortcutItem[] = [
  { id: 'sc-1', title: '打开设置', keys: 'Ctrl + ,', description: '打开 GeoWork 设置中心', group: '通用' },
  { id: 'sc-2', title: '切换侧边栏', keys: 'Ctrl + \\', description: '显示或隐藏侧边栏', group: '通用' },
  { id: 'sc-3', title: '打开全局搜索', keys: 'Ctrl + K', description: '快速搜索任务、文件和设置', group: '通用' },
  { id: 'sc-4', title: '新建任务', keys: 'Ctrl + N', description: '创建新的 GeoWork 任务', group: '任务' },
  { id: 'sc-5', title: '搜索全部任务', keys: 'Ctrl + G', description: '在任务列表中搜索', group: '任务' },
  { id: 'sc-6', title: '在当前任务中搜索', keys: 'Ctrl + F', description: '在当前对话中搜索内容', group: '任务' },
  { id: 'sc-7', title: '发送消息', keys: 'Enter', description: '发送当前输入的消息', group: '会话' },
  { id: 'sc-8', title: '插入换行', keys: 'Shift + Enter', description: '在输入框中插入换行', group: '会话' },
  { id: 'sc-9', title: '停止生成', keys: 'Esc', description: '停止当前正在生成的内容', group: '会话' },
]
