// GeoWork LogsPanel

import { useState, useMemo } from 'react'
import {
  Filter,
  Trash2,
  Download,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { cn } from '../../../lib/cn'
import styles from './LogsPanel.module.scss'

type LogLevel = 'info' | 'debug' | 'warn' | 'error' | 'fatal'

interface LogEntry {
  id: string
  level: LogLevel
  timestamp: string
  logger: string
  message: string
  module?: string
}

const SAMPLE_LOGS: LogEntry[] = [
  { id: '1', level: 'info', timestamp: '2026-06-11 10:00:00', logger: 'app', message: 'GeoWork v0.1.0 starting', module: 'Main' },
  { id: '2', level: 'info', timestamp: '2026-06-11 10:00:01', logger: 'electron', message: 'Window created successfully', module: 'Window' },
  { id: '3', level: 'debug', timestamp: '2026-06-11 10:00:01', logger: 'workspace', message: 'Loading workspaces from store', module: 'Workspace' },
  { id: '4', level: 'info', timestamp: '2026-06-11 10:00:02', logger: 'runtime', message: 'Go Core runtime initialized on :8765', module: 'Runtime' },
  { id: '5', level: 'warn', timestamp: '2026-06-11 10:00:03', logger: 'settings', message: 'Settings file not found, using defaults', module: 'Settings' },
  { id: '6', level: 'error', timestamp: '2026-06-11 10:00:05', logger: 'ipc', message: 'Failed to process IPC: channel not registered', module: 'IPC' },
  { id: '7', level: 'info', timestamp: '2026-06-11 10:00:06', logger: 'sse', message: 'SSE server listening on :8766', module: 'SSE' },
  { id: '8', level: 'debug', timestamp: '2026-06-11 10:00:07', logger: 'sandbox', message: 'Sandbox container initialized', module: 'Sandbox' },
  { id: '9', level: 'info', timestamp: '2026-06-11 10:00:08', logger: 'task', message: 'Task scheduler started, 0 pending tasks', module: 'Task' },
  { id: '10', level: 'fatal', timestamp: '2026-06-11 10:00:10', logger: 'main', message: 'Unrecoverable error in GPU driver', module: 'GPU' },
]

const LEVEL_VARIANT: Record<LogLevel, 'info' | 'default' | 'warning' | 'danger'> = {
  info: 'info',
  debug: 'default',
  warn: 'warning',
  error: 'danger',
  fatal: 'danger',
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: '信息',
  debug: '调试',
  warn: '警告',
  error: '错误',
  fatal: '致命',
}

export function LogsPanel() {
  const [filterText, setFilterText] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [sortByTime, setSortByTime] = useState<'asc' | 'desc'>('desc')
  const [logs] = useState(SAMPLE_LOGS)

  const modules = useMemo(() => {
    return [...new Set(logs.map((l) => l.module).filter(Boolean))]
  }, [logs])

  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false
      if (moduleFilter !== 'all' && log.module !== moduleFilter) return false
      if (filterText && !log.message.toLowerCase().includes(filterText.toLowerCase())) return false
      return true
    })

    result = result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return sortByTime === 'asc' ? timeA - timeB : timeB - timeA
    })

    return result
  }, [logs, levelFilter, moduleFilter, filterText, sortByTime])

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length }
    for (const log of logs) {
      counts[log.level] = (counts[log.level] || 0) + 1
    }
    return counts
  }, [logs])

  const handleExport = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] ${log.level.toUpperCase().padEnd(6)} [${log.module || '??'}] ${log.message}`)
      .join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <div className="relative flex-1">
            <Filter size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--gw-text-disabled)]" />
            <Input
              placeholder="搜索日志内容..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-7"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter as (v: string) => void}>
            <SelectTrigger className={styles.levelSelect}>
              <SelectValue placeholder="全部级别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部级别</SelectItem>
              <SelectItem value="info">信息</SelectItem>
              <SelectItem value="debug">调试</SelectItem>
              <SelectItem value="warn">警告</SelectItem>
              <SelectItem value="error">错误</SelectItem>
              <SelectItem value="fatal">致命</SelectItem>
            </SelectContent>
          </Select>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className={styles.moduleSelect}>
              <SelectValue placeholder="全部模块" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模块</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m} value={m!}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortByTime(sortByTime === 'asc' ? 'desc' : 'asc')}
          >
            {sortByTime === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {sortByTime === 'asc' ? '升序' : '降序'}
          </Button>
        </div>
        <div className={styles.levelBadges}>
          {(Object.keys(LEVEL_LABELS) as LogLevel[]).map((level) => (
            <Badge
              key={level}
              variant={LEVEL_VARIANT[level]}
              className={cn('cursor-pointer', levelFilter !== level && 'opacity-50')}
              onClick={() => setLevelFilter(level)}
            >
              {LEVEL_LABELS[level]} ({levelCounts[level] || 0})
            </Badge>
          ))}
        </div>
      </div>

      <div className={styles.logArea}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyLogs}>
            <span className="text-[12px] text-[var(--gw-text-disabled)]">无匹配日志</span>
          </div>
        ) : (
          <div className={styles.logEntries}>
            {filteredLogs.map((log) => (
              <div key={log.id} className={styles.logEntry}>
                <Badge variant={LEVEL_VARIANT[log.level]}>
                  {LEVEL_LABELS[log.level]}
                </Badge>
                <span className={styles.logTimestamp}>{log.timestamp}</span>
                <span className={styles.logModule}>[{log.module || '??'}]</span>
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.entryCount}>
          显示 {filteredLogs.length}/{logs.length} 条
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => console.log('Log cleared')}>
            <Trash2 size={14} /> 清除
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download size={14} /> 导出
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LogsPanel
