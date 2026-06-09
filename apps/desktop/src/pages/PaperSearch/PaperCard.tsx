/**
 * Paper Card Component
 *
 * Displays a single paper's key information with collapsible abstract
 * and action buttons for favorites, export, and knowledge indexing.
 */

import React, { useState } from 'react'
import { Card, Collapse, Tag, Button, Space, Tooltip, message, Popconfirm } from 'antd'
import {
  StarOutlined,
  StarFilled,
  ExportOutlined,
  DatabaseOutlined,
  LinkOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { PaperResult } from './store'
import styles from './PaperCard.module.scss'

const { Panel } = Collapse

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
      message.success('已成功索引到知识库')
    } catch {
      message.error('索引失败，请重试')
    } finally {
      setIndexing(false)
    }
  }

  const citationColor = paper.citations > 100 ? 'gold' : paper.citations > 10 ? 'blue' : 'default'

  return (
    <Card
      className={`${styles.paperCard} ${isSelected ? styles.selected : ''}`}
      size="small"
      hoverable
      onClick={() => onSelect(paper)}
      extra={
        <Space size="small">
          <Tooltip title={favorited ? '取消收藏' : '收藏'}>
            <Button
              type="text"
              size="small"
              icon={favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                setFavorited(!favorited)
              }}
            />
          </Tooltip>
          <Tooltip title="导出 BibTeX">
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onExportBibtex(paper)
              }}
            />
          </Tooltip>
          <Popconfirm
            title="索引到知识库"
            description="将此论文索引到本地知识库中"
            onConfirm={handleIndex}
            disabled={indexed || indexing}
            okText={indexed ? '已索引' : '确认'}
            cancelText="取消"
          >
            <Tooltip title={indexed ? '已索引' : '索引到知识库'}>
              <Button
                type="text"
                size="small"
                icon={<DatabaseOutlined />}
                loading={indexing}
                disabled={indexed}
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      }
    >
      <div className={styles.paperHeader}>
        <h4 className={styles.paperTitle}>{paper.title}</h4>
        <div className={styles.paperMeta}>
          <span className={styles.paperAuthors}>{paper.authors.join(', ')}</span>
          <span className={styles.paperJournal}>{paper.journal}</span>
          <span className={styles.paperYear}>{paper.year}</span>
          <Tag color={citationColor} className={styles.citationTag}>
            引用 {paper.citations}
          </Tag>
        </div>
      </div>

      <Collapse
        className={styles.paperCollapse}
        size="small"
        bordered={false}
        defaultActiveKey={[]}
        expandIconPosition="end"
      >
        <Panel header="摘要" key="abstract">
          <p className={styles.abstractText}>{paper.abstract}</p>
        </Panel>
        {paper.keywords.length > 0 && (
          <Panel header="关键词" key="keywords">
            <Space wrap>
              {paper.keywords.map((kw) => (
                <Tag key={kw} color="blue">
                  {kw}
                </Tag>
              ))}
            </Space>
          </Panel>
        )}
        {paper.doi && (
          <Panel header="链接" key="links">
            <Space>
              <Tooltip title="DOI 链接">
                <Button
                  type="link"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(`https://doi.org/${paper.doi}`, '_blank')
                  }}
                >
                  DOI: {paper.doi}
                </Button>
              </Tooltip>
              <Tooltip title="BibTeX 引用">
                <Button
                  type="link"
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onExportBibtex(paper)
                  }}
                >
                  导出 BibTeX
                </Button>
              </Tooltip>
            </Space>
          </Panel>
        )}
      </Collapse>
    </Card>
  )
}
