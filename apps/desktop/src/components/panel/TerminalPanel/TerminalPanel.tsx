import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from 'antd';
import {
  ClearOutlined,
  PlusOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import styles from './TerminalPanel.module.scss';

interface CommandEntry {
  id: number;
  text: string;
}

const MOCK_OUTPUT_LINES: (
  | { type: 'prompt'; text: string }
  | { type: 'output'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'error'; text: string }
  | { type: 'info'; text: string }
)[] = [
  { type: 'info', text: 'GeoWork Terminal v1.0.0 — Build 2026.06.11' },
  { type: 'info', text: 'Copyright (c) 2026 GeoWork Project. All rights reserved.' },
  { type: 'output', text: '' },
  { type: 'info', text: 'Type "help" for available commands.' },
  { type: 'output', text: '' },
  { type: 'prompt', text: 'ls -la' },
  { type: 'output', text: 'drwxr-xr-x  12 user  staff   384 Jun 11 09:00 .' },
  { type: 'output', text: 'drwxr-xr-x   4 user  staff   128 Jun 10 14:30 ..' },
  { type: 'output', text: '-rw-r--r--   1 user  staff  1024 Jun 11 08:45 .gitignore' },
  { type: 'output', text: '-rw-r--r--   1 user  staff  2048 Jun 11 08:45 go.mod' },
  { type: 'output', text: '-rw-r--r--   1 user  staff  4096 Jun 11 08:45 go.sum' },
  { type: 'output', text: 'drwxr-xr-x   8 user  staff   256 Jun 11 08:45 apps/' },
  { type: 'output', text: 'drwxr-xr-x   5 user  staff   160 Jun 11 08:45 core/' },
  { type: 'output', text: 'drwxr-xr-x   3 user  staff    96 Jun 10 16:20 docs/' },
  { type: 'output', text: 'drwxr-xr-x   6 user  staff   192 Jun 11 08:45 assets/' },
  { type: 'output', text: '' },
  { type: 'prompt', text: 'cd apps/desktop' },
  { type: 'prompt', text: 'npm run dev' },
  { type: 'warning', text: 'Warning: dev mode — hot reload is enabled.' },
  { type: 'info', text: '  ➜  Local:   http://localhost:5173/' },
  { type: 'info', text: '  ➜  Network: http://192.168.1.42:5173/' },
  { type: 'output', text: '' },
  { type: 'output', text: '  VITE v5.4.0  ready in 342 ms' },
  { type: 'output', text: '' },
  { type: 'prompt', text: 'echo "Build succeeded"' },
  { type: 'output', text: 'Build succeeded' },
  { type: 'output', text: '' },
  { type: 'prompt', text: 'git status' },
  { type: 'output', text: 'On branch main' },
  { type: 'output', text: 'Your branch is up to date with \'origin/main\'.' },
  { type: 'output', text: '' },
  { type: 'output', text: 'Changes not staged for commit:' },
  { type: 'warning', text: '        modified:   apps/desktop/src/components/panel/TerminalPanel/TerminalPanel.tsx' },
  { type: 'output', text: '' },
];

const PROMPT_TEXT = 'user@geowork:~$ ';

const TerminalPanel: React.FC = () => {
  const [history, setHistory] = useState<
    Array<{ type: 'prompt' | 'output' | 'warning' | 'error' | 'info'; text: string; id: number }>
  >(MOCK_OUTPUT_LINES.map((line) => ({ ...line, id: nextId.current++ })));
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const generateId = useCallback(() => ++nextId.current, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [history]);

  const addLine = useCallback(
    (text: string, type: 'prompt' | 'output' | 'warning' | 'error' | 'info' = 'output') => {
      setHistory((prev) => [...prev, { id: generateId(), type, text }]);
    },
    [generateId],
  );

  const executeCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      // Echo the command
      addLine(trimmed, 'output');

      // Process the command
      const lower = trimmed.toLowerCase();
      if (lower === 'help') {
        addLine('Available commands: help, clear, echo <text>, date, whoami, pwd', 'info');
      } else if (lower === 'clear') {
        setHistory(MOCK_OUTPUT_LINES);
      } else if (lower.startsWith('echo ')) {
        addLine(trimmed.substring(5), 'output');
      } else if (lower === 'date') {
        addLine(new Date().toString(), 'output');
      } else if (lower === 'whoami') {
        addLine('user', 'output');
      } else if (lower === 'pwd') {
        addLine('/home/user/geowork', 'output');
      } else if (lower === 'ls') {
        addLine('apps/  core/  docs/  assets/  packages.json  go.mod  README.md', 'output');
      } else if (lower === 'pwd') {
        addLine('/home/user/geowork', 'output');
      } else if (lower.includes('warning')) {
        addLine('Warning: this command may have side effects.', 'warning');
      } else if (lower.includes('error')) {
        addLine('Error: command failed with exit code 1.', 'error');
      } else {
        addLine(`bash: ${trimmed}: command not found`, 'error');
      }
    },
    [addLine],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeCommand(inputValue);
        setInputValue('');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue('');
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Placeholder: basic tab completion
        const words = ['help', 'clear', 'echo', 'date', 'whoami', 'pwd', 'ls'];
        const match = words.find((w) => w.startsWith(inputValue.toLowerCase()));
        if (match) {
          setInputValue(match);
        }
      }
    },
    [inputValue, commandHistory, historyIndex, executeCommand],
  );

  const handleClear = useCallback(() => {
    setHistory(MOCK_OUTPUT_LINES);
  }, []);

  const handleNewTab = useCallback(() => {
    setHistory(MOCK_OUTPUT_LINES);
    setInputValue('');
    setCommandHistory([]);
    setHistoryIndex(-1);
  }, []);

  const renderLine = (entry: (typeof MOCK_OUTPUT_LINES)[0] & { id: number }) => {
    const lineClass =
      entry.type === 'warning'
        ? styles.warning
        : entry.type === 'error'
          ? styles.error
          : entry.type === 'info'
            ? styles.info
            : styles.outputText;

    if (entry.type === 'prompt') {
      return (
        <div className={styles.outputLine} key={entry.id}>
          <span className={styles.prompt}>{PROMPT_TEXT}</span>
          <span className={lineClass}>{entry.text}</span>
        </div>
      );
    }

    if (entry.type === 'info') {
      return (
        <div className={styles.outputLine} key={entry.id}>
          <span className={styles.prompt}>{PROMPT_TEXT}</span>
          <span className={styles.info}>{entry.text}</span>
        </div>
      );
    }

    return <div className={styles.outputLine} key={entry.id}><span className={lineClass}>{entry.text}</span></div>;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Terminal</span>
        <div className={styles.actions}>
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
            title="Clear"
          />
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleNewTab}
            title="New Tab"
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            title="Close"
          />
        </div>
      </div>

      <div ref={outputRef} className={styles.output}>
        {history.map(renderLine)}

        <div className={styles.outputLine}>
          <span className={styles.prompt}>{PROMPT_TEXT}</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            autoFocus
          />
          <span className={styles.cursor} />
        </div>
      </div>
    </div>
  );
};

export default TerminalPanel;
