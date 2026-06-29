import { useState } from 'react'
import { toast } from 'sonner'
import { Star, Download, Database, Link, FileText } from 'lucide-react'
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

  return (
    <article className={`${styles.paperCard} ${isSelected ? styles.selected : ''}`} onClick={() => onSelect(paper)}>
      <header className={styles.paperHeader}>
        <h4>{paper.title}</h4>
        <div className={styles.iconActions}>
          <IconTip label={favorited ? '取消收藏' : '收藏'}>
            <button onClick={(e) => { e.stopPropagation(); setFavorited(!favorited) }}>
              <Star size={14} className={favorited ? styles.filledStar : ''} />
            </button>
          </IconTip>
          <IconTip label="导出 BibTeX">
            <button onClick={(e) => { e.stopPropagation(); onExportBibtex(paper) }}><Download size={14} /></button>
          </IconTip>
          <IconTip label={indexed ? '已索引' : '索引到知识库'}>
            <button disabled={indexed || indexing} onClick={(e) => { e.stopPropagation(); handleIndex() }}><Database size={14} /></button>
          </IconTip>
        </div>
      </header>

      <div className={styles.paperMeta}>
        <span>{paper.authors.join(', ')}</span>
        <em>{paper.journal}</em>
        <b>{paper.year}</b>
        <strong>引用 {paper.citations}</strong>
      </div>

      <details className={styles.paperCollapse}>
        <summary>摘要</summary>
        <p>{paper.abstract}</p>
      </details>

      {paper.keywords.length > 0 && (
        <details className={styles.paperCollapse}>
          <summary>关键词</summary>
          <div className={styles.keywordList}>{paper.keywords.map((kw) => <span key={kw}>{kw}</span>)}</div>
        </details>
      )}

      {paper.doi && (
        <div className={styles.linkRow}>
          <button onClick={(e) => { e.stopPropagation(); window.open(`https://doi.org/${paper.doi}`, '_blank') }}><Link size={13} /> DOI: {paper.doi}</button>
          <button onClick={(e) => { e.stopPropagation(); onExportBibtex(paper) }}><FileText size={13} /> 导出 BibTeX</button>
        </div>
      )}
    </article>
  )
}

function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
}
