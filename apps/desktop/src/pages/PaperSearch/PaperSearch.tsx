import React, { useCallback, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Spinner } from '../../components/ui/spinner'
import { toast } from 'sonner'
import {
  Search,
  Filter,
  Download,
  FileText,
  Database,
  Star,
  Link,
  RefreshCw,
  X
} from 'lucide-react'
import { usePaperSearchStore, PaperResult } from './store'
import { PaperCard } from './PaperCard'
import { validateSearchParams } from '../../services/paperService'
import styles from './PaperSearch.module.scss'

export function PaperSearch() {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [showDetail, setShowDetail] = useState(false)
  const [favoritedPapers, setFavoritedPapers] = useState<Set<string>>(new Set())
  const [formState, setFormState] = useState({ author: '', yearFrom: '', yearTo: '', topic: '' })

  const {
    query,
    results,
    isLoading,
    total,
    page,
    pageSize,
    selectedPaper,
    isAdvancedOpen,
    setQuery,
    search,
    selectPaper,
    toggleAdvanced,
    exportBibtex,
    exportCsv,
    indexToKnowledge,
    clearResults
  } = usePaperSearchStore()

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
          <h5 className="font-semibold m-0 flex-1">{paper.title}</h5>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleFavorite(paper.id)}
            >
              <Star className={`w-4 h-4 mr-1 ${favoritedPapers.has(paper.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
              {favoritedPapers.has(paper.id) ? '已收藏' : '收藏'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportBibtex(paper)}>
              <Download className="w-4 h-4 mr-1" /> 导出 BibTeX
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={async () => {
                try {
                  await indexToKnowledge(paper)
                  toast.success('已成功索引到知识库')
                } catch {
                  toast.error('索引失败')
                }
              }}
            >
              <Database className="w-4 h-4 mr-1" /> 索引到知识库
            </Button>
            {paper.doi && (
              <Button size="sm" variant="outline" onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')}>
                <Link className="w-4 h-4 mr-1" /> DOI
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowDetail(false)}>
              <X className="w-4 h-4 mr-1" /> 关闭
            </Button>
          </div>
        </div>

        <div className={styles.detailMeta}>
          <div className="flex gap-6">
            <div>
              <span className="text-muted-foreground">作者：</span>
              <span>{paper.authors.join(', ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">期刊：</span>
              <span className="italic">{paper.journal}</span>
            </div>
            <div>
              <span className="text-muted-foreground">年份：</span>
              <span className="font-semibold">{paper.year}</span>
            </div>
            <div>
              <span className="text-muted-foreground">引用：</span>
              <Badge variant="secondary" className={paper.citations > 100 ? 'bg-amber-100 text-amber-800' : paper.citations > 10 ? 'bg-blue-100 text-blue-800' : ''}>
                {paper.citations}
              </Badge>
            </div>
          </div>
        </div>

        {paper.keywords.length > 0 && (
          <div className={styles.detailKeywords}>
            <span className="text-muted-foreground">关键词：</span>
            <div className="flex flex-wrap gap-1">
              {paper.keywords.map((kw) => (
                <Badge key={kw} variant="secondary">{kw}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className={styles.detailAbstract}>
          <span className="font-semibold">摘要：</span>
          <p>{paper.abstract}</p>
        </div>

        <div className={styles.detailBibtex}>
          <span className="font-semibold">BibTeX：</span>
          <pre className={styles.bibtexCode}>{paper.bibtex}</pre>
        </div>
      </div>
    )
  }, [selectedPaper, favoritedPapers, isLoading, exportBibtex, indexToKnowledge, toggleFavorite])

  return (
    <div className={styles.paperSearchLayout}>
      {/* Search Bar */}
      <div className={styles.searchBar}>
        <Card>
          <CardContent className="p-3">
            <div className="flex gap-2">
              <Input
                placeholder="搜索论文关键词（如：NDVI remote sensing）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="w-4 h-4 mr-1" /> 搜索
              </Button>
              <Button
                variant="outline"
                onClick={toggleAdvanced}
                className={isAdvancedOpen ? styles.advancedActive : ''}
              >
                <Filter className="w-4 h-4 mr-1" /> 高级
              </Button>
            </div>

            {/* Advanced Search Panel */}
            {isAdvancedOpen && (
              <div className={styles.advancedPanel}>
                <div className={styles.advancedRow}>
                  <div className={styles.advancedField}>
                    <label className="text-sm font-medium">作者</label>
                    <Input placeholder="作者姓名" value={formState.author} onChange={(e) => setFormState({ ...formState, author: e.target.value })} />
                  </div>
                  <div className={styles.advancedField}>
                    <label className="text-sm font-medium">年份范围</label>
                    <div className="flex gap-2">
                      <Input placeholder="起始年" value={formState.yearFrom} onChange={(e) => setFormState({ ...formState, yearFrom: e.target.value })} />
                      <Input placeholder="结束年" value={formState.yearTo} onChange={(e) => setFormState({ ...formState, yearTo: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className={styles.advancedRow}>
                  <div className={styles.advancedField}>
                    <label className="text-sm font-medium">主题分类</label>
                    <Select value={formState.topic} onValueChange={(v) => setFormState({ ...formState, topic: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择主题分类" />
                      </SelectTrigger>
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
                  </div>
                  <div className={styles.advancedField}>
                    <div className="flex gap-2 mt-6">
                      <Button onClick={handleSearch} disabled={isLoading}>
                        <Search className="w-4 h-4 mr-1" /> 搜索
                      </Button>
                      <Button variant="outline" onClick={() => { setFormState({ author: '', yearFrom: '', yearTo: '', topic: '' }); setQuery(''); clearResults() }}>
                        <RefreshCw className="w-4 h-4 mr-1" /> 重置
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Area */}
      <div className={styles.resultsArea}>
        {isLoading && results.length === 0 ? (
          <div className={styles.loadingContainer}>
            <Spinner className="w-8 h-8" />
            <span className="mt-2 text-sm text-muted-foreground">正在搜索论文...</span>
          </div>
        ) : results.length === 0 && !isLoading ? (
          <div className={styles.emptyContainer}>
            <span className="text-muted-foreground">
              {query ? '未找到相关论文，请尝试其他关键词' : '输入关键词开始搜索 OpenAlex 学术数据库'}
            </span>
          </div>
        ) : (
          <>
            {/* Results Header */}
            <div className={styles.resultsHeader}>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  找到 <span className="font-semibold text-foreground">{total}</span> 篇论文
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant={viewMode === 'table' ? 'secondary' : 'outline'} onClick={() => setViewMode('table')}>表格</Button>
                  <Button size="sm" variant={viewMode === 'card' ? 'secondary' : 'outline'} onClick={() => setViewMode('card')}>卡片</Button>
                </div>
                {results.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => exportCsv(results)}>
                    <Download className="w-4 h-4 mr-1" /> 导出 CSV
                  </Button>
                )}
              </div>
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">标题</th>
                    <th className="text-left p-3 w-[20%]">作者</th>
                    <th className="text-left p-3 w-[15%]">期刊</th>
                    <th className="text-center p-3 w-[70px]">年份</th>
                    <th className="text-center p-3 w-[80px]">引用</th>
                    <th className="text-left p-3 w-[120px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((paper) => (
                    <tr
                      key={paper.id}
                      className={`border-b cursor-pointer hover:bg-muted/50 ${selectedPaper?.id === paper.id ? styles.selectedRow : ''}`}
                      onClick={() => handleRowClick(paper)}
                    >
                      <td className="p-3 font-medium truncate max-w-[40%]">{paper.title}</td>
                      <td className="p-3 text-muted-foreground truncate">{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? '...' : ''}</td>
                      <td className="p-3 text-muted-foreground italic truncate">{paper.journal}</td>
                      <td className="p-3 text-center font-semibold">{paper.year}</td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary" className={paper.citations > 100 ? 'bg-amber-100 text-amber-800' : paper.citations > 10 ? 'bg-blue-100 text-blue-800' : ''}>
                          {paper.citations}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleFavorite(paper.id) }}>
                            <Star className={`w-4 h-4 ${favoritedPapers.has(paper.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); exportBibtex(paper) }}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
              <div className={styles.cardGrid}>
                {results.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    isSelected={selectedPaper?.id === paper.id}
                    onSelect={handleRowClick}
                    onExportBibtex={exportBibtex}
                    onIndexToKnowledge={indexToKnowledge}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div className={styles.paginationContainer}>
                <div className="flex gap-1">
                  {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1).slice(0, 10).map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === page ? 'secondary' : 'outline'}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <span className="flex items-center text-sm text-muted-foreground ml-2">共 {total} 篇</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-[720px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>论文详情</DialogTitle>
          </DialogHeader>
          {detailContent}
        </DialogContent>
      </Dialog>
    </div>
  )
}
