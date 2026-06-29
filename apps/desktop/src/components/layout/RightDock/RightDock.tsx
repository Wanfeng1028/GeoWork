import {
  ListTodo, FileBox, GitCompare, Layers,
  Terminal, Globe, Radio, ScrollText, AlertTriangle, FileOutput,
} from 'lucide-react'
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

const PANELS = [
  { key: 'task', label: '任务', icon: ListTodo },
  { key: 'artifacts', label: '产物', icon: FileBox },
  { key: 'diff', label: '差异', icon: GitCompare },
  { key: 'context', label: '上下文', icon: Layers },
  { key: 'terminal', label: '终端', icon: Terminal },
  { key: 'browser', label: '浏览器', icon: Globe },
  { key: 'events', label: '事件', icon: Radio },
  { key: 'logs', label: '日志', icon: ScrollText },
  { key: 'problems', label: '问题', icon: AlertTriangle },
  { key: 'output', label: '输出', icon: FileOutput },
]

export function RightDock() {
  const { activeRightPanel, setActiveRightPanel } = useShellStore()

  return (
    <aside className={styles.dock}>
      <Tabs
        defaultValue={activeRightPanel}
        onValueChange={(key) => setActiveRightPanel(key as any)}
        className={styles.tabs}
      >
        <TabsList className={styles.tabsList}>
          {PANELS.map((panel) => {
            const Icon = panel.icon
            return (
              <TabsTrigger
                key={panel.key}
                value={panel.key}
                title={panel.label}
                className={styles.tabTrigger}
              >
                <Icon size={14} />
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div className={styles.content}>
          <TabsContent value="task" className={styles.panelContent}><TaskMonitorPanel /></TabsContent>
          <TabsContent value="artifacts" className={styles.panelContent}><ArtifactPanel /></TabsContent>
          <TabsContent value="diff" className={styles.panelContent}><DiffPanel /></TabsContent>
          <TabsContent value="context" className={styles.panelContent}><ContextPanel /></TabsContent>
          <TabsContent value="terminal" className={styles.panelContent}><TerminalComponent title="任务终端" /></TabsContent>
          <TabsContent value="browser" className={styles.panelContent}><BrowserPanel /></TabsContent>
          <TabsContent value="events" className={styles.panelContent}><RuntimeEvents /></TabsContent>
          <TabsContent value="logs" className={styles.panelContent}><LogsPanel /></TabsContent>
          <TabsContent value="problems" className={styles.panelContent}><ProblemsPanel /></TabsContent>
          <TabsContent value="output" className={styles.panelContent}><OutputPanel /></TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}

