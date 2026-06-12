import {
  ListTodo, FileBox, GitCompare, Layers,
  Terminal, Globe, Radio, ScrollText, AlertTriangle, FileOutput,
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
    <aside className="shrink-0 h-full w-[360px] flex flex-col border-l border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] overflow-hidden">
      <Tabs
        defaultValue={activeRightPanel}
        onValueChange={(key) => setActiveRightPanel(key as any)}
        className="flex flex-col h-full"
      >
        <TabsList className="flex shrink-0 border-b border-[var(--gw-border-soft)] bg-[var(--gw-bg-shell)] px-1 py-0.5 overflow-x-auto">
          {PANELS.map((panel) => {
            const Icon = panel.icon
            return (
              <TabsTrigger
                key={panel.key}
                value={panel.key}
                title={panel.label}
                className="px-2 py-1"
              >
                <Icon size={14} />
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="task" className="h-full overflow-auto"><TaskMonitorPanel /></TabsContent>
          <TabsContent value="artifacts" className="h-full overflow-auto"><ArtifactPanel /></TabsContent>
          <TabsContent value="diff" className="h-full overflow-auto"><DiffPanel /></TabsContent>
          <TabsContent value="context" className="h-full overflow-auto"><ContextPanel /></TabsContent>
          <TabsContent value="terminal" className="h-full overflow-hidden"><TerminalComponent title="任务终端" /></TabsContent>
          <TabsContent value="browser" className="h-full overflow-auto"><BrowserPanel /></TabsContent>
          <TabsContent value="events" className="h-full overflow-auto"><RuntimeEvents /></TabsContent>
          <TabsContent value="logs" className="h-full overflow-auto"><LogsPanel /></TabsContent>
          <TabsContent value="problems" className="h-full overflow-auto"><ProblemsPanel /></TabsContent>
          <TabsContent value="output" className="h-full overflow-auto"><OutputPanel /></TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}
