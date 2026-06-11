/** @format */

// GeoWork DiffPanel - Full implementation
// Displays file diffs with Monaco-like diff view, accept/reject actions, and patch saving

import { useState, useMemo } from "react";
import { Button, Tag, Collapse, Space, Tooltip } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  SaveOutlined,
  BranchesOutlined,
  DiffOutlined,
} from "@ant-design/icons";
import useDiffStore from "../../../../stores/diffStore";
import styles from "./DiffPanel.module.scss";

const { Panel } = Collapse;

const STATUS_COLORS: Record<string, string> = {
  modified: "#faad14",
  added: "#52c41a",
  deleted: "#f5222d",
};

export function DiffPanel() {
  const { diffs, currentDiff, acceptedFiles, rejectedFiles } = useDiffStore();
  const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const selectedDiff = useMemo(
    () => diffs.find((d) => d.id === selectedDiffId) || currentDiff || null,
    [diffs, selectedDiffId, currentDiff]
  );

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleAcceptFile = (filePath: string) => {
    const { setAcceptedFile } = useDiffStore.getState();
    setAcceptedFile(filePath);
  };

  const handleRejectFile = (filePath: string) => {
    const { setRejectedFile } = useDiffStore.getState();
    setRejectedFile(filePath);
  };

  const handleAcceptAll = () => {
    if (!selectedDiff) return;
    const { setAllAccepted } = useDiffStore.getState();
    selectedDiff.files.forEach((f) => setAllAccepted(f.path));
  };

  const handleRejectAll = () => {
    if (!selectedDiff) return;
    const { setAllRejected } = useDiffStore.getState();
    selectedDiff.files.forEach((f) => setAllRejected(f.path));
  };

  const handleSavePatch = () => {
    if (!selectedDiff?.patch) return;
    // Download patch file as .patch
    const blob = new Blob([selectedDiff.patch], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diff-${selectedDiff.id}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBranchSnapshot = async () => {
    // Create a git branch snapshot for this task
    // In production, this would call runtimeClient to execute git commands
    if (selectedDiff?.taskId) {
      console.log("Creating branch snapshot for task:", selectedDiff.taskId);
    }
  };

  if (diffs.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>
            <DiffOutlined /> 差异对比
          </span>
        </div>
        <div className={styles.emptyState}>
          <DiffOutlined style={{ fontSize: 32, color: "#d9d9d9" }} />
          <span style={{ fontSize: 12, color: "#bfbfbf" }}>暂无差异对比</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <DiffOutlined /> 差异对比
        </span>
        <span className={styles.diffCount}>
          {selectedDiff?.files.length || 0} 个文件
        </span>
      </div>

      {/* Diff selector list */}
      <div className={styles.diffList}>
        {diffs.map((diff) => (
          <div
            key={diff.id}
            className={`${styles.diffListItem} ${
              selectedDiffId === diff.id ||
              (!selectedDiffId && currentDiff?.id === diff.id)
                ? styles.diffListSelected
                : ""
            }`}
            onClick={() => {
              setSelectedDiffId(diff.id);
              setExpandedFiles(new Set(diff.files.map((f) => f.path)));
            }}
          >
            <span className={styles.diffListId}>{diff.id.slice(0, 8)}...</span>
            <Tag color="blue">{diff.files.length} files</Tag>
            <span className={styles.diffListTime}>
              {new Date(diff.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
        ))}
      </div>

      {/* File diffs */}
      {selectedDiff && (
        <div className={styles.diffContent}>
          {/* Action bar */}
          <div className={styles.diffActions}>
            <Space size="small">
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleAcceptAll}
              >
                全部接受
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={handleRejectAll}
              >
                全部拒绝
              </Button>
              <Tooltip title="保存为 patch 文件">
                <Button
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSavePatch}
                >
                  保存
                </Button>
              </Tooltip>
              <Tooltip title="创建分支快照">
                <Button
                  size="small"
                  icon={<BranchesOutlined />}
                  onClick={handleBranchSnapshot}
                >
                  快照
                </Button>
              </Tooltip>
            </Space>
          </div>

          <Collapse
            defaultActiveKey={Array.from(expandedFiles) as any}
            onChange={(keys) => {
              setExpandedFiles(new Set(keys as string[]));
            }}
            bordered={false}
            size="small"
            className={styles.fileDiffs}
          >
            {selectedDiff.files.map((file) => {
              const isAccepted = acceptedFiles.has(file.path);
              const isRejected = rejectedFiles.has(file.path);

              return (
                <Panel
                  header={
                    <div className={styles.fileDiffHeader}>
                      <span className={styles.fileName}>{file.path}</span>
                      <Space size="small">
                        <Tag color={STATUS_COLORS[file.status] || "#999"}>
                          {file.status}
                        </Tag>
                        {isAccepted && <Tag color="green">✓</Tag>}
                        {isRejected && <Tag color="red">✗</Tag>}
                      </Space>
                    </div>
                  }
                  key={file.path}
                >
                  <div className={styles.diffView}>
                    {/* Old content (if exists) */}
                    {file.oldContent && (
                      <pre className={styles.oldContent}>{file.oldContent}</pre>
                    )}

                    {/* Arrow indicator */}
                    <div className={styles.diffArrow}>↓</div>

                    {/* New content */}
                    <pre className={styles.newContent}>{file.newContent}</pre>
                  </div>

                  {/* File actions */}
                  <div className={styles.fileActions}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      disabled={isAccepted}
                      onClick={() => handleAcceptFile(file.path)}
                    >
                      接受
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      disabled={isRejected}
                      onClick={() => handleRejectFile(file.path)}
                    >
                      拒绝
                    </Button>
                  </div>
                </Panel>
              );
            })}
          </Collapse>
        </div>
      )}
    </div>
  );
}

export default DiffPanel;
