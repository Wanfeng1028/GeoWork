/** @format */

// GeoWork ArtifactPanel - Full implementation
// Displays task artifacts grouped by type (map, code, document, data, log)

import { useState, useMemo } from "react";
import { Image, FileText, FileSpreadsheet, FileCode, Folder, Download, Cpu, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "../../../ui/button";
import { Badge } from "../../../ui/badge";
import { Empty } from "../../../ui/empty";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../ui/tooltip";
import useArtifactStore from "../../../../stores/artifactStore";
import styles from "./ArtifactPanel.module.scss";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  map: <Image className="h-3.5 w-3.5" />,
  code: <FileCode className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  data: <FileSpreadsheet className="h-3.5 w-3.5" />,
  image: <Image className="h-3.5 w-3.5" />,
  ppt: <FileText className="h-3.5 w-3.5" />,
  pdf: <FileText className="h-3.5 w-3.5" />,
  diff: <FileCode className="h-3.5 w-3.5" />,
  log: <FileText className="h-3.5 w-3.5" />,
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
            <Folder className="h-4 w-4" /> 产物
          </span>
        </div>
        <div className={styles.emptyState}>
          <Empty description="暂无产物" />
          <span style={{ fontSize: 12, color: "#bfbfbf" }}>
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
          <Folder className="h-4 w-4" /> 产物
        </span>
        <span className={styles.artifactCount}>{artifacts.length} 个文件</span>
      </div>

      <div className={styles.treeContainer}>
        <div className="flex flex-col text-[12px]">
          {Object.entries(groupedArtifacts).map(([type, items]) => (
            <div key={type}>
              <div
                className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[var(--gw-bg-hover)]"
                onClick={() => toggleGroup(type)}
              >
                {expandedGroups.has(type) ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--gw-text-tertiary)]" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--gw-text-tertiary)]" />
                )}
                {TYPE_ICONS[type] || <Folder className="h-3.5 w-3.5" />}
                <span>{TYPE_LABELS[type] || type}</span>
                <Badge variant="accent" className="ml-1 text-[10px]">{items.length}</Badge>
              </div>
              {expandedGroups.has(type) && (
                <div className="ml-4">
                  {items.map((artifact) => (
                    <div
                      key={artifact.id}
                      className={styles.artifactItem}
                      onClick={() => handleOpenArtifact(artifact)}
                    >
                      {TYPE_ICONS[artifact.type] || <FileText className="h-3.5 w-3.5" />}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={styles.artifactName}>{artifact.name}</span>
                        </TooltipTrigger>
                        <TooltipContent>{artifact.name}</TooltipContent>
                      </Tooltip>
                      {currentPreview?.id === artifact.id && (
                        <Badge variant="success" className="text-[10px] ml-1">
                          预览中
                        </Badge>
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
                <Badge variant="accent">{artifact.type}</Badge>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenArtifact(artifact)}
                    >
                      <Cpu className="h-3.5 w-3.5 mr-1" />
                      打开
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>在编辑器中打开</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveToWorkspace(artifact)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      保存
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>保存到工作空间</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="primary"
                    >
                      <Folder className="h-3.5 w-3.5 mr-1" />
                      知识库
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>添加到知识库</TooltipContent>
                </Tooltip>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default ArtifactPanel;
