import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { toast } from 'sonner'
import {
  FolderPlus,
  FolderOpen,
  Folder,
  RefreshCw,
  Search,
  Upload
} from 'lucide-react'
import type { FileNode } from '../../services/fileService'
import { useProjectFilesStore } from './store'
import { FilePreview } from './FilePreview'
import styles from './ProjectFiles.module.scss'

export function ProjectFiles() {
  const {
    treeData,
    selectedFile,
    breadcrumbs,
    isLoading,
    error,
    setSelectedFile,
    setBreadcrumbs,
    createFolder,
    uploadFile,
    deleteNode,
    renameNode,
    refreshTree
  } = useProjectFilesStore()

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [searchValue, setSearchValue] = useState('')
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

  useEffect(() => {
    refreshTree().catch(() => toast.error('Failed to load project files'))
  }, [])

  useEffect(() => {
    const keys = new Set<string>()
    const collectKeys = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          keys.add(node.id)
          collectKeys(node.children)
        }
      }
    }
    collectKeys(treeData)
    setExpandedKeys(keys)
  }, [treeData])

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

  const handleTreeSelect = (node: FileNode) => {
    setSelectedFile(node)
    updateBreadcrumbs(node)
  }

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu?.node) return
    const node = contextMenu.node

    if (action === 'createFolder') {
      setCreateFolderModal({ open: true, parentId: node.id })
    } else if (action === 'rename') {
      setRenameModal({ open: true, node, newName: node.name })
    } else if (action === 'delete') {
      if (window.confirm(`确定要删除 "${node.name}" 吗？此操作不可撤销。`)) {
        deleteNode(node.id).then(() => toast.success('删除成功')).catch(() => toast.error('删除失败'))
      }
    }
    setContextMenu(null)
  }, [contextMenu, deleteNode])

  const handleRenameSubmit = useCallback(async () => {
    if (!renameModal.node || !renameModal.newName.trim()) return
    try {
      await renameNode(renameModal.node.id, renameModal.newName.trim())
      toast.success('重命名成功')
      setRenameModal({ open: false, node: null, newName: '' })
    } catch {
      toast.error('重命名失败')
    }
  }, [renameModal, renameNode])

  const handleCreateFolderSubmit = useCallback(async () => {
    const name = prompt('请输入文件夹名称:')
    if (!name || !name.trim()) return
    try {
      await createFolder(createFolderModal.parentId, name.trim())
      toast.success('创建成功')
      setCreateFolderModal({ open: false, parentId: '' })
    } catch {
      toast.error('创建失败')
    }
  }, [createFolder, createFolderModal.parentId])

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      await uploadFile('', file)
      toast.success(`文件 "${file.name}" 上传成功`)
    } catch {
      toast.error(`文件 "${file.name}" 上传失败`)
    }
  }, [uploadFile])

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
    if (dragCounterRef.current === 0) setDragOver(false)
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
    Array.from(e.dataTransfer.files).forEach(handleFileUpload)
  }, [handleFileUpload])

  const updateBreadcrumbs = (node: FileNode) => {
    const crumbs: string[] = []
    const collectPath = (nodes: FileNode[], targetId: string, path: string[]): boolean => {
      for (const n of nodes) {
        const currentPath = path.length > 0 ? `${path[path.length - 1]} / ${n.name}` : n.name
        if (n.id === targetId) { crumbs.push(...path, n.name); return true }
        if (n.children && collectPath(n.children, targetId, [...path, n.name])) return true
      }
      return false
    }
    collectPath(treeData, node.id, [])
    setBreadcrumbs(crumbs)
  }

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

  const renderTreeNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedKeys.has(node.id)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id}>
        <div
          className={`${styles.treeNode} cursor-pointer hover:bg-muted/50 px-2 py-1 rounded`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleTreeSelect(node)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, node }) }}
        >
          {hasChildren && (
            <span className="mr-1 text-xs" onClick={(e) => { e.stopPropagation(); setExpandedKeys(prev => { const next = new Set(prev); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next }) }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {node.type === 'folder' ? <Folder className={styles.treeIcon} /> : <FolderOpen className={styles.treeIcon} />}
          <span>{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Top toolbar */}
      <div className={styles.toolbar}>
        <div className="flex gap-2">
          <Button onClick={() => setCreateFolderModal({ open: true, parentId: '' })} disabled={isLoading}>
            <FolderPlus className="w-4 h-4 mr-1" /> 新建文件夹
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            <Upload className="w-4 h-4 mr-1" /> 上传文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                Array.from(e.target.files).forEach(handleFileUpload)
                e.target.value = ''
              }
            }}
          />
          <Button variant="outline" onClick={() => refreshTree()} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1" /> 刷新
          </Button>
        </div>
        <Input
          placeholder="搜索文件..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-[200px]"
        />
      </div>

      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <div className={styles.breadcrumb}>
          <div className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1 text-muted-foreground">/</span>}
                {crumb}
              </span>
            ))}
          </div>
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
        {dragOver && (
          <div className={styles.dragOverlay}>
            <Upload className="w-12 h-12 text-blue-500" />
            <p>拖放文件到此处上传</p>
          </div>
        )}

        <div className={styles.leftPanel}>
          <Card>
            <CardHeader>
              <CardTitle>项目文件树</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTreeData.map(node => renderTreeNode(node))}
            </CardContent>
          </Card>
        </div>

        <div className={styles.rightPanel}>
          <Card>
            <CardHeader>
              <CardTitle>文件预览</CardTitle>
            </CardHeader>
            <CardContent>
              <FilePreview file={selectedFile} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className={styles.contextMenuItem} onClick={() => handleContextAction('createFolder')}>
            新建文件夹
          </div>
          {contextMenu.node && contextMenu.node.type === 'file' && (
            <div className={styles.contextMenuItem} onClick={() => fileInputRef.current?.click()}>
              上传文件到此文件夹
            </div>
          )}
          {contextMenu.node && (
            <>
              <div className={styles.contextMenuDivider} />
              <div className={styles.contextMenuItem} onClick={() => handleContextAction('rename')}>
                重命名
              </div>
              <div className={`${styles.contextMenuItem} ${styles.contextMenuDelete}`} onClick={() => handleContextAction('delete')}>
                删除
              </div>
            </>
          )}
        </div>
      )}

      {/* Rename modal */}
      <Dialog open={renameModal.open} onOpenChange={(open) => setRenameModal({ ...renameModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <Input
            value={renameModal.newName}
            onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit() }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModal({ open: false, node: null, newName: '' })}>取消</Button>
            <Button onClick={handleRenameSubmit}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create folder modal */}
      <Dialog open={createFolderModal.open} onOpenChange={(open) => setCreateFolderModal({ ...createFolderModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">文件夹将创建在: {createFolderModal.parentId ? '指定位置' : '项目根目录'}</p>
          <p className="text-sm text-muted-foreground">请在右键菜单中输入文件夹名称</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderModal({ open: false, parentId: '' })}>取消</Button>
            <Button onClick={handleCreateFolderSubmit}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error display */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => refreshTree()}>重试</Button>
        </div>
      )}
    </div>
  )
}
