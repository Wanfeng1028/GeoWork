// GeoWork RightDock - All inspector panels

import {
  ListTodo,
  FileBox,
  GitCompare,
  Layers,
  Terminal,
  Globe,
  Radio,
  ScrollText,
  AlertTriangle,
  FileOutput,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { TaskMonitorPanel } from '../../panel/TaskMonitorPanel/TaskMonitorPanel'
import { ArtifactPanel } from '../../panel/ArtifactPanel/ArtifactPanel'
import { DiffPanel } from '../../panel/DiffPanel/DiffPanel'
import { ContextPanel } from '../../panel/ContextPanel/ContextPanel'
import { Terminal as TerminalComponent } from '../../common/Terminal'
import { BrowserPanel } from '../../panel/BrowserPanel/BrowserPanel'
import { RuntimeEvents } from '../../panel/RuntimeEvents/RuntimeEvents'
import { LogsPanel } from '../../panel/LogsPanel/LogsPanel'
import { ProblemsPanel } from '../../panel/ProblemsPanel/ProblemsPanel'
import { OutputPanel } from '../../panel/OutputPanel/OutputPanel'
import useShellStore from '../../../stores/shellStore'
import styles from './RightDock.module.scss'

const PANEL_GROUPS = [
  {
    label: '任务',
    panels: [
      { key: 'task', label: '任务', icon: ListTodo },
      { key: 'artifacts', label: '产物', icon: FileBox },
      { key: 'diff', label: '差异', icon: GitCompare },
      { key: 'context', label: '上下文', icon: Layers },
    ],
  },
  {
    label: '工具',
    panels: [
      { key: 'terminal', label: '终端', icon: Terminal },
      { key: 'browser', label: '浏览器', icon: Globe },
      { key: 'events', label: '事件', icon: Radio },
      { key: 'logs', label: '日志', icon: ScrollText },
      { key: 'problems', label: '问题', icon: AlertTriangle },
      { key: 'output', label: '输出', icon: FileOutput },
    ],
  },
]

export function RightDock() {
  const { activeRightPanel, setActiveRightPanel, closeRightDock } = useShellStore()

  return (
    <aside className={styles.dock}>
      <Tabs
        defaultValue={activeRightPanel}
        onValueChange={(key) => setActiveRightPanel(key as any)}
        className={styles.tabs}
      >
        <TabsList className={styles.tabsList}>
          {PANEL_GROUPS.map((group) =>
            group.panels.map((panel) => {
              const Icon = panel.icon
              return (
                <TabsTrigger
                  key={panel.key}
                  value={panel.key}
                  title={panel.label}
                  className="px-1.5"
                >
                  <Icon size={14} />
                </TabsTrigger>
              )
            }),
          )}
        </TabsList>
        <TabsContent value="task"><TaskMonitorPanel /></TabsContent>
        <TabsContent value="artifacts"><ArtifactPanel /></TabsContent>
        <TabsContent value="diff"><DiffPanel /></TabsContent>
        <TabsContent value="context"><ContextPanel /></TabsContent>
        <TabsContent value="terminal"><TerminalComponent title="任务终端" /></TabsContent>
        <TabsContent value="browser"><BrowserPanel /></TabsContent>
        <TabsContent value="events"><RuntimeEvents /></TabsContent>
        <TabsContent value="logs"><LogsPanel /></TabsContent>
        <TabsContent value="problems"><ProblemsPanel /></TabsContent>
        <TabsContent value="output"><OutputPanel /></TabsContent>
      </Tabs>
    </aside>
  )
}
