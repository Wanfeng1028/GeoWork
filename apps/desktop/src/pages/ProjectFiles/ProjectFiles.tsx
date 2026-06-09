import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Breadcrumb,
  Card,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Tree,
  Upload
} from 'antd'
import {
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined
} from '@ant-design/icons'
import type { FileNode } from '../../services/fileService'
import { useProjectFilesStore } from './store'
import { FilePreview } from './FilePreview'
import styles from './ProjectFiles.module.scss'

const { Dragger } = Upload

export function ProjectFiles() {
  const {
    treeData,
    selectedFile,
    breadcrumbs,
    isLoading,
    error,
    setTreeData,
    setSelectedFile,
    setBreadcrumbs,
    createFolder,
    uploadFile,
    deleteNode,
    renameNode,
    refreshTree
  } = useProjectFilesStore()

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [autoExpandParent, setAutoExpandParent] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null)
  const [renameModal, setRenameModal] = useState<{ open: boolean; node: FileNode | null; newName: string }>({
    open: false,
    node: null,
    newName: ''
  })
  const [createFolderModal, setCreateFolderModal] = useState<{ open: boolean; parentId: string }>({
    open: false,
    parentId: ''
  })
  const [dragOver, setDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initial load
  useEffect(() => {
    refreshTree().catch(() => message.error('Failed to load project files'))
  }, [])

  // Build expanded keys from tree data
  useEffect(() => {
    const keys: React.Key[] = []
    const collectKeys = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          keys.push(node.id)
          collectKeys(node.children)
        }
      }
    }
    collectKeys(treeData)
    setExpandedKeys(keys)
  }, [treeData])

  // Filter tree data by search value
  const filteredTreeData = useMemo(() => {
    if (!searchValue) return treeData
    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce<FileNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(searchValue.toLowerCase())
        const filteredChildren = node.children ? filterNodes(node.children) : []
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children })
        }
        return acc
      }, [])
    }
    return filterNodes(treeData)
  }, [treeData, searchValue])

  // Handle tree select
  const handleTreeSelect = (_selectedKeys: React.Key[], info: any) => {
    const node = findNodeById(treeData, String(info.node.key))
    setSelectedFile(node || null)
    if (node) {
      updateBreadcrumbs(node)
    }
  }

  // Handle tree expand
  const handleTreeExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys)
    setAutoExpandParent(false)
  }

  // Handle context menu
  const handleTreeContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  // Close context menu on click
  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  // Context menu actions
  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu?.node) return
    const node = contextMenu.node

    if (action === 'createFolder') {
      setCreateFolderModal({ open: true, parentId: node.id })
    } else if (action === 'rename') {
      setRenameModal({ open: true, node, newName: node.name })
    } else if (action === 'delete') {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除 "${node.name}" 吗？此操作不可撤销。`,
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            await deleteNode(node.id)
            message.success('删除成功')
          } catch {
            message.error('删除失败')
          }
        }
      })
    }
    setContextMenu(null)
  }, [contextMenu, deleteNode])

  // Handle rename submit
  const handleRenameSubmit = useCallback(async () => {
    if (!renameModal.node || !renameModal.newName.trim()) return
    try {
      await renameNode(renameModal.node.id, renameModal.newName.trim())
      message.success('重命名成功')
      setRenameModal({ open: false, node: null, newName: '' })
    } catch {
      message.error('重命名失败')
    }
  }, [renameModal, renameNode])

  // Handle create folder submit
  const handleCreateFolderSubmit = useCallback(async () => {
    // We need a name input - use a simple prompt for now
    const name = prompt('请输入文件夹名称:')
    if (!name || !name.trim()) return
    try {
      await createFolder(createFolderModal.parentId, name.trim())
      message.success('创建成功')
      setCreateFolderModal({ open: false, parentId: '' })
    } catch {
      message.error('创建失败')
    }
  }, [createFolder, createFolderModal.parentId])

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      await uploadFile('', file)
      message.success(`文件 "${file.name}" 上传成功`)
    } catch {
      message.error(`文件 "${file.name}" 上传失败`)
    }
    return false // prevent default upload
  }, [uploadFile])

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    dragCounterRef.current = 0

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Build breadcrumbs
  const updateBreadcrumbs = (node: FileNode) => {
    const crumbs: string[] = []
    const collectPath = (nodes: FileNode[], targetId: string, path: string[]): boolean => {
      for (const n of nodes) {
        const currentPath = path.length > 0 ? `${path[path.length - 1]} / ${n.name}` : n.name
        if (n.id === targetId) {
          crumbs.push(...path, n.name)
          return true
        }
        if (n.children && collectPath(n.children, targetId, [...path, n.name])) {
          return true
        }
      }
      return false
    }
    collectPath(treeData, node.id, [])
    setBreadcrumbs(crumbs)
  }

  // Find node by ID in tree
  const findNodeById = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  // Render tree node title
  const renderTreeNode = (node: FileNode) => (
    <div className={styles.treeNode} onContextMenu={(e) => handleTreeContextMenu(e, node)}>
      {node.type === 'folder' ? <FolderOutlined className={styles.treeIcon} /> : <FolderOpenOutlined className={styles.treeIcon} />}
      <span>{node.name}</span>
    </div>
  )

  // Convert tree data to Ant Design Tree format
  const transformTreeData = (nodes: FileNode[]) => {
    return nodes.map((node) => ({
      key: node.id,
      title: renderTreeNode(node),
      isLeaf: node.type === 'file',
      children: node.children ? transformTreeData(node.children) : undefined
    }))
  }

  return (
    <div className={styles.container}>
      {/* Top toolbar */}
      <div className={styles.toolbar}>
        <Space>
          <Button
            type="primary"
            icon={<FolderAddOutlined />}
            onClick={() => setCreateFolderModal({ open: true, parentId: '' })}
            disabled={isLoading}
          >
            新建文件夹
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            上传文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) {
                Array.from(e.target.files).forEach(handleFileUpload)
                e.target.value = ''
              }
            }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refreshTree()}
            loading={isLoading}
          >
            刷新
          </Button>
        </Space>
        <Space>
          <Input
            placeholder="搜索文件..."
            prefix={<SearchOutlined />}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
      </div>

      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <div className={styles.breadcrumb}>
          <Breadcrumb items={breadcrumbs.map((crumb, i) => ({ title: crumb }))} />
        </div>
      )}

      {/* Main content area */}
      <div
        className={styles.mainContent}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className={styles.dragOverlay}>
            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <p>拖放文件到此处上传</p>
          </div>
        )}

        <div className={styles.leftPanel}>
          <Card size="small" title="项目文件树" className={styles.treeCard}>
            <Tree
              treeData={transformTreeData(filteredTreeData)}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onSelect={handleTreeSelect}
              onExpand={handleTreeExpand}
              showLine
              showIcon
            />
          </Card>
        </div>

        <div className={styles.rightPanel}>
          <Card size="small" title="文件预览" className={styles.previewCard}>
            <FilePreview file={selectedFile} />
          </Card>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className={styles.contextMenuItem}
            onClick={() => handleContextAction('createFolder')}
          >
            新建文件夹
          </div>
          {contextMenu.node && contextMenu.node.type === 'folder' && (
            <div
              className={styles.contextMenuItem}
              onClick={() => handleContextAction('createFolder')}
            >
              在此处新建文件夹
            </div>
          )}
          {contextMenu.node && contextMenu.node.type === 'file' && (
            <div
              className={styles.contextMenuItem}
              onClick={() => fileInputRef.current?.click()}
            >
              上传文件到此文件夹
            </div>
          )}
          {contextMenu.node && (
            <>
              <div className={styles.contextMenuDivider} />
              <div
                className={styles.contextMenuItem}
                onClick={() => handleContextAction('rename')}
              >
                重命名
              </div>
              <Popconfirm
                title="确认删除"
                description={`确定要删除 "${contextMenu.node.name}" 吗？`}
                onConfirm={() => handleContextAction('delete')}
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
              >
                <div className={`${styles.contextMenuItem} ${styles.contextMenuDelete}`}>
                  删除
                </div>
              </Popconfirm>
            </>
          )}
        </div>
      )}

      {/* Rename modal */}
      <Modal
        title="重命名"
        open={renameModal.open}
        onOk={handleRenameSubmit}
        onCancel={() => setRenameModal({ open: false, node: null, newName: '' })}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={renameModal.newName}
          onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
          onPressEnter={handleRenameSubmit}
          autoFocus
        />
      </Modal>

      {/* Create folder modal */}
      <Modal
        title="新建文件夹"
        open={createFolderModal.open}
        onOk={handleCreateFolderSubmit}
        onCancel={() => setCreateFolderModal({ open: false, parentId: '' })}
        okText="确定"
        cancelText="取消"
      >
        <p>文件夹将创建在: {createFolderModal.parentId ? '指定位置' : '项目根目录'}</p>
        <p>请在右键菜单中输入文件夹名称</p>
      </Modal>

      {/* Error display */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <Button size="small" onClick={() => refreshTree()}>重试</Button>
        </div>
      )}
    </div>
  )
}
