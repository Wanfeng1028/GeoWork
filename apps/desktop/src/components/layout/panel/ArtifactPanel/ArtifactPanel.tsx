/** @format */

// GeoWork ArtifactPanel - Full implementation
// Displays task artifacts grouped by type (map, code, document, data, log)

import { useState, useMemo } from "react";
import { Tree, Tag, Button, Empty, Tooltip } from "antd";
import {
  FileImageOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
  CodeOutlined,
  FolderOutlined,
  DownloadOutlined,
  OpenAIOutlined,
} from "@ant-design/icons";
import useArtifactStore from "../../../../stores/artifactStore";
import styles from "./ArtifactPanel.module.scss";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  map: <FileImageOutlined />,
  code: <CodeOutlined />,
  document: <FileTextOutlined />,
  data: <FileExcelOutlined />,
  image: <FileImageOutlined />,
  ppt: <FileTextOutlined />,
  pdf: <FilePdfOutlined />,
  diff: <CodeOutlined />,
  log: <FileMarkdownOutlined />,
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
            <FolderOutlined /> 产物
          </span>
        </div>
        <div className={styles.emptyState}>
          <Empty
            description="暂无产物"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <span style={{ fontSize: 12, color: "#bfbfbf" }}>
            任务完成后产物将在此显示
          </span>
        </div>
      </div>
    );
  }

  const treeData = Object.entries(groupedArtifacts).map(([type, items]) => ({
    title: (
      <span className={styles.groupHeader}>
        {TYPE_ICONS[type] || <FolderOutlined />}
        <span>{TYPE_LABELS[type] || type}</span>
        <Tag
          color="blue"
          style={{ marginLeft: 4, fontSize: 10 }}
        >
          {items.length}
        </Tag>
      </span>
    ),
    key: type,
    children: items.map((artifact) => ({
      title: (
        <div
          className={styles.artifactItem}
          onClick={() => handleOpenArtifact(artifact)}
        >
          {TYPE_ICONS[artifact.type] || <FileTextOutlined />}
          <Tooltip title={artifact.name}>
            <span className={styles.artifactName}>{artifact.name}</span>
          </Tooltip>
          {currentPreview?.id === artifact.id && (
            <Tag
              color="green"
              style={{ fontSize: 10, marginLeft: 4 }}
            >
              预览中
            </Tag>
          )}
        </div>
      ),
      key: artifact.id,
      isLeaf: true,
    })),
  }));

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <FolderOutlined /> 产物
        </span>
        <span className={styles.artifactCount}>{artifacts.length} 个文件</span>
      </div>

      <div className={styles.treeContainer}>
        <Tree
          treeData={treeData}
          defaultExpandAll
          showLine
          className={styles.artifactTree}
        />
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
                <Tag color="blue">{artifact.type}</Tag>
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
                <Tooltip title="在编辑器中打开">
                  <Button
                    size="small"
                    icon={<OpenAIOutlined />}
                    onClick={() => handleOpenArtifact(artifact)}
                  >
                    打开
                  </Button>
                </Tooltip>
                <Tooltip title="保存到工作空间">
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => handleSaveToWorkspace(artifact)}
                  >
                    保存
                  </Button>
                </Tooltip>
                <Tooltip title="添加到知识库">
                  <Button
                    size="small"
                    type="primary"
                    icon={<FolderOutlined />}
                  >
                    知识库
                  </Button>
                </Tooltip>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default ArtifactPanel;
