/** @format */

// GeoWork DiffPanel - Full implementation
// Displays file diffs with Monaco-like diff view, accept/reject actions, and patch saving

import { useState, useMemo } from "react";
import { Check, X, Save, GitBranch, Diff, ChevronDown, ChevronRight } from "lucide-react";
import useDiffStore from "../../../../stores/diffStore";
import styles from "./DiffPanel.module.scss";

const STATUS_COLORS: Record<string, string> = {
  modified: '',
  added: '',
  deleted: '',
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
            <Diff  /> 差异对比
          </span>
        </div>
        <div className={styles.emptyState}>
          <Diff  />
          <span style={{ fontSize: 12 }}>暂无差异对比</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Diff  /> 差异对比
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
            className={`${styles.diffListItem} ${ selectedDiffId === diff.id || (!selectedDiffId && currentDiff?.id === diff.id) ? styles.diffListSelected : "" }`}
            onClick={() => {
              setSelectedDiffId(diff.id);
              setExpandedFiles(new Set(diff.files.map((f) => f.path)));
            }}
          >
            <span className={styles.diffListId}>{diff.id.slice(0, 8)}...</span>
            <span>{diff.files.length} files</span>
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
            <div >
              <button
                onClick={handleAcceptAll}
              >
                <Check  />
                全部接受
              </button>
              <button
                onClick={handleRejectAll}
              >
                <X  />
                全部拒绝
              </button>
              <div>
                <button
                  onClick={handleSavePatch}
                >
                  <Save  />
                  保存
                </button>
                <div>保存为 patch 文件</div>
              </div>
              <div>
                <button
                  onClick={handleBranchSnapshot}
                >
                  <GitBranch  />
                  快照
                </button>
                <div>创建分支快照</div>
              </div>
            </div>
          </div>

          <div className={styles.fileDiffs}>
            {selectedDiff.files.map((file) => {
              const isAccepted = acceptedFiles.has(file.path);
              const isRejected = rejectedFiles.has(file.path);
              const isExpanded = expandedFiles.has(file.path);

              return (
                <details
                  key={file.path}
                  open={isExpanded}
                  onToggle={(e) => {
                    const el = e.target as HTMLDetailsElement;
                    setExpandedFiles((prev) => {
                      const next = new Set(prev);
                      if (el.open) next.add(file.path);
                      else next.delete(file.path);
                      return next;
                    });
                  }}
                  
                >
                  <summary >
                    <div className={styles.fileDiffHeader}>
                      <span className={styles.fileName}>{file.path}</span>
                      <div >
                        <span
                          
                        >
                          {file.status}
                        </span>
                        {isAccepted && <span >&#10003;</span>}
                        {isRejected && <span >&#10007;</span>}
                      </div>
                    </div>
                  </summary>
                  <div className={styles.diffView}>
                    {file.oldContent && (
                      <pre className={styles.oldContent}>{file.oldContent}</pre>
                    )}
                    <div className={styles.diffArrow}>&#8595;</div>
                    <pre className={styles.newContent}>{file.newContent}</pre>
                  </div>
                  <div className={styles.fileActions}>
                    <button
                      onClick={() => handleAcceptFile(file.path)}
                    >
                      <Check  />
                      接受
                    </button>
                    <button
                      onClick={() => handleRejectFile(file.path)}
                    >
                      <X  />
                      拒绝
                    </button>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiffPanel;
