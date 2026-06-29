/** @format */

// GeoWork ProblemsPanel - Full implementation
// Displays diagnostics: errors, warnings, and info messages from build and runtime

import { useState } from "react";
import { XCircle, AlertCircle, Info, Filter, Trash2 } from "lucide-react";
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
            color: '',
            icon: <XCircle  />,
            label: "错误",
          },
          warning: {
            color: '',
            icon: <AlertCircle  />,
            label: "警告",
          },
          info: {
            color: '',
            icon: <Info  />,
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
      render: (source: string) => <Badge variant="default" >{source}</Badge>,
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
          <span >
            <span >
              {errorCount}
            </span>
            <span className={styles.badgeLabel}>错误</span>
          </span>
          <span >
            <span >
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
          <Trash2  />
          清除
        </Button>
      </div>

      <div className={styles.filterSection}>
        <div >
          <Filter  />
          <Input
            placeholder="搜索问题..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            
          />
        </div>
        <div >
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
            
          >
            错误
          </Button>
          <Button
            size="sm"
            variant={severityFilter === "warning" ? "primary" : "secondary"}
            onClick={() => setSeverityFilter("warning")}
            
          >
            警告
          </Button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className="flex-col">
          <div >
            {columns.map((col) => (
              <span key={col.key} style={{ width: col.width, flex: col.width ? undefined : 1 }}>
                {col.title}
              </span>
            ))}
          </div>
          {filteredProblems.map((record) => (
            <div
              key={record.id}
              
            >
              {columns.map((col) => (
                <span
                  key={col.key}
                  style={{ width: col.width, flex: col.width ? undefined : 1 }}
                  
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
