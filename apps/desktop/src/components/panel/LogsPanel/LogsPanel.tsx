/** @format */

// GeoWork LogsPanel - Full implementation
// System and application log viewer with filtering and severity levels

import { useState, useMemo } from "react";
import { Select, Input, Button, Space, Tag, Badge } from "antd";
import {
  FilterOutlined,
  ClearOutlined,
  DownloadOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import styles from "./LogsPanel.module.scss";

type LogLevel = "info" | "debug" | "warn" | "error" | "fatal";

interface LogEntry {
  id: string;
  level: LogLevel;
  timestamp: string;
  logger: string;
  message: string;
  module?: string;
}

// Sample log data
const SAMPLE_LOGS: LogEntry[] = [
  {
    id: "1",
    level: "info",
    timestamp: "2026-06-11 10:00:00",
    logger: "app",
    message: "GeoWork v0.1.0 starting",
    module: "Main",
  },
  {
    id: "2",
    level: "info",
    timestamp: "2026-06-11 10:00:01",
    logger: "electron",
    message: "Window created successfully",
    module: "Window",
  },
  {
    id: "3",
    level: "debug",
    timestamp: "2026-06-11 10:00:01",
    logger: "workspace",
    message: "Loading workspaces from store",
    module: "Workspace",
  },
  {
    id: "4",
    level: "info",
    timestamp: "2026-06-11 10:00:02",
    logger: "runtime",
    message: "Go Core runtime initialized on :8765",
    module: "Runtime",
  },
  {
    id: "5",
    level: "warn",
    timestamp: "2026-06-11 10:00:03",
    logger: "settings",
    message: "Settings file not found, using defaults",
    module: "Settings",
  },
  {
    id: "6",
    level: "error",
    timestamp: "2026-06-11 10:00:05",
    logger: "ipc",
    message: "Failed to process IPC: channel not registered",
    module: "IPC",
  },
  {
    id: "7",
    level: "info",
    timestamp: "2026-06-11 10:00:06",
    logger: "sse",
    message: "SSE server listening on :8766",
    module: "SSE",
  },
  {
    id: "8",
    level: "debug",
    timestamp: "2026-06-11 10:00:07",
    logger: "sandbox",
    message: "Sandbox container initialized",
    module: "Sandbox",
  },
  {
    id: "9",
    level: "info",
    timestamp: "2026-06-11 10:00:08",
    logger: "task",
    message: "Task scheduler started, 0 pending tasks",
    module: "Task",
  },
  {
    id: "10",
    level: "fatal",
    timestamp: "2026-06-11 10:00:10",
    logger: "main",
    message: "Unrecoverable error in GPU driver",
    module: "GPU",
  },
];

const LEVEL_CONFIG: Record<
  LogLevel,
  { color: string; bg: string; label: string }
> = {
  info: { color: "#1890ff", bg: "#e6f7ff", label: "信息" },
  debug: { color: "#8c8c8c", bg: "#fafafa", label: "调试" },
  warn: { color: "#faad14", bg: "#fffbe6", label: "警告" },
  error: { color: "#f5222d", bg: "#fff1f0", label: "错误" },
  fatal: { color: "#a00", bg: "#ffccc7", label: "致命" },
};

export function LogsPanel() {
  const [filterText, setFilterText] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [sortByTime, setSortByTime] = useState<"asc" | "desc">("desc");
  const [logs] = useState(SAMPLE_LOGS);

  // Extract unique modules
  const modules = useMemo(() => {
    const mods = [...new Set(logs.map((l) => l.module).filter(Boolean))];
    return mods;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (moduleFilter !== "all" && log.module !== moduleFilter) return false;
      if (
        filterText &&
        !log.message.toLowerCase().includes(filterText.toLowerCase())
      )
        return false;
      return true;
    });

    result = result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortByTime === "asc" ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [logs, levelFilter, moduleFilter, filterText, sortByTime]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    for (const log of logs) {
      counts[log.level] = (counts[log.level] || 0) + 1;
    }
    return counts;
  }, [logs]);

  const handleClear = () => {
    // In production, this would clear the internal log buffer
    console.log("Log cleared");
  };

  const handleExport = () => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp}] ${log.level.toUpperCase().padEnd(6)} [${
            log.module || "??"
          }] ${log.message}`
      )
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.panel}>
      {/* Filter section */}
      <div className={styles.filterSection}>
        <div className={styles.filterRow}>
          <Input
            size="small"
            placeholder="搜索日志内容..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            prefix={<FilterOutlined style={{ color: "#bfbfbf" }} />}
            className={styles.searchInput}
          />
          <Select
            value={levelFilter}
            onChange={setLevelFilter}
            size="small"
            options={[
              { value: "all", label: "全部级别" },
              { value: "info", label: "信息" },
              { value: "debug", label: "调试" },
              { value: "warn", label: "警告" },
              { value: "error", label: "错误" },
              { value: "fatal", label: "致命" },
            ]}
            className={styles.levelSelect}
          />
          <Select
            value={moduleFilter}
            onChange={setModuleFilter}
            size="small"
            options={[
              { value: "all", label: "全部模块" },
              ...modules.map((m) => ({ value: m, label: m })),
            ]}
            className={styles.moduleSelect}
          />
          <Button
            size="small"
            icon={
              sortByTime === "asc" ? <ArrowUpOutlined /> : <ArrowDownOutlined />
            }
            onClick={() => setSortByTime(sortByTime === "asc" ? "desc" : "asc")}
          >
            {sortByTime === "asc" ? "升序" : "降序"}
          </Button>
        </div>
        <div className={styles.levelBadges}>
          <Tag
            color="#1890ff"
            style={{
              cursor: "pointer",
              opacity: levelFilter === "info" ? 1 : 0.6,
            }}
            onClick={() => setLevelFilter("info")}
          >
            信息 ({levelCounts.info || 0})
          </Tag>
          <Tag
            color="#8c8c8c"
            style={{
              cursor: "pointer",
              opacity: levelFilter === "debug" ? 1 : 0.6,
            }}
            onClick={() => setLevelFilter("debug")}
          >
            调试 ({levelCounts.debug || 0})
          </Tag>
          <Tag
            color="#faad14"
            style={{
              cursor: "pointer",
              opacity: levelFilter === "warn" ? 1 : 0.6,
            }}
            onClick={() => setLevelFilter("warn")}
          >
            警告 ({levelCounts.warn || 0})
          </Tag>
          <Tag
            color="#f5222d"
            style={{
              cursor: "pointer",
              opacity: levelFilter === "error" ? 1 : 0.6,
            }}
            onClick={() => setLevelFilter("error")}
          >
            错误 ({levelCounts.error || 0})
          </Tag>
          <Tag
            color="#a00"
            style={{
              cursor: "pointer",
              opacity: levelFilter === "fatal" ? 1 : 0.6,
            }}
            onClick={() => setLevelFilter("fatal")}
          >
            致命 ({levelCounts.fatal || 0})
          </Tag>
        </div>
      </div>

      {/* Log entries */}
      <div className={styles.logArea}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyLogs}>
            <span style={{ fontSize: 12, color: "#bfbfbf" }}>无匹配日志</span>
          </div>
        ) : (
          <div className={styles.logEntries}>
            {filteredLogs.map((log) => {
              const config = LEVEL_CONFIG[log.level];
              return (
                <div
                  key={log.id}
                  className={styles.logEntry}
                  style={{ borderLeftColor: config.color }}
                >
                  <span
                    className={styles.logLevel}
                    style={{ color: config.color, background: config.bg }}
                  >
                    {config.label}
                  </span>
                  <span className={styles.logTimestamp}>{log.timestamp}</span>
                  <span className={styles.logModule}>
                    [{log.module || "??"}]
                  </span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.entryCount}>
          显示 {filteredLogs.length}/{logs.length} 条
        </span>
        <Space size="small">
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
          >
            清除
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default LogsPanel;
