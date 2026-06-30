// GeoWork - Workspace Context Bar Component
// Displays current workspace info with actions

import React from 'react'
import { Folder, RefreshCw, FolderOpen, Cloud } from 'lucide-react'
import useWorkspaceStore from '../../../stores/workspaceStore'
import desktopBridge from '../../../services/desktopBridge'

const WorkspaceContextBar: React.FC = () => {
  const { currentWorkspace, fileTree, loadWorkspaces, openWorkspace } = useWorkspaceStore()

  const handleChooseFolder = async () => {
    const paths = await desktopBridge.chooseFolder()
    if (paths && paths.length > 0) {
      // Create workspace from selected folder
      // This would call runtimeClient.createWorkspace in real implementation
    }
  }

  const handleRefresh = () => {
    if (currentWorkspace) {
      openWorkspace(currentWorkspace.id)
    }
  }

  if (!currentWorkspace) {
    return (
      <div >
        <Folder  />
        <span >未选择工作区</span>
        <button onClick={handleChooseFolder}>
          选择文件夹
        </button>
      </div>
    )
  }

  const fileCount = fileTree ? countFiles(fileTree) : 0

  return (
    <div >
      <span>
        <Folder  />
        {fileCount > 999 ? '999+' : fileCount}
      </span>
      <div>
        <span asChild>
          <span >
            {currentWorkspace.name}
          </span>
        </span>
        <div>{currentWorkspace.rootPath}</div>
      </div>
      <button onClick={handleRefresh}>
        <RefreshCw  />
      </button>
      <div>
        <button asChild>
          <button>
            更多操作
          </button>
        </button>
        <div align="start">
          <button onClick={loadWorkspaces}>
            <FolderOpen  />
            打开工作区
          </button>
          <button onClick={handleChooseFolder}>
            <Folder  />
            导入文件
          </button>
          <hr />
          <button disabled>
            <Cloud  />
            同步到云端
          </button>
        </div>
      </div>
    </div>
  )
}

function countFiles(node: any): number {
  if (!node || !node.children) return 0
  let count = node.kind !== 'directory' ? 1 : 0
  for (const child of node.children) {
    count += countFiles(child)
  }
  return count
}

export default WorkspaceContextBar
