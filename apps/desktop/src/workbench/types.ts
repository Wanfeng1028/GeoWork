// GeoWork Desktop - Workbench Mode Types

export type WorkbenchMode = 'Research' | 'Data' | 'GeoCode' | 'Analysis' | 'Write'

export interface WorkbenchModeConfig {
  mode: WorkbenchMode
  label: string
  description: string
  icon: string
  primaryColor: string
  defaultPanels: string[]
}

export const WORKBENCH_MODES: Record<WorkbenchMode, WorkbenchModeConfig> = {
  Research: {
    mode: 'Research',
    label: '研究',
    description: '文献搜索、知识索引和学术分析',
    icon: '🔬',
    primaryColor: '#1677ff',
    defaultPanels: ['knowledge', 'papers', 'literature']
  },
  Data: {
    mode: 'Data',
    label: '数据',
    description: '数据集管理、注册和元数据浏览',
    icon: '📊',
    primaryColor: '#10b981',
    defaultPanels: ['dataset', 'metadata', 'preview']
  },
  GeoCode: {
    mode: 'GeoCode',
    label: '编码',
    description: '地理编码、脚本生成和 GEE 集成',
    icon: '💻',
    primaryColor: '#f59e0b',
    defaultPanels: ['script', 'gee', 'terminal']
  },
  Analysis: {
    mode: 'Analysis',
    label: '分析',
    description: '栅格/矢量分析、NDVI 计算和变化检测',
    icon: '📈',
    primaryColor: '#8b5cf6',
    defaultPanels: ['map', 'chart', 'results']
  },
  Write: {
    mode: 'Write',
    label: '写作',
    description: '报告生成、文档编辑和结果导出',
    icon: '📝',
    primaryColor: '#ec4899',
    defaultPanels: ['editor', 'artifacts', 'export']
  }
}

export function getModeConfig(mode: WorkbenchMode): WorkbenchModeConfig {
  return WORKBENCH_MODES[mode] || WORKBENCH_MODES.Research
}
