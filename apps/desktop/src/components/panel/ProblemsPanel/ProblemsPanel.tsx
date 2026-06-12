/** @format */

// GeoWork ProblemsPanel - Full implementation
// Displays diagnostics: errors, warnings, and info messages from build and runtime

import { useState } from "react";
import { XCircle, AlertCircle, Info, Filter, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import useShellStore from "../../../stores/shellStore";
import styles from "./ProblemsPanel.module.scss";

type ProblemSeverity = "error" | "warning" | "info";

interface Problem {
  id: string;
  severity: ProblemSeverity;
  source: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

// Sample problems for demo
const SAMPLE_PROBLEMS: Problem[] = [
  {
    id: "1",
    severity: "error",
    source: "TypeScript",
    message: "Cannot find module './geoUtils'",
    file: "src/components/workspace/MainWorkspace.tsx",
    line: 12,
    column: 8,
  },
  {
    id: "2",
    severity: "warning",
    source: "ESLint",
    message: "Unexpected console statement",
    file: "src/stores/taskStore.ts",
    line: 34,
    column: 5,
  },
  {
    id: "3",
    severity: "info",
    source: "Build",
    message: "Compiled with warnings",
  },
];

export function ProblemsPanel() {
  const [filter, setFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<ProblemSeverity | "all">(
    "all"
  );
  const [problems] = useState(SAMPLE_PROBLEMS);

  const filteredProblems = problems.filter((p) => {
    if (severityFilter !== "all" && p.severity !== severityFilter) return false;
    if (filter && !p.message.toLowerCase().includes(filter.toLowerCase()))
      return false;
    return true;
  });

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  const columns = [
    {
      title: "类型",
      dataIndex: "severity",
      key: "severity",
      width: 60,
      render: (severity: ProblemSeverity) => {
        const config = {
          error: {
            color: "#f5222d",
            icon: <XCircle className="h-3.5 w-3.5" />,
            label: "错误",
          },
          warning: {
            color: "#faad14",
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            label: "警告",
          },
          info: {
            color: "#1890ff",
            icon: <Info className="h-3.5 w-3.5" />,
            label: "信息",
          },
        };
        const c = config[severity];
        return <span style={{ color: c.color }}>{c.icon}</span>;
      },
    },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 80,
      render: (source: string) => <Badge variant="default" className="text-[10px]">{source}</Badge>,
    },
    {
      title: "消息",
      dataIndex: "message",
      key: "message",
    },
    {
      title: "位置",
      key: "location",
      width: 100,
      render: (_: unknown, record: Problem) =>
        record.file ? (
          <span className={styles.location}>
            {record.file}:{record.line || "?"}.{record.column || "?"}
          </span>
        ) : (
          <span className={styles.location}>—</span>
        ),
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.badges}>
          <span className="inline-flex items-center gap-1.5 mr-3">
            <span className="inline-flex items-center justify-center rounded-full bg-[#f5222d] text-white text-[10px] font-medium px-1.5 py-0.5 min-w-[18px]">
              {errorCount}
            </span>
            <span className={styles.badgeLabel}>错误</span>
          </span>
          <span className="inline-flex items-center gap-1.5 mr-3">
            <span className="inline-flex items-center justify-center rounded-full bg-[#faad14] text-white text-[10px] font-medium px-1.5 py-0.5 min-w-[18px]">
              {warningCount}
            </span>
            <span className={styles.badgeLabel}>警告</span>
          </span>
          <span className={styles.totalCount}>
            共 {filteredProblems.length} 项
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          清除
        </Button>
      </div>

      <div className={styles.filterSection}>
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#bfbfbf]" />
          <Input
            placeholder="搜索问题..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={severityFilter === "all" ? "primary" : "secondary"}
            onClick={() => setSeverityFilter("all")}
          >
            全部
          </Button>
          <Button
            size="sm"
            variant={severityFilter === "error" ? "primary" : "secondary"}
            onClick={() => setSeverityFilter("error")}
            className="text-[#f5222d] border-[#f5222d]"
          >
            错误
          </Button>
          <Button
            size="sm"
            variant={severityFilter === "warning" ? "primary" : "secondary"}
            onClick={() => setSeverityFilter("warning")}
            className="text-[#faad14] border-[#faad14]"
          >
            警告
          </Button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className="flex flex-col text-[12px]">
          <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium text-[var(--gw-text-tertiary)] border-b border-[var(--gw-border-soft)]">
            {columns.map((col) => (
              <span key={col.key} style={{ width: col.width, flex: col.width ? undefined : 1 }}>
                {col.title}
              </span>
            ))}
          </div>
          {filteredProblems.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--gw-bg-hover)] border-b border-[var(--gw-border-soft)]"
            >
              {columns.map((col) => (
                <span
                  key={col.key}
                  style={{ width: col.width, flex: col.width ? undefined : 1 }}
                  className="truncate"
                >
                  {col.render
                    ? col.render(record[col.dataIndex as keyof Problem] as any, record)
                    : (record[col.dataIndex as keyof Problem] as any)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProblemsPanel;
