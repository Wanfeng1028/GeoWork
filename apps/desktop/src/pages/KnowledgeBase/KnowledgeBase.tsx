import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Spinner } from '../../components/ui/spinner'
import { Empty } from '../../components/ui/empty'
import { toast } from 'sonner'
import {
  FolderPlus,
  Folder,
  File,
  FileText,
  Download,
  Plus,
  Upload,
  Search
} from 'lucide-react'
import { useKnowledgeBaseStore, type KnowledgeCategory, type KnowledgeEntry } from './store'
import { KnowledgeDetail } from './KnowledgeDetail'
import styles from './KnowledgeBase.module.scss'

export function KnowledgeBase() {
  const {
    categories,
    entries,
    selectedCategory,
    selectedEntry,
    searchQuery,
    isLoading,
    error,
    setSelectedCategory,
    setSelectedEntry,
    setSearchQuery,
    createCategory,
    indexFromPaper,
    importFromFile,
    deleteEntry,
    search,
    loadEntries,
    refresh,
  } = useKnowledgeBaseStore()

  const [detailVisible, setDetailVisible] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatParent, setNewCatParent] = useState('')
  const [uploading, setUploading] = useState(false)
  const [paperIndexModalOpen, setPaperIndexModalOpen] = useState(false)
  const [paperForm, setPaperForm] = useState({ paperId: '', title: '', content: '', tags: '' })

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (searchQuery) {
      search(searchQuery)
    } else {
      loadEntries(selectedCategory || undefined)
    }
  }, [selectedCategory, searchQuery, loadEntries, search])

  const handleSelectCategory = useCallback((catId: string | null) => {
    setSelectedCategory(catId)
    setSelectedEntry(null)
  }, [setSelectedCategory, setSelectedEntry])

  const handleSelectEntry = useCallback(async (entry: KnowledgeEntry) => {
    setSelectedEntry(entry)
    setDetailVisible(true)
  }, [setSelectedEntry])

  const handleCreateCategory = useCallback(async () => {
    try {
      await createCategory(newCatName, newCatParent || undefined)
      setNewCatName('')
      setNewCatParent('')
      setCreateModalOpen(false)
      toast.success('分类创建成功')
    } catch {
      toast.error('分类创建失败')
    }
  }, [newCatName, newCatParent, createCategory])

  const handleImportFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      await importFromFile(file)
      toast.success('文件导入成功')
    } catch {
      toast.error('文件导入失败')
    } finally {
      setUploading(false)
    }
  }, [importFromFile])

  const handleIndexFromPaper = useCallback(async () => {
    try {
      await indexFromPaper(paperForm.paperId, paperForm.title, paperForm.content, paperForm.tags?.split(',').map((t: string) => t.trim()) || [])
      setPaperForm({ paperId: '', title: '', content: '', tags: '' })
      setPaperIndexModalOpen(false)
      toast.success('论文索引成功')
    } catch {
      toast.error('论文索引失败')
    }
  }, [paperForm, indexFromPaper])

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      await deleteEntry(id)
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }, [deleteEntry])

  const treeData = useMemo(() => {
    const buildTree = (cats: KnowledgeCategory[]): React.ReactNode[] => {
      return cats.map((cat) => (
        <div key={cat.id}>
          <div
            className={`${styles.treeNode} ${selectedCategory === cat.id ? styles.selected : ''}`}
            onClick={() => handleSelectCategory(cat.id)}
          >
            <Folder className={styles.treeIcon} />
            <span className={styles.treeLabel}>{cat.name}</span>
          </div>
          {cat.children && cat.children.length > 0 && (
            <div className="ml-4">
              {buildTree(cat.children)}
            </div>
          )}
        </div>
      ))
    }
    return buildTree(categories)
  }, [categories, selectedCategory, handleSelectCategory])

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [entries, searchQuery])

  const sourceColors: Record<string, string> = {
    paper_id: 'bg-blue-100 text-blue-800',
    pdf: 'bg-green-100 text-green-800',
    manual: 'bg-orange-100 text-orange-800'
  }

  const sourceLabels: Record<string, string> = {
    paper_id: '论文',
    pdf: 'PDF',
    manual: '手动'
  }

  if (error) {
    return (
      <div className={styles.emptyState}>
        <Empty description={`加载失败: ${error}`} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div className={styles.sidebar} style={{ width: 260, flexShrink: 0 }}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>知识分类</h3>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setCreateModalOpen(true)} title="新建分类">
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPaperIndexModalOpen(true)} title="从论文索引">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className={styles.sidebarContent}>
          {isLoading ? (
            <div className="text-center p-5">
              <Spinner className="w-5 h-5" />
            </div>
          ) : (
            <div>{treeData}</div>
          )}
          <div
            className={`${styles.treeNode} ${!selectedCategory ? styles.selected : ''}`}
            onClick={() => handleSelectCategory(null)}
          >
            <File className={styles.treeIcon} />
            <span className={styles.treeLabel}>全部条目</span>
          </div>
        </div>
      </div>

      {/* Right content */}
      <div className={styles.mainContent} style={{ flex: 1 }}>
        <div className={styles.toolbar}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>知识库</span>
            {selectedCategory && <><span>/</span><span>{findCategory(categories, selectedCategory)?.name}</span></>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="min-w-[200px]"
              placeholder="搜索知识条目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <label>
              <Button variant="outline" disabled={uploading} asChild>
                <span>
                  <Upload className="w-4 h-4 mr-1" /> 导入文件
                </span>
              </Button>
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImportFile(e.target.files[0])
                }}
              />
            </label>
          </div>
        </div>

        <div className={styles.entryList}>
          {isLoading ? (
            <div className="text-center p-10">
              <Spinner className="w-8 h-8" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <Empty description="暂无知识条目" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">标题</th>
                  <th className="text-left p-3 w-[100px]">来源</th>
                  <th className="text-left p-3 w-[200px]">标签</th>
                  <th className="text-left p-3 w-[160px]">创建时间</th>
                  <th className="text-left p-3 w-[100px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b cursor-pointer hover:bg-muted/50" onClick={() => handleSelectEntry(entry)}>
                    <td className="p-3 font-medium">{entry.title}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className={sourceColors[entry.source] || ''}>
                        {sourceLabels[entry.source] || entry.source}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(entry.tags || []).map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">{new Date(entry.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id) }}>
                        删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailVisible} onOpenChange={setDetailVisible}>
        <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
          <KnowledgeDetail visible={detailVisible} onClose={() => setDetailVisible(false)} />
        </DialogContent>
      </Dialog>

      {/* Create category modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建知识分类</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">分类名称</label>
              <Input placeholder="例如：遥感算法、NDVI 研究" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">父分类</label>
              <Input placeholder="留空表示顶级分类" value={newCatParent} onChange={(e) => setNewCatParent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateModalOpen(false); setNewCatName(''); setNewCatParent('') }}>取消</Button>
            <Button onClick={handleCreateCategory}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Index from paper modal */}
      <Dialog open={paperIndexModalOpen} onOpenChange={setPaperIndexModalOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>从论文索引到知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">论文 ID</label>
              <Input placeholder="例如：paper_ndvi_review" value={paperForm.paperId} onChange={(e) => setPaperForm({ ...paperForm, paperId: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">标题</label>
              <Input placeholder="知识条目标题" value={paperForm.title} onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">内容</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="知识条目的正文内容"
                value={paperForm.content}
                onChange={(e) => setPaperForm({ ...paperForm, content: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">标签</label>
              <Input placeholder="多个标签用逗号分隔" value={paperForm.tags} onChange={(e) => setPaperForm({ ...paperForm, tags: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPaperIndexModalOpen(false); setPaperForm({ paperId: '', title: '', content: '', tags: '' }) }}>取消</Button>
            <Button onClick={handleIndexFromPaper}>索引</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function findCategory(categories: KnowledgeCategory[], id: string): KnowledgeCategory | null {
  for (const cat of categories) {
    if (cat.id === id) return cat
    if (cat.children) {
      const found = findCategory(cat.children, id)
      if (found) return found
    }
  }
  return null
}
