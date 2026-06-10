// GeoWork MainWorkspace - Dynamic content based on nav selection

import { GeoComposer } from '../composer/GeoComposer/GeoComposer'
import { ChatTimeline } from '../chat/ChatTimeline/ChatTimeline'
import { Tree } from 'antd'
import { Tooltip } from "antd";
import useShellStore from "../../../stores/shellStore";
import useWorkspaceStore from "../../../stores/workspaceStore";
import useTaskStore from "../../../stores/taskStore";
import { useState, useEffect } from "react";
import styles from "./MainWorkspace.module.scss";

// Placeholder components for different nav sections

function WelcomeHero() {
  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeIcon}>🌍</div>
      <h2 className={styles.welcomeTitle}>欢迎使用 GeoWork</h2>
      <p className={styles.welcomeDesc}>
        地理遥感科研工程 Agent 工作台 — 在左侧栏选择功能模块开始工作
      </p>
    </div>
  );
}

function ProjectFilesView() {
  const {
    fileTree,
    currentWorkspace,
    loadWorkspaces,
    openWorkspace,
    readFile,
  } = useWorkspaceStore();
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKey, setSelectedKey] = useState<React.Key | null>(null);
  const [fileContent, setFileContent] = useState<string>("");

  useEffect(() => {
    loadWorkspaces().then(() => {
      const { workspaces, currentWorkspace } = useWorkspaceStore.getState();
      if (workspaces.length > 0 && !currentWorkspace) {
        openWorkspace(workspaces[0].id);
      }
    });
  }, []);

  const renderTree = (node: any): React.ReactNode => {
    if (!node) return null;
    const children = node.children?.map(renderTree);
    return (
      <Tree.TreeNode
        key={node.path}
        title={
          <span
            className={`${styles.treeNode} ${
              selectedKey === node.path ? styles.selectedNode : ""
            }`}
            onClick={() => {
              setSelectedKey(node.path);
              if (!node.is_dir) {
                readFile(currentWorkspace?.id || "", node.path).then(
                  setFileContent
                );
              }
            }}
          >
            {node.is_dir ? "📁" : "📄"} {node.name}
          </span>
        }
        children={children}
      />
    );
  };

  if (!currentWorkspace) {
    return <WelcomeHero />;
  }

  return (
    <div className={styles.projectFiles}>
      <div className={styles.fileTreePanel}>
        <div className={styles.treeHeader}>
          <span>📂 {currentWorkspace.name}</span>
        </div>
        <Tree
          expandedKeys={expandedKeys}
          onSelect={(keys) => setSelectedKey(keys[0])}
          className={styles.tree}
        >
          {fileTree ? (
            renderTree(fileTree)
          ) : (
            <Tree.TreeNode
              key="root"
              title="加载中..."
            />
          )}
        </Tree>
      </div>
      <div className={styles.fileContentPanel}>
        {selectedKey ? (
          <pre className={styles.fileContent}>
            {fileContent || "无法读取文件内容"}
          </pre>
        ) : (
          <div className={styles.filePlaceholder}>选择文件查看内容</div>
        )}
      </div>
    </div>
  );
}

function MapAndLayersView() {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);

  const mockLayers = [
    { id: "1", name: "Sentinel-2 L2A", type: "raster", active: true },
    { id: "2", name: "NDVI 结果", type: "raster", active: true },
    { id: "3", name: "道路矢量", type: "vector", active: false },
    { id: "4", name: "行政区划", type: "vector", active: true },
  ];

  const toggleLayer = (id: string) => {
    setSelectedLayers((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  return (
    <div className={styles.mapAndLayers}>
      <div className={styles.layerList}>
        <h3 className={styles.layerListTitle}>图层</h3>
        {mockLayers.map((layer) => (
          <div
            key={layer.id}
            className={`${styles.layerItem} ${
              selectedLayers.includes(layer.id) ? styles.layerActive : ""
            }`}
            onClick={() => toggleLayer(layer.id)}
          >
            <span className={styles.layerCheck}>
              {selectedLayers.includes(layer.id) ? "☑" : "☐"}
            </span>
            <span className={styles.layerType}>
              {layer.type === "raster" ? "🗺️" : "📐"}
            </span>
            <span className={styles.layerName}>{layer.name}</span>
            <span className={styles.layerTypeTag}>{layer.type}</span>
          </div>
        ))}
      </div>
      <div className={styles.mapArea}>
        <div className={styles.mapPlaceholder}>
          <span className={styles.mapIcon}>🗺️</span>
          <h3>地图可视化</h3>
          <p>图层将在地图视图中渲染</p>
        </div>
      </div>
    </div>
  );
}

function AutomationView() {
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(
    null
  );

  const mockAutomations = [
    {
      id: "1",
      name: "每日 NDVI 监测",
      schedule: "每天 08:00",
      status: "active",
    },
    {
      id: "2",
      name: "Sentinel-2 数据下载",
      schedule: "每周日 02:00",
      status: "paused",
    },
    {
      id: "3",
      name: "土地覆盖变化检测",
      schedule: "每月 1 日",
      status: "active",
    },
  ];

  return (
    <div className={styles.automationView}>
      <div className={styles.automationList}>
        <h3 className={styles.automationListTitle}>自动化任务</h3>
        {mockAutomations.map((auto) => (
          <div
            key={auto.id}
            className={`${styles.automationItem} ${
              selectedAutomation === auto.id ? styles.automationSelected : ""
            }`}
            onClick={() => setSelectedAutomation(auto.id)}
          >
            <span className={styles.automationName}>{auto.name}</span>
            <span className={styles.automationSchedule}>{auto.schedule}</span>
            <span
              className={`${styles.automationStatus} ${
                styles[`status${auto.status}`]
              }`}
            >
              {auto.status === "active" ? "运行中" : "已暂停"}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.automationDetail}>
        <div className={styles.automationPlaceholder}>
          <span className={styles.automationIcon}>⚙️</span>
          <h3>任务调度</h3>
          <p>选择左侧任务查看详情</p>
        </div>
      </div>
    </div>
  );
}

function PaperSearchView() {
  const [searchQuery, setSearchQuery] = useState("");

  const mockPapers = [
    {
      id: "1",
      title: "Deep learning for NDVI estimation",
      journal: "Remote Sensing of Environment",
      year: 2024,
    },
    {
      id: "2",
      title: "Sentinel-2 data processing pipeline",
      journal: "ISPRS Journal",
      year: 2023,
    },
    {
      id: "3",
      title: "Google Earth Engine applications in geoscience",
      journal: "Remote Sensing",
      year: 2024,
    },
  ];

  return (
    <div className={styles.paperSearchView}>
      <div className={styles.searchSection}>
        <h3 className={styles.searchTitle}>论文搜索</h3>
        <input
          type="text"
          placeholder="搜索论文关键词..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.paperList}>
        {mockPapers.map((paper) => (
          <div
            key={paper.id}
            className={styles.paperItem}
          >
            <span className={styles.paperTitle}>{paper.title}</span>
            <span className={styles.paperMeta}>
              {paper.journal} ({paper.year})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeBaseView() {
  const [entries] = useState([
    {
      id: "1",
      title: "NDVI 计算公式",
      category: "遥感算法",
      tags: ["NDVI", "植被指数"],
    },
    {
      id: "2",
      title: "Sentinel-2 数据介绍",
      category: "数据源",
      tags: ["Sentinel", "遥感数据"],
    },
    {
      id: "3",
      title: "GDAL 常用命令",
      category: "工具指南",
      tags: ["GDAL", "命令行"],
    },
  ]);

  return (
    <div className={styles.knowledgeBaseView}>
      <h3 className={styles.kbTitle}>知识库</h3>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={styles.kbEntry}
        >
          <div className={styles.kbEntryHeader}>
            <span className={styles.kbEntryTitle}>{entry.title}</span>
            <span className={styles.kbEntryCategory}>{entry.category}</span>
          </div>
          <div className={styles.kbTags}>
            {entry.tags.map((tag, i) => (
              <span
                key={i}
                className={styles.kbTag}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MainWorkspace() {
  const { activeMode, activeNavKey } = useShellStore()
  const taskStore = useTaskStore()

  // Load tasks when component mounts
  useEffect(() => {
    taskStore.loadTasks()
  }, [])

  const renderContent = () => {
    switch (activeNavKey) {
      case 'workbench':
        return (
          <>
            <GeoComposer />
            <ChatTimeline />
          </>
        )
      case 'files':
        return <ProjectFilesView />
      case 'map':
        return <MapAndLayersView />
      case 'automation':
        return <AutomationView />
      case 'papers':
        return <PaperSearchView />
      case 'knowledge':
        return <KnowledgeBaseView />
      default:
        return <WelcomeHero />
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.modeIndicator}>
        当前模式: {activeMode}
      </div>
      {renderContent()}
    </main>
  )
}
