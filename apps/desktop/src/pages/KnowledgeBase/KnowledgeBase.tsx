import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Spinner } from '../../components/ui/spinner'
import { Empty } from '../../components/ui/empty'
import { toast } from 'sonner'
import { Folder, File, Download, Plus, Upload, Search, Trash2, BookOpen } from 'lucide-react'
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

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (searchQuery) search(searchQuery)
    else loadEntries(selectedCategory || undefined)
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
    } catch { toast.error('分类创建失败') }
  }, [newCatName, newCatParent, createCategory])

  const handleImportFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      await importFromFile(file)
      toast.success('文件导入成功')
    } catch { toast.error('文件导入失败') }
    finally { setUploading(false) }
  }, [importFromFile])

  const handleIndexFromPaper = useCallback(async () => {
    try {
      await indexFromPaper(paperForm.paperId, paperForm.title, paperForm.content, paperForm.tags?.split(',').map((t: string) => t.trim()) || [])
      setPaperForm({ paperId: '', title: '', content: '', tags: '' })
      setPaperIndexModalOpen(false)
      toast.success('论文索引成功')
    } catch { toast.error('论文索引失败') }
  }, [paperForm, indexFromPaper])

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      await deleteEntry(id)
      toast.success('已删除')
    } catch { toast.error('删除失败') }
  }, [deleteEntry])

  const treeData = useMemo(() => buildTree(categories, selectedCategory, handleSelectCategory), [categories, selectedCategory, handleSelectCategory])

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter((e) => e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)))
  }, [entries, searchQuery])

  if (error) {
    return <div className={styles.emptyState}><Empty description={`加载失败: ${error}`} /></div>
  }

  return (
    <div className={styles.knowledgeShell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div>
            <h3>知识分类</h3>
            <span>{categories.length} 个分类</span>
          </div>
          <div className={styles.headerButtons}>
            <button onClick={() => setCreateModalOpen(true)} title="新建分类"><Plus size={14} /></button>
            <button onClick={() => setPaperIndexModalOpen(true)} title="从论文索引"><Download size={14} /></button>
          </div>
        </div>
        <div className={styles.sidebarContent}>
          {isLoading ? <div className={styles.loadingSmall}><Spinner className="w-5 h-5" /></div> : <div>{treeData}</div>}
          <button className={`${styles.treeNode} ${!selectedCategory ? styles.selected : ''}`} onClick={() => handleSelectCategory(null)}>
            <File className={styles.treeIcon} />
            <span className={styles.treeLabel}>全部条目</span>
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h2>知识库</h2>
            <p>{selectedCategory ? findCategory(categories, selectedCategory)?.name : '全部条目'} · {filteredEntries.length} 条记录</p>
          </div>
          <label className={styles.importButton}>
            <Upload size={14} />
            <span>{uploading ? '导入中' : '导入文件'}</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.csv,.json"
              onChange={(e) => { if (e.target.files?.[0]) handleImportFile(e.target.files[0]) }}
            />
          </label>
        </div>

        <section className={styles.entryPanel}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={14} />
              <Input placeholder="搜索知识条目..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className={styles.entryList}>
            {isLoading ? (
              <div className={styles.loadingState}><Spinner className="w-8 h-8" /></div>
            ) : filteredEntries.length === 0 ? (
              <div className={styles.emptyRows}><BookOpen size={24} /><span>暂无知识条目</span></div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHead}><span>标题</span><span>来源</span><span>标签</span><span>创建时间</span><span>操作</span></div>
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className={styles.tableRow} onClick={() => handleSelectEntry(entry)}>
                    <strong>{entry.title}</strong>
                    <span className={styles.sourceBadge}>{sourceLabel(entry.source)}</span>
                    <div className={styles.tags}>{(entry.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <time>{new Date(entry.createdAt).toLocaleDateString('zh-CN')}</time>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id) }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Dialog open={detailVisible} onOpenChange={setDetailVisible}>
        <DialogContent className={styles.detailDialog}>
          <KnowledgeDetail visible={detailVisible} onClose={() => setDetailVisible(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className={styles.smallDialog}>
          <DialogHeader><DialogTitle>新建知识分类</DialogTitle></DialogHeader>
          <div className={styles.formStack}>
            <Field label="分类名称"><Input placeholder="例如：遥感算法、NDVI 研究" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} /></Field>
            <Field label="父分类"><Input placeholder="留空表示顶级分类" value={newCatParent} onChange={(e) => setNewCatParent(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateModalOpen(false); setNewCatName(''); setNewCatParent('') }}>取消</Button>
            <Button onClick={handleCreateCategory}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paperIndexModalOpen} onOpenChange={setPaperIndexModalOpen}>
        <DialogContent className={styles.paperDialog}>
          <DialogHeader><DialogTitle>从论文索引到知识库</DialogTitle></DialogHeader>
          <div className={styles.formStack}>
            <Field label="论文 ID"><Input placeholder="例如：paper_ndvi_review" value={paperForm.paperId} onChange={(e) => setPaperForm({ ...paperForm, paperId: e.target.value })} /></Field>
            <Field label="标题"><Input placeholder="知识条目标题" value={paperForm.title} onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })} /></Field>
            <Field label="内容"><textarea placeholder="知识条目的正文内容" value={paperForm.content} onChange={(e) => setPaperForm({ ...paperForm, content: e.target.value })} /></Field>
            <Field label="标签"><Input placeholder="多个标签用逗号分隔" value={paperForm.tags} onChange={(e) => setPaperForm({ ...paperForm, tags: e.target.value })} /></Field>
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

function buildTree(categories: KnowledgeCategory[], selectedCategory: string | null, handleSelectCategory: (id: string | null) => void): React.ReactNode[] {
  return categories.map((cat) => (
    <div key={cat.id}>
      <button className={`${styles.treeNode} ${selectedCategory === cat.id ? styles.selected : ''}`} onClick={() => handleSelectCategory(cat.id)}>
        <Folder className={styles.treeIcon} />
        <span className={styles.treeLabel}>{cat.name}</span>
      </button>
      {cat.children && cat.children.length > 0 && <div className={styles.treeChildren}>{buildTree(cat.children, selectedCategory, handleSelectCategory)}</div>}
    </div>
  ))
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>
}

function sourceLabel(source: string) {
  return source === 'paper_id' ? '论文' : source === 'pdf' ? 'PDF' : source === 'manual' ? '手动' : source
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
