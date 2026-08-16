import { Suspense, lazy, useMemo } from 'react'
import { Collapse, Spin, Tag, Typography, theme } from 'antd'
import { FileDiff as FileDiffIcon, Loader2 } from 'lucide-react'
import type { FileDiff } from './conversationStorage'
import { useAppearanceStore } from '../../../shared/stores/appearanceStore'
import styles from './DiffViewer.module.css'

const { Text } = Typography

/* A4（doc/23）：@git-diff-view 体积较大（~320KB），动态导入不进主包。
 * CSS 随组件 chunk 一并加载。 */
const LazyDiffView = lazy(async () => {
  const [mod] = await Promise.all([
    import('@git-diff-view/react'),
    import('@git-diff-view/react/styles/diff-view.css'),
  ])
  return { default: mod.DiffView }
})

/* 由路径后缀推断高亮语言；未知回退纯文本。 */
function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    sql: 'sql',
  }
  return map[ext] ?? ''
}

/* 统计 unified diff 的增删行数（供头部徽标展示）。 */
function countChanges(unified: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of unified.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) added++
    else if (line.startsWith('-')) removed++
  }
  return { added, removed }
}

export interface DiffViewerProps {
  fileDiffs: FileDiff[]
}

/**
 * A4 文件变更查看器：内联渲染 write_file/create_artifact 产生的 unified diff。
 * 每个文件一个折叠面板，头部展示路径 + 增删行数徽标。
 */
export function DiffViewer({ fileDiffs }: DiffViewerProps) {
  const { token } = theme.useToken()
  const resolvedAppearance = useAppearanceStore((s) => s.resolvedAppearance)

  const items = useMemo(
    () =>
      fileDiffs.map((diff) => {
        const { added, removed } = countChanges(diff.unified)
        return {
          key: diff.id,
          label: (
            <span className={styles.header}>
              <FileDiffIcon size={14} style={{ color: token.colorTextSecondary }} />
              <Text className={styles.path} ellipsis>
                {diff.path}
              </Text>
              <Tag color="success" className={styles.countTag}>
                +{added}
              </Tag>
              <Tag color="error" className={styles.countTag}>
                -{removed}
              </Tag>
            </span>
          ),
          children: (
            <Suspense
              fallback={
                <div className={styles.loading}>
                  <Spin size="small" indicator={<Loader2 className={styles.spinner} />} />
                </div>
              }
            >
              <LazyDiffView
                data={{
                  oldFile: { fileName: diff.path, fileLang: langFromPath(diff.path) },
                  newFile: { fileName: diff.path, fileLang: langFromPath(diff.path) },
                  hunks: [diff.unified],
                }}
                diffViewTheme={resolvedAppearance === 'dark' ? 'dark' : 'light'}
                diffViewHighlight
                diffViewWrap
              />
            </Suspense>
          ),
        }
      }),
    [fileDiffs, token.colorTextSecondary, resolvedAppearance],
  )

  if (!fileDiffs || fileDiffs.length === 0) return null

  return (
    <div className={styles.root}>
      <Collapse
        ghost
        size="small"
        defaultActiveKey={fileDiffs.length === 1 ? [fileDiffs[0].id] : []}
        items={items}
      />
    </div>
  )
}
