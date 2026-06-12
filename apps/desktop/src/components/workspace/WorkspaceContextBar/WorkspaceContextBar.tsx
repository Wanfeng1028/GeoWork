// GeoWork - Workspace Context Bar Component
// Displays current workspace info with actions

import React from 'react'
import { Folder, RefreshCw, FolderOpen, Cloud } from 'lucide-react'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../ui/dropdown-menu'
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
      <div className="flex items-center gap-2 px-4 py-2 bg-[var(--gw-bg-hover)] border-b border-[var(--gw-border-soft)]">
        <Folder className="h-4 w-4 text-[var(--gw-text-tertiary)]" />
        <span className="text-[var(--gw-text-tertiary)]">未选择工作区</span>
        <Button variant="primary" size="sm" onClick={handleChooseFolder}>
          选择文件夹
        </Button>
      </div>
    )
  }

  const fileCount = fileTree ? countFiles(fileTree) : 0

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--gw-success-soft)] border-b border-[var(--gw-success)]/30">
      <Badge variant="success">
        <Folder className="h-3.5 w-3.5" />
        {fileCount > 999 ? '999+' : fileCount}
      </Badge>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
            {currentWorkspace.name}
          </span>
        </TooltipTrigger>
        <TooltipContent>{currentWorkspace.rootPath}</TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="icon-sm" onClick={handleRefresh} title="刷新文件树">
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            更多操作
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={loadWorkspaces}>
            <FolderOpen className="h-3.5 w-3.5" />
            打开工作区
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleChooseFolder}>
            <Folder className="h-3.5 w-3.5" />
            导入文件
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Cloud className="h-3.5 w-3.5" />
            同步到云端
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
