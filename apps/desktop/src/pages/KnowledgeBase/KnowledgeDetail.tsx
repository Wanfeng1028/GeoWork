import { useCallback, useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Empty } from '../../components/ui/empty'
import { toast } from 'sonner'
import {
  Trash2,
  Download,
  Edit,
  FileText,
  Search,
} from 'lucide-react'
import { useKnowledgeBaseStore } from './store'
import styles from './KnowledgeDetail.module.scss'

interface KnowledgeDetailProps {
  visible: boolean
  onClose: () => void
}

export function KnowledgeDetail({ visible, onClose }: KnowledgeDetailProps) {
  const { selectedEntry, deleteEntry, updateEntry, isLoading } = useKnowledgeBaseStore()
  const [searchText, setSearchText] = useState('')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  const handleDelete = useCallback(() => {
    if (!selectedEntry) return
    if (window.confirm(`确定要删除 "${selectedEntry.title}" 吗？此操作不可撤销。`)) {
      deleteEntry(selectedEntry.id).then(() => {
        toast.success('已删除')
        onClose()
      }).catch(() => {
        toast.error('删除失败')
      })
    }
  }, [selectedEntry, deleteEntry, onClose])

  const handleExport = useCallback(() => {
    if (!selectedEntry) return
    const blob = new Blob([selectedEntry.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedEntry.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('导出成功')
  }, [selectedEntry])

  const handleEdit = useCallback(() => {
    if (!selectedEntry) return
    setEditContent(selectedEntry.content)
    setEditing(true)
  }, [selectedEntry])

  const handleSaveEdit = useCallback(async () => {
    if (!selectedEntry) return
    try {
      await updateEntry(selectedEntry.id, { content: editContent })
      setEditing(false)
      toast.success('保存成功')
    } catch {
      toast.error('保存失败')
    }
  }, [editContent, selectedEntry, updateEntry])

  const handleCiteInPaper = useCallback(() => {
    if (!selectedEntry) return
    toast.info(`已在论文中引用: ${selectedEntry.title}`)
  }, [selectedEntry])

  const sourceTagColor = useMemo(() => {
    if (!selectedEntry) return ''
    switch (selectedEntry.source) {
      case 'paper_id': return 'bg-blue-100 text-blue-800'
      case 'pdf': return 'bg-green-100 text-green-800'
      case 'manual': return 'bg-orange-100 text-orange-800'
      default: return ''
    }
  }, [selectedEntry])

  const sourceLabel = useMemo(() => {
    if (!selectedEntry) return ''
    switch (selectedEntry.source) {
      case 'paper_id': return '论文索引'
      case 'pdf': return 'PDF 导入'
      case 'manual': return '手动录入'
      default: return selectedEntry.source
    }
  }, [selectedEntry])

  const highlightedContent = useMemo(() => {
    if (!selectedEntry || !searchText) return selectedEntry?.content || ''
    const content = selectedEntry.content
    const parts = content.split(new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === searchText.toLowerCase()
        ? <span key={i} className={styles.highlight}>{part}</span>
        : part,
    )
  }, [selectedEntry?.content, searchText])

  if (!selectedEntry) {
    return (
      <div className={styles.detailPanel}>
        <Empty description="未选择知识条目" />
      </div>
    )
  }

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <h4 className={styles.detailTitle}>
          {selectedEntry.title}
        </h4>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={handleEdit}><Edit className="w-3 h-3 mr-1" /> 编辑</Button>
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="w-3 h-3 mr-1" /> 导出</Button>
          <Button size="sm" variant="outline" onClick={handleCiteInPaper}><FileText className="w-3 h-3 mr-1" /> 在论文中引用</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={handleDelete}><Trash2 className="w-3 h-3 mr-1" /> 删除</Button>
        </div>
      </div>

      <div className={styles.detailMeta}>
        <div className="grid grid-cols-2 gap-2 border rounded p-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-[80px]">来源</span>
            <div>
              <Badge variant="secondary" className={sourceTagColor}>{sourceLabel}</Badge>
              <span className="text-muted-foreground ml-2">{selectedEntry.source}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-[80px]">分类</span>
            <span>{selectedEntry.category || '未分类'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-[80px]">创建时间</span>
            <span>{new Date(selectedEntry.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground min-w-[80px]">更新时间</span>
            <span>{new Date(selectedEntry.updatedAt).toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex gap-2 col-span-2">
            <span className="text-muted-foreground min-w-[80px]">标签</span>
            <div className="flex flex-wrap gap-1">
              {selectedEntry.tags?.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
              {(!selectedEntry.tags || selectedEntry.tags.length === 0) && (
                <span className="text-muted-foreground">暂无标签</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.detailSearch}>
        <Input
          placeholder="在内容中搜索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className={styles.detailContent}>
        {isLoading ? (
          <span className="text-sm text-muted-foreground">加载中...</span>
        ) : (
          <p className={styles.contentText}>
            {highlightedContent}
          </p>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle>编辑知识条目</DialogTitle>
          </DialogHeader>
          <textarea
            className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
