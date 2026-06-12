import { toast } from 'sonner'
import type { RightPanelType } from '../types/shell'
import useShellStore from '../stores/shellStore'

export type ActionStatus = 'implemented' | 'dev' | 'disabled'

export interface ShellAction {
  id: string
  label: string
  status: ActionStatus
  fallbackMessage: string
  handler: (payload?: unknown) => void | Promise<void>
}

const navLabels: Record<string, string> = {
  workbench: '新建任务',
  expert: '专家系统',
  assistant: '助理系统',
  automation: '自动化',
  skills: '技能',
  extensions: '扩展 / 插件',
  mcp: 'MCP',
  scheduler: '定时任务',
  files: '文件系统',
  papers: '论文检索',
  knowledge: '知识库',
  map: '地图与图层',
  gee: 'GEE 平台',
  tasks: '任务',
  channels: '频道',
  messaging: '消息入口',
  settings: '设置',
}

const devModules = new Set(['assistant', 'mcp', 'gee', 'tasks', 'channels', 'messaging'])

function switchMainModule(key: string) {
  const shell = useShellStore.getState()
  shell.setActiveNavKey(key)

  if (key === 'workbench') {
    shell.closeRightDock()
    shell.focusComposer()
  }

  if (devModules.has(key)) {
    toast.warning(`${navLabels[key] ?? '该能力'}仍在开发中`)
  }
}

export const actionRegistry: Record<string, ShellAction> = {
  createTask: {
    id: 'createTask',
    label: '新建任务',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('workbench'),
  },
  openSettings: {
    id: 'openSettings',
    label: '打开设置',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('settings'),
  },
  toggleSidebar: {
    id: 'toggleSidebar',
    label: '折叠侧栏',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => useShellStore.getState().toggleSidebar(),
  },
  openCommandPalette: {
    id: 'openCommandPalette',
    label: '打开命令面板',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => useShellStore.getState().setCommandPaletteOpen(true),
  },
  openRightDock: {
    id: 'openRightDock',
    label: '打开右侧面板',
    status: 'implemented',
    fallbackMessage: '',
    handler: (panel) => useShellStore.getState().openRightDock(panel as RightPanelType | undefined),
  },
  closeRightDock: {
    id: 'closeRightDock',
    label: '关闭右侧面板',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => useShellStore.getState().closeRightDock(),
  },
  switchMainModule: {
    id: 'switchMainModule',
    label: '切换模块',
    status: 'implemented',
    fallbackMessage: '',
    handler: (key) => switchMainModule(String(key ?? 'workbench')),
  },
  openSkillMarket: {
    id: 'openSkillMarket',
    label: '技能',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('skills'),
  },
  openExpertSystem: {
    id: 'openExpertSystem',
    label: '专家系统',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('expert'),
  },
  openAssistantSystem: {
    id: 'openAssistantSystem',
    label: '助理系统',
    status: 'dev',
    fallbackMessage: '助理系统仍在开发中',
    handler: () => switchMainModule('assistant'),
  },
  openAutomation: {
    id: 'openAutomation',
    label: '自动化',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('automation'),
  },
  openMCP: {
    id: 'openMCP',
    label: 'MCP',
    status: 'dev',
    fallbackMessage: 'MCP 管理仍在开发中',
    handler: () => switchMainModule('mcp'),
  },
  openScheduler: {
    id: 'openScheduler',
    label: '定时任务',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('scheduler'),
  },
  openFileSystem: {
    id: 'openFileSystem',
    label: '文件系统',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('files'),
  },
  openPaperSearch: {
    id: 'openPaperSearch',
    label: '论文检索',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('papers'),
  },
  openKnowledgeBase: {
    id: 'openKnowledgeBase',
    label: '知识库',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('knowledge'),
  },
  openMapLayers: {
    id: 'openMapLayers',
    label: '地图与图层',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => switchMainModule('map'),
  },
  openGEE: {
    id: 'openGEE',
    label: 'GEE 平台',
    status: 'dev',
    fallbackMessage: 'GEE 平台仍在开发中',
    handler: () => switchMainModule('gee'),
  },
  attachFile: {
    id: 'attachFile',
    label: '添加文件',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => { toast.info('请选择要附加的文件') },
  },
  selectModel: {
    id: 'selectModel',
    label: '选择模型',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => { toast.info('请从模型菜单选择模型') },
  },
  selectPermission: {
    id: 'selectPermission',
    label: '选择权限',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => { toast.info('请从权限菜单选择权限') },
  },
  selectMode: {
    id: 'selectMode',
    label: '选择模式',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => { toast.info('请选择任务模式') },
  },
  sendMessage: {
    id: 'sendMessage',
    label: '发送消息',
    status: 'implemented',
    fallbackMessage: '',
    handler: () => useShellStore.getState().focusComposer(),
  },
}

export function runAction(id: string, payload?: unknown) {
  const action = actionRegistry[id]
  if (!action) {
    toast.warning('该能力仍在开发中')
    return
  }

  if (action.status === 'disabled') {
    toast.warning(action.fallbackMessage || '该能力暂不可用')
    return
  }

  return action.handler(payload)
}

export const commandPaletteActions = [
  actionRegistry.createTask,
  actionRegistry.openExpertSystem,
  actionRegistry.openAutomation,
  actionRegistry.openSkillMarket,
  actionRegistry.openFileSystem,
  actionRegistry.openPaperSearch,
  actionRegistry.openKnowledgeBase,
  actionRegistry.openMapLayers,
  actionRegistry.openRightDock,
  actionRegistry.openSettings,
]
