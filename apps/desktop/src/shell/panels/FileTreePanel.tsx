import { readString, writeString } from '../../shared/storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Spin, Tooltip, Typography, theme } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { Folder, FileText, FolderOpen, RotateCw, ChevronLeft, ArrowLeft } from 'lucide-react'
import Tree from 'antd/es/tree'
import styles from './panels.module.css'

const { Text } = Typography

const LS_ROOT = 'geowork.fileTree.root'

interface FileTreeNode {
  path: string
  name: string
  is_dir: boolean
  children?: FileTreeNode[]
}

interface FileTreePanelProps {
  /** 可选:外部传入的工作区绝对路径(优先于 localStorage) */
  workspacePath?: string
}

/** 把绝对路径转成相对 root 的路径(用于读取文件)。 */
function toRelative(root: string, abs: string): string {
  if (abs.startsWith(root)) {
    return abs.slice(root.length).replace(/^[\\/]+/, '')
  }
  return abs
}

/** FileTreeNode[] → antd DataNode[]。 */
function toTreeData(nodes: FileTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.path,
    title: n.name,
    icon: n.is_dir ? <Folder /> : <FileText />,
    isLeaf: !n.is_dir,
    children: n.children && n.children.length > 0 ? toTreeData(n.children) : undefined,
  }))
}

export function FileTreePanel({ workspacePath }: FileTreePanelProps) {
  const { token } = theme.useToken()
  const [root, setRoot] = useState<string>(() => workspacePath ?? (readString(LS_ROOT, '') || ''))
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  /* 外部传入路径变化时同步 */
  useEffect(() => {
    if (workspacePath && workspacePath !== root) {
      setRoot(workspacePath)
    }
  }, [workspacePath, root])

  const loadTree = useCallback(async (r: string) => {
    if (!r) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.geowork?.runtime?.getTreeByPath(r)
      if (res && res.error) throw new Error(res.error)
      const nodes: FileTreeNode[] = Array.isArray(res) ? res : []
      setTree(nodes)
      /* 默认展开根节点的第一层 */
      const rootKeys = nodes.map((n) => n.path)
      setExpandedKeys(rootKeys)
    } catch (e: any) {
      setError(e?.message || '加载文件树失败')
      setTree([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (root) {
      writeString(LS_ROOT, root)
      loadTree(root)
    }
  }, [root, loadTree])

  const handleChooseFolder = useCallback(async () => {
    const chosen = await window.geowork?.desktop?.chooseFolder()
    const path = Array.isArray(chosen)
      ? chosen[0]
      : typeof chosen === 'string'
        ? chosen
        : (chosen as any)?.path
    if (path) setRoot(path)
  }, [])

  const handleSelectFile = useCallback(
    async (absPath: string) => {
      setSelectedFile(absPath)
      setFileLoading(true)
      setFileContent('')
      try {
        const rel = toRelative(root, absPath)
        const res = await window.geowork?.runtime?.readFileByPath(root, rel)
        if (res && res.error) throw new Error(res.error)
        setFileContent(typeof res?.content === 'string' ? res.content : '')
      } catch (e: any) {
        setFileContent(`// 读取失败: ${e?.message || e}`)
      } finally {
        setFileLoading(false)
      }
    },
    [root],
  )

  const treeData = useMemo(() => toTreeData(tree), [tree])

  const border = token.colorBorderSecondary

  /* 无根目录:选择工作目录 */
  if (!root) {
    return (
      <div className={styles.panel} style={{ background: token.colorBgContainer }}>
        <div className={styles.placeholder}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 13 }}>
                选择一个工作目录以加载文件树
              </Text>
            }
          >
            <Button type="primary" icon={<FolderOpen />} onClick={handleChooseFolder}>
              选择工作目录
            </Button>
          </Empty>
        </div>
      </div>
    )
  }

  /* 文件预览态 */
  if (selectedFile) {
    const rel = toRelative(root, selectedFile)
    return (
      <div className={styles.panel} style={{ background: token.colorBgContainer }}>
        <div className={styles.previewHeader} style={{ borderBottom: `1px solid ${border}` }}>
          <Tooltip title="返回文件树">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeft />}
              onClick={() => setSelectedFile(null)}
            />
          </Tooltip>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {rel}
          </Text>
        </div>
        <div className={styles.previewBody} style={{ color: token.colorText }}>
          {fileLoading ? <Spin size="small" /> : fileContent || '// 空文件'}
        </div>
      </div>
    )
  }

  /* 文件树态 */
  return (
    <div className={styles.panel} style={{ background: token.colorBgContainer }}>
      <div className={styles.toolbar} style={{ borderBottom: `1px solid ${border}` }}>
        <Tooltip title="返回上级/重选目录">
          <Button type="text" size="small" icon={<ChevronLeft />} onClick={handleChooseFolder} />
        </Tooltip>
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: "'SF Mono', 'Cascadia Code', monospace",
          }}
          title={root}
        >
          {root}
        </Text>
        <Tooltip title="刷新">
          <Button type="text" size="small" icon={<RotateCw />} onClick={() => loadTree(root)} />
        </Tooltip>
      </div>
      <div className={styles.content}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : error ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="danger" style={{ fontSize: 12 }}>
                {error}
              </Text>
            }
          >
            <Button size="small" onClick={handleChooseFolder}>
              重新选择
            </Button>
          </Empty>
        ) : treeData.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                空目录
              </Text>
            }
          />
        ) : (
          <Tree
            className={styles.treeWrap}
            showIcon
            blockNode
            treeData={treeData}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            onSelect={(keys) => {
              if (keys.length > 0) handleSelectFile(String(keys[0]))
            }}
          />
        )}
      </div>
    </div>
  )
}
