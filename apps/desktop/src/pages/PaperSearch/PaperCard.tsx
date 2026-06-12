import React, { useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'
import { toast } from 'sonner'
import {
  Star,
  Download,
  Database,
  Link,
  FileText
} from 'lucide-react'
import { PaperResult } from './store'
import styles from './PaperCard.module.scss'

interface PaperCardProps {
  paper: PaperResult
  isSelected?: boolean
  onSelect: (paper: PaperResult) => void
  onExportBibtex: (paper: PaperResult) => void
  onIndexToKnowledge: (paper: PaperResult) => Promise<void>
}

export function PaperCard({ paper, isSelected, onSelect, onExportBibtex, onIndexToKnowledge }: PaperCardProps) {
  const [favorited, setFavorited] = useState(false)
  const [indexed, setIndexed] = useState(false)
  const [indexing, setIndexing] = useState(false)

  const handleIndex = async () => {
    if (indexed) return
    setIndexing(true)
    try {
      await onIndexToKnowledge(paper)
      setIndexed(true)
      toast.success('已成功索引到知识库')
    } catch {
      toast.error('索引失败，请重试')
    } finally {
      setIndexing(false)
    }
  }

  const citationColor = paper.citations > 100 ? 'bg-amber-100 text-amber-800' : paper.citations > 10 ? 'bg-blue-100 text-blue-800' : ''

  return (
    <Card
      className={`${styles.paperCard} ${isSelected ? styles.selected : ''}`}
      onClick={() => onSelect(paper)}
    >
      <CardContent>
        <div className="flex justify-between items-start mb-2">
          <h4 className={styles.paperTitle}>{paper.title}</h4>
          <div className="flex gap-1 ml-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); setFavorited(!favorited) }}
                >
                  <Star className={`w-4 h-4 ${favorited ? 'fill-amber-400 text-amber-400' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{favorited ? '取消收藏' : '收藏'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onExportBibtex(paper) }}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>导出 BibTeX</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={indexed || indexing}
                  onClick={(e) => { e.stopPropagation(); handleIndex() }}
                >
                  <Database className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{indexed ? '已索引' : '索引到知识库'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className={styles.paperMeta}>
          <span className={styles.paperAuthors}>{paper.authors.join(', ')}</span>
          <span className={styles.paperJournal}>{paper.journal}</span>
          <span className={styles.paperYear}>{paper.year}</span>
          <Badge variant="secondary" className={citationColor}>
            引用 {paper.citations}
          </Badge>
        </div>

        <details className={styles.paperCollapse}>
          <summary className="cursor-pointer text-sm text-muted-foreground mt-2">摘要</summary>
          <p className={styles.abstractText}>{paper.abstract}</p>
        </details>

        {paper.keywords.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-sm text-muted-foreground">关键词</summary>
            <div className="flex flex-wrap gap-1 mt-2">
              {paper.keywords.map((kw) => (
                <Badge key={kw} variant="secondary">{kw}</Badge>
              ))}
            </div>
          </details>
        )}

        {paper.doi && (
          <details className="mt-1">
            <summary className="cursor-pointer text-sm text-muted-foreground">链接</summary>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="link" onClick={(e) => { e.stopPropagation(); window.open(`https://doi.org/${paper.doi}`, '_blank') }}>
                <Link className="w-3 h-3 mr-1" /> DOI: {paper.doi}
              </Button>
              <Button size="sm" variant="link" onClick={(e) => { e.stopPropagation(); onExportBibtex(paper) }}>
                <FileText className="w-3 h-3 mr-1" /> 导出 BibTeX
              </Button>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
