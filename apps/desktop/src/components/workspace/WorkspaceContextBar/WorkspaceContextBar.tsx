// GeoWork - Workspace Context Bar Component
// Displays current workspace info with actions

import React from 'react'
import { Space, Button, Dropdown, Tooltip, Badge } from 'antd'
import {
  FolderOutlined,
  ReloadOutlined,
  ImportOutlined,
  FolderOpenOutlined,
  CloudOutlined,
} from '@ant-design/icons'
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

  const menuProps: any = {
    items: [
      { key: 'open', label: '打开工作区', icon: <FolderOpenOutlined />, onClick: loadWorkspaces },
      { key: 'import', label: '导入文件', icon: <ImportOutlined />, onClick: handleChooseFolder },
      { type: 'divider' },
      { key: 'cloud', label: '同步到云端', icon: <CloudOutlined />, disabled: true },
    ],
  }

  if (!currentWorkspace) {
    return (
      <Space style={{ padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
        <FolderOutlined />
        <span style={{ color: '#999' }}>未选择工作区</span>
        <Button type="primary" size="small" onClick={handleChooseFolder}>
          选择文件夹
        </Button>
      </Space>
    )
  }

  const fileCount = fileTree ? countFiles(fileTree) : 0

  return (
    <Space
      style={{ padding: '8px 16px', background: '#f6ffed', borderBottom: '1px solid #b7eb8f' }}
      size="middle"
    >
      <Badge count={fileCount} overflowCount={999}>
        <FolderOutlined style={{ color: '#52c41a' }} />
      </Badge>
      <Tooltip title={currentWorkspace.rootPath}>
        <span style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentWorkspace.name}
        </span>
      </Tooltip>
      <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} title="刷新文件树" />
      <Dropdown menu={menuProps} trigger={['click']}>
        <Button size="small" type="text">
          更多操作
        </Button>
      </Dropdown>
    </Space>
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
