import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, Filter, Download, Database, Star, Link, RefreshCw, X, Table2, PanelsTopLeft } from 'lucide-react'
import { usePaperSearchStore, PaperResult } from './store'
import { PaperCard } from './PaperCard'
import { validateSearchParams } from '../../services/paperService'
import styles from './PaperSearch.module.scss'

export function PaperSearch() {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [showDetail, setShowDetail] = useState(false)
  const [favoritedPapers, setFavoritedPapers] = useState<Set<string>>(new Set())
  const [formState, setFormState] = useState({ author: '', yearFrom: '', yearTo: '', topic: '' })

  const { query, results, isLoading, total, page, pageSize, selectedPaper, isAdvancedOpen, setQuery, search, selectPaper, toggleAdvanced, exportBibtex, exportCsv, indexToKnowledge, clearResults } = usePaperSearchStore()

  const handleSearch = useCallback(async () => {
    const validationError = validateSearchParams({ query })
    if (validationError) {
      toast.warning(validationError)
      return
    }
    await search({
      query,
      author: formState.author || undefined,
      yearFrom: formState.yearFrom ? parseInt(formState.yearFrom) : undefined,
      yearTo: formState.yearTo ? parseInt(formState.yearTo) : undefined,
      topic: formState.topic || undefined,
      page: 1,
      pageSize,
    })
  }, [query, formState, search, pageSize])

  const handlePageChange = useCallback((p: number) => {
    search({
      query,
      author: formState.author || undefined,
      yearFrom: formState.yearFrom ? parseInt(formState.yearFrom) : undefined,
      yearTo: formState.yearTo ? parseInt(formState.yearTo) : undefined,
      topic: formState.topic || undefined,
      page: p,
      pageSize,
    })
  }, [query, formState, search, pageSize])

  const handleRowClick = useCallback((paper: PaperResult) => {
    selectPaper(paper)
    setShowDetail(true)
  }, [selectPaper])

  const toggleFavorite = useCallback((paperId: string) => {
    setFavoritedPapers((prev) => {
      const next = new Set(prev)
      if (next.has(paperId)) next.delete(paperId)
      else next.add(paperId)
      return next
    })
  }, [])

  const detailContent = useMemo(() => {
    if (!selectedPaper) return null
    const paper = selectedPaper
    return (
      <div className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <h3>{paper.title}</h3>
          <button onClick={() => setShowDetail(false)}><X size={14} /></button>
        </div>
        <div className={styles.detailActions}>
          <button onClick={() => toggleFavorite(paper.id)}><Star size={14} className={favoritedPapers.has(paper.id) ? styles.filledStar : ''} />{favoritedPapers.has(paper.id) ? '已收藏' : '收藏'}</button>
          <button onClick={() => exportBibtex(paper)}><Download size={14} />导出 BibTeX</button>
          <button disabled={isLoading} onClick={async () => { try { await indexToKnowledge(paper); toast.success('已成功索引到知识库') } catch { toast.error('索引失败') } }}><Database size={14} />索引到知识库</button>
          {paper.doi && <button onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')}><Link size={14} />DOI</button>}
        </div>
        <div className={styles.detailMeta}>
          <InfoItem label="作者" value={paper.authors.join(', ')} />
          <InfoItem label="期刊" value={paper.journal} />
          <InfoItem label="年份" value={String(paper.year)} />
          <InfoItem label="引用" value={String(paper.citations)} strong />
        </div>
        {paper.keywords.length > 0 && <div className={styles.keywordRow}>{paper.keywords.map((kw) => <span key={kw}>{kw}</span>)}</div>}
        <section className={styles.detailSection}><h4>摘要</h4><p>{paper.abstract}</p></section>
        <section className={styles.detailSection}><h4>BibTeX</h4><pre>{paper.bibtex}</pre></section>
      </div>
    )
  }, [selectedPaper, favoritedPapers, isLoading, exportBibtex, indexToKnowledge, toggleFavorite])

  return (
    <div className={styles.paperSearchLayout}>
      <div className={styles.pageHeader}>
        <div>
          <h2>论文检索</h2>
          <p>搜索 OpenAlex 学术数据库并索引到知识库。</p>
        </div>
        <div className={styles.viewSwitch}>
          <button className={viewMode === 'table' ? styles.active : ''} onClick={() => setViewMode('table')}><Table2 size={14} />表格</button>
          <button className={viewMode === 'card' ? styles.active : ''} onClick={() => setViewMode('card')}><PanelsTopLeft size={14} />卡片</button>
        </div>
      </div>

      <section className={styles.searchPanel}>
        <div className={styles.searchLine}>
          <div className={styles.searchBox}>
            <Search size={15} />
            <Input placeholder="搜索论文关键词（如：NDVI remote sensing）" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }} />
          </div>
          <button className={styles.primaryButton} onClick={handleSearch} disabled={isLoading}><Search size={14} />搜索</button>
          <button className={`${styles.ghostButton} ${isAdvancedOpen ? styles.advancedActive : ''}`} onClick={toggleAdvanced}><Filter size={14} />高级</button>
        </div>
        {isAdvancedOpen && (
          <div className={styles.advancedPanel}>
            <Field label="作者"><Input placeholder="作者姓名" value={formState.author} onChange={(e) => setFormState({ ...formState, author: e.target.value })} /></Field>
            <Field label="起始年"><Input placeholder="起始年" value={formState.yearFrom} onChange={(e) => setFormState({ ...formState, yearFrom: e.target.value })} /></Field>
            <Field label="结束年"><Input placeholder="结束年" value={formState.yearTo} onChange={(e) => setFormState({ ...formState, yearTo: e.target.value })} /></Field>
            <Field label="主题分类">
              <Select value={formState.topic} onValueChange={(v) => setFormState({ ...formState, topic: v })}>
                <SelectTrigger><SelectValue placeholder="选择主题分类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote sensing">遥感技术</SelectItem>
                  <SelectItem value="vegetation index">植被指数</SelectItem>
                  <SelectItem value="climate change">气候变化</SelectItem>
                  <SelectItem value="land use">土地利用</SelectItem>
                  <SelectItem value="hydrology">水文学</SelectItem>
                  <SelectItem value="soil science">土壤科学</SelectItem>
                  <SelectItem value="oceanography">海洋学</SelectItem>
                  <SelectItem value="atmospheric science">大气科学</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className={styles.advancedActions}>
              <button onClick={handleSearch} disabled={isLoading}><Search size={14} />搜索</button>
              <button onClick={() => { setFormState({ author: '', yearFrom: '', yearTo: '', topic: '' }); setQuery(''); clearResults() }}><RefreshCw size={14} />重置</button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.resultsArea}>
        {isLoading && results.length === 0 ? (
          <div className={styles.loadingContainer}><Spinner  /><span>正在搜索论文...</span></div>
        ) : results.length === 0 && !isLoading ? (
          <div className={styles.emptyContainer}><span>{query ? '未找到相关论文，请尝试其他关键词' : '输入关键词开始搜索 OpenAlex 学术数据库'}</span></div>
        ) : (
          <>
            <div className={styles.resultsHeader}>
              <span>找到 <strong>{total}</strong> 篇论文</span>
              {results.length > 0 && <button onClick={() => exportCsv(results)}><Download size={14} />导出 CSV</button>}
            </div>
            {viewMode === 'table' ? (
              <div className={styles.paperTable}>
                <div className={styles.tableHead}><span>标题</span><span>作者</span><span>期刊</span><span>年份</span><span>引用</span><span>操作</span></div>
                {results.map((paper) => (
                  <div key={paper.id} className={`${styles.tableRow} ${selectedPaper?.id === paper.id ? styles.selectedRow : ''}`} onClick={() => handleRowClick(paper)}>
                    <strong>{paper.title}</strong>
                    <span>{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? '...' : ''}</span>
                    <em>{paper.journal}</em>
                    <b>{paper.year}</b>
                    <span className={styles.citationBadge}>{paper.citations}</span>
                    <div className={styles.rowActions}>
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(paper.id) }}><Star size={14} className={favoritedPapers.has(paper.id) ? styles.filledStar : ''} /></button>
                      <button onClick={(e) => { e.stopPropagation(); exportBibtex(paper) }}><Download size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.cardGrid}>{results.map((paper) => <PaperCard key={paper.id} paper={paper} isSelected={selectedPaper?.id === paper.id} onSelect={handleRowClick} onExportBibtex={exportBibtex} onIndexToKnowledge={indexToKnowledge} />)}</div>
            )}
            {total > pageSize && (
              <div className={styles.paginationContainer}>{Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1).slice(0, 10).map((p) => <button key={p} className={p === page ? styles.active : ''} onClick={() => handlePageChange(p)}>{p}</button>)}<span>共 {total} 篇</span></div>
            )}
          </>
        )}
      </section>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className={styles.paperDetailDialog}>
          <DialogHeader><DialogTitle>论文详情</DialogTitle></DialogHeader>
          {detailContent}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>
}

function InfoItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><dt>{label}</dt><dd className={strong ? styles.strongValue : ''}>{value}</dd></div>
}
