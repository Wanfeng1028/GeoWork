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
      <div
        onClick={() => setActiveRightPanel('task')}
        className={styles.tabs}
      >
        <div className={styles.tabsList}>
          {PANELS.map((panel) => {
            const Icon = panel.icon
            return (
              <button
                key={panel.key}
                className={styles.tabTrigger}
              >
                <Icon size={14} />
              </button>
            )
          })}
        </div>
        <div className={styles.content}>
          <div className={styles.panelContent}><TaskMonitorPanel /></div>
          <div className={styles.panelContent}><ArtifactPanel /></div>
          <div className={styles.panelContent}><DiffPanel /></div>
          <div className={styles.panelContent}><ContextPanel /></div>
          <div className={styles.panelContent}><TerminalComponent title="任务终端" /></div>
          <div className={styles.panelContent}><BrowserPanel /></div>
          <div className={styles.panelContent}><RuntimeEvents /></div>
          <div className={styles.panelContent}><LogsPanel /></div>
          <div className={styles.panelContent}><ProblemsPanel /></div>
          <div className={styles.panelContent}><OutputPanel /></div>
        </div>
      </div>
    </aside>
  )
}

