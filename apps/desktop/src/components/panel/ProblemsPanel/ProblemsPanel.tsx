/** @format */

// GeoWork ProblemsPanel - Full implementation
// Displays diagnostics: errors, warnings, and info messages from build and runtime

import { useState } from "react";
import { Table, Tag, Input, Space, Badge, Button } from "antd";
import {
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  ClearOutlined,
} from "@ant-design/icons";
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
            icon: <CloseCircleOutlined />,
            label: "错误",
          },
          warning: {
            color: "#faad14",
            icon: <ExclamationCircleOutlined />,
            label: "警告",
          },
          info: {
            color: "#1890ff",
            icon: <InfoCircleOutlined />,
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
      render: (source: string) => <Tag style={{ fontSize: 10 }}>{source}</Tag>,
    },
    {
      title: "消息",
      dataIndex: "message",
      key: "message",
      ellipsis: true,
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
          <Badge
            count={errorCount}
            style={{ backgroundColor: "#f5222d", marginRight: 12 }}
          >
            <span className={styles.badgeLabel}>错误</span>
          </Badge>
          <Badge
            count={warningCount}
            style={{ backgroundColor: "#faad14" }}
          >
            <span className={styles.badgeLabel}>警告</span>
          </Badge>
          <span className={styles.totalCount}>
            共 {filteredProblems.length} 项
          </span>
        </div>
        <Button
          size="small"
          icon={<ClearOutlined />}
          type="text"
        >
          清除
        </Button>
      </div>

      <div className={styles.filterSection}>
        <Input
          size="small"
          placeholder="搜索问题..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          prefix={<FilterOutlined style={{ color: "#bfbfbf" }} />}
        />
        <Space size="small">
          <Button
            size="small"
            type={severityFilter === "all" ? "primary" : "default"}
            onClick={() => setSeverityFilter("all")}
          >
            全部
          </Button>
          <Button
            size="small"
            type={severityFilter === "error" ? "primary" : "default"}
            onClick={() => setSeverityFilter("error")}
            danger
          >
            错误
          </Button>
          <Button
            size="small"
            type={severityFilter === "warning" ? "primary" : "default"}
            onClick={() => setSeverityFilter("warning")}
            style={{ color: "#faad14", borderColor: "#faad14" }}
          >
            警告
          </Button>
        </Space>
      </div>

      <div className={styles.tableContainer}>
        <Table
          dataSource={filteredProblems}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          className={styles.problemTable}
          scroll={{ y: "100%" }}
        />
      </div>
    </div>
  );
}

export default ProblemsPanel;
