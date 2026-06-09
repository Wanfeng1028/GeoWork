import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XtermTerminal } from 'xterm'
import 'xterm/css/xterm.css'
import styles from './Terminal.module.scss'

export interface TerminalProps {
  initialLines?: string[]
  onCommand?: (command: string) => void
  autoScroll?: boolean
  title?: string
}

interface LogEntry {
  id: number
  text: string
  type: 'info' | 'success' | 'error' | 'command' | 'system'
}

const SYSTEM_PROMPT = 'GeoWork Terminal v1.0 — 输入命令执行任务 (模拟模式)'
const PROMPT_PREFIX = 'geowork > '

export function Terminal({
  initialLines = [],
  onCommand,
  autoScroll = true,
  title = '任务终端'
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XtermTerminal | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [command, setCommand] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)
  const isAutoScrollRef = useRef(autoScroll)

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const id = ++logIdRef.current
    setLogs((prev) => [...prev, { id, text, type }])
  }, [])

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XtermTerminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4dc9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#ff6b6b',
        brightGreen: '#8bc24a',
        brightYellow: '#ffd700',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
      },
      rows: 12
    })

    term.open(containerRef.current)
    terminalRef.current = term

    // Print system prompt
    term.writeln(`\x1b[32m${SYSTEM_PROMPT}\x1b[0m`)
    term.writeln('')
    term.writeln(`\x1b[36m提示: 输入命令并回车执行，例如:\x1b[0m`)
    term.writeln(`  \x1b[33mgee run script.py\x1b[0m  — 运行 GEE 脚本`)
    term.writeln(`  \x1b[33mgee status\x1b[0m      — 查看任务状态`)
    term.writeln(`  \x1b[33mgee clear\x1b[0m       — 清屏`)
    term.writeln('')

    // Print initial lines
    initialLines.forEach((line) => {
      term.writeln(line)
    })

    term.focus()

    return () => {
      term.dispose()
    }
  }, [])

  // Handle command input
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = command.trim()
    if (!trimmed) return

    // Echo command
    addLog(`${PROMPT_PREFIX}${trimmed}`, 'command')

    // Process command
    if (trimmed === 'gee clear' || trimmed === 'clear') {
      if (terminalRef.current) {
        terminalRef.current.clear()
        terminalRef.current.writeln(`\x1b[32m${SYSTEM_PROMPT}\x1b[0m`)
        terminalRef.current.writeln('')
      }
    } else if (trimmed === 'gee status' || trimmed === 'status') {
      addLog('任务状态: 运行中', 'info')
      addLog('当前任务: NDVI 实验报告生成', 'info')
      addLog('进度: 65%', 'success')
    } else if (trimmed === 'help') {
      addLog('可用命令:', 'system')
      addLog('  gee run <script>  — 运行 GEE 脚本', 'system')
      addLog('  gee status        — 查看任务状态', 'system')
      addLog('  gee clear         — 清屏', 'system')
      addLog('  help              — 显示帮助', 'system')
    } else {
      addLog(`执行: ${trimmed}`, 'info')
      addLog(`[模拟] 命令 "${trimmed}" 已提交到任务队列`, 'info')
      addLog(`[模拟] 等待执行结果...`, 'system')
      setTimeout(() => {
        addLog(`[模拟] 命令执行完成 (模拟模式)`, 'success')
      }, 800)
    }

    // Notify parent
    onCommand?.(trimmed)

    setCommand('')
  }, [command, onCommand, addLog])

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (!isAutoScrollRef.current) return
    const container = containerRef.current?.parentElement
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [logs])

  // Click to focus input
  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.headerActions}>
          <button
            className={styles.headerBtn}
            onClick={() => {
              if (terminalRef.current) {
                terminalRef.current.clear()
                addLog(SYSTEM_PROMPT, 'system')
              }
            }}
            title="清屏"
            aria-label="清屏"
          >
            清屏
          </button>
          <button
            className={styles.headerBtn}
            onClick={() => {
              isAutoScrollRef.current = !isAutoScrollRef.current
            }}
            title={isAutoScrollRef.current ? '锁定滚动' : '自动滚动'}
            aria-label="切换自动滚动"
          >
            {isAutoScrollRef.current ? '🔓' : '🔒'}
          </button>
        </div>
      </div>
      <div className={styles.terminalBody} onClick={handleContainerClick}>
        <div ref={containerRef} className={styles.terminal} />
      </div>
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <span className={styles.prompt}>{PROMPT_PREFIX}</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className={styles.input}
          placeholder="输入命令..."
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  )
}
