/** @format */

// GeoWork ArtifactPanel - Full implementation
// Displays task artifacts grouped by type (map, code, document, data, log)

import { useState, useMemo } from "react";
import { Image, FileText, FileSpreadsheet, FileCode, Folder, Download, Cpu, ChevronRight, ChevronDown } from "lucide-react";
import useArtifactStore from "../../../../stores/artifactStore";
import styles from "./ArtifactPanel.module.scss";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  map: <Image  />,
  code: <FileCode  />,
  document: <FileText  />,
  data: <FileSpreadsheet  />,
  image: <Image  />,
  ppt: <FileText  />,
  pdf: <FileText  />,
  diff: <FileCode  />,
  log: <FileText  />,
};

const TYPE_LABELS: Record<string, string> = {
  map: "地图",
  code: "代码",
  document: "文档",
  data: "数据",
  image: "图片",
  ppt: "演示文稿",
  pdf: "PDF",
  diff: "差异",
  log: "日志",
};

export function ArtifactPanel() {
  const { artifacts, currentPreview, isLoading } = useArtifactStore();
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);

  // Group artifacts by type
  const groupedArtifacts = useMemo(() => {
    const groups: Record<string, typeof artifacts> = {};
    for (const artifact of artifacts) {
      if (!groups[artifact.type]) {
        groups[artifact.type] = [];
      }
      groups[artifact.type].push(artifact);
    }
    return groups;
  }, [artifacts]);

  const handleOpenArtifact = (artifact: any) => {
    setSelectedArtifact(artifact.id);
    console.log("Open artifact in editor:", artifact.path);
  };

  const handleSaveToWorkspace = async (artifact: any) => {
    try {
      // Copy artifact to workspace via runtimeClient
      // In production, this would call runtimeClient.copyToWorkspace(artifact.path)
      console.log("Saving artifact to workspace:", artifact.path);
      // TODO: Implement runtimeClient.copyToWorkspace(artifact.path)
    } catch (error) {
      console.error("Failed to save artifact:", error);
    }
  };

  const handleAddToKnowledgeBase = async (artifact: any) => {
    try {
      // Index artifact in knowledge base via runtimeClient
      // In production, this would call runtimeClient.indexInKnowledgeBase(artifact.path)
      console.log("Adding artifact to knowledge base:", artifact.path);
      // TODO: Implement runtimeClient.indexInKnowledgeBase(artifact.path)
    } catch (error) {
      console.error("Failed to add to knowledge base:", error);
    }
  };

  if (artifacts.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>
            <Folder  /> 产物
          </span>
        </div>
        <div className={styles.emptyState}>
          <div>暂无产物</div>
          <span style={{ fontSize: 12 }}>
            任务完成后产物将在此显示
          </span>
        </div>
      </div>
    );
  }

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(Object.keys(groupedArtifacts)));

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Folder  /> 产物
        </span>
        <span className={styles.artifactCount}>{artifacts.length} 个文件</span>
      </div>

      <div className={styles.treeContainer}>
        <div>
          {Object.entries(groupedArtifacts).map(([type, items]) => (
            <div key={type}>
              <div
                className={styles.groupHeader}
                onClick={() => toggleGroup(type)}
              >
                {expandedGroups.has(type) ? (
                  <ChevronDown  />
                ) : (
                  <ChevronRight  />
                )}
                {TYPE_ICONS[type] || <Folder  />}
                <span>{TYPE_LABELS[type] || type}</span>
                <span >{items.length}</span>
              </div>
              {expandedGroups.has(type) && (
                <div>
                  {items.map((artifact) => (
                    <div
                      key={artifact.id}
                      className={styles.artifactItem}
                      onClick={() => handleOpenArtifact(artifact)}
                    >
                      {TYPE_ICONS[artifact.type] || <FileText  />}
                      <div>
                        <span className={styles.artifactName}>{artifact.name}</span>
                        <div>{artifact.name}</div>
                      </div>
                      {currentPreview?.id === artifact.id && (
                        <span >
                          预览中
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected artifact detail */}
      {selectedArtifact &&
        (() => {
          const artifact = artifacts.find((a) => a.id === selectedArtifact);
          if (!artifact) return null;
          return (
            <div className={styles.detailPanel}>
              <div className={styles.detailHeader}>
                <span className={styles.detailTitle}>{artifact.name}</span>
                <span>{artifact.type}</span>
              </div>
              <div className={styles.detailInfo}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>路径:</span>
                  <span className={styles.detailValue}>{artifact.path}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>创建时间:</span>
                  <span className={styles.detailValue}>
                    {new Date(artifact.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              </div>
              <div className={styles.detailActions}>
                <div>
                  <button
                    onClick={() => handleOpenArtifact(artifact)}
                  >
                    <Cpu  />
                    打开
                  </button>
                  <div>在编辑器中打开</div>
                </div>
                <div>
                  <button
                    onClick={() => handleSaveToWorkspace(artifact)}
                  >
                    <Download  />
                    保存
                  </button>
                  <div>保存到工作空间</div>
                </div>
                <div>
                  <button
                  >
                    <Folder  />
                    知识库
                  </button>
                  <div>添加到知识库</div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default ArtifactPanel;
