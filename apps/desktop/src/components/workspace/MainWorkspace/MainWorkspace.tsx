// GeoWork MainWorkspace - Dynamic content based on nav selection

import { GeoComposer } from '../composer/GeoComposer/GeoComposer'
import { ChatTimeline } from '../chat/ChatTimeline/ChatTimeline'
import { Tree } from 'antd'
import useShellStore from '../../../stores/shellStore'
import useWorkspaceStore from '../../../stores/workspaceStore'
import useTaskStore from '../../../stores/taskStore'
import { useState, useEffect } from 'react'
import styles from './MainWorkspace.module.scss'

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
  )
}

function ProjectFilesView() {
  const { fileTree, currentWorkspace, loadWorkspaces, openWorkspace, readFile } = useWorkspaceStore()
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedKey, setSelectedKey] = useState<React.Key | null>(null)
  const [fileContent, setFileContent] = useState<string>('')

  useEffect(() => {
    loadWorkspaces().then(() => {
      const { workspaces, currentWorkspace } = useWorkspaceStore.getState()
      if (workspaces.length > 0 && !currentWorkspace) {
        openWorkspace(workspaces[0].id)
      }
    })
  }, [])

  const renderTree = (node: any): React.ReactNode => {
    if (!node) return null
    const children = node.children?.map(renderTree)
    return (
      <Tree.TreeNode
        key={node.path}
        title={
          <span
            className={`${styles.treeNode} ${selectedKey === node.path ? styles.selectedNode : ''}`}
            onClick={() => {
              setSelectedKey(node.path)
              if (!node.is_dir) {
                readFile(currentWorkspace?.id || '', node.path).then(setFileContent)
              }
            }}
          >
            {node.is_dir ? '📁' : '📄'} {node.name}
          </span>
        }
        children={children}
      />
    )
  }

  if (!currentWorkspace) {
    return <WelcomeHero />
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
          {fileTree ? renderTree(fileTree) : <Tree.TreeNode key="root" title="加载中..." />}
        </Tree>
      </div>
      <div className={styles.fileContentPanel}>
        {selectedKey ? (
          <pre className={styles.fileContent}>{fileContent || '无法读取文件内容'}</pre>
        ) : (
          <div className={styles.filePlaceholder}>选择文件查看内容</div>
        )}
      </div>
    </div>
  )
}

function MapAndLayersView() {
  return (
    <div className={styles.mapPlaceholder}>
      <div className={styles.mapIcon}>🗺️</div>
      <h3>地图与图层</h3>
      <p>地图可视化功能将在后续版本中实现</p>
    </div>
  )
}

function AutomationView() {
  return (
    <div className={styles.automationPlaceholder}>
      <div className={styles.automationIcon}>⚙️</div>
      <h3>自动化任务</h3>
      <p>定时任务和文件监控功能将在后续版本中实现</p>
    </div>
  )
}

function PaperSearchView() {
  return (
    <div className={styles.paperPlaceholder}>
      <div className={styles.paperIcon}>📄</div>
      <h3>论文搜索</h3>
      <p>论文检索与知识库功能将在后续版本中实现</p>
    </div>
  )
}

function KnowledgeBaseView() {
  return (
    <div className={styles.knowledgePlaceholder}>
      <div className={styles.knowledgeIcon}>📚</div>
      <h3>知识库</h3>
      <p>知识库管理功能将在后续版本中实现</p>
    </div>
  )
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
