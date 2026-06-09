/**
 * Paper Search Panel
 *
 * Main paper search interface with keyword search, advanced filters,
 * results table, detail view, and export functionality.
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  Layout,
  Card,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Select,
  DatePicker,
  Pagination,
  Typography,
  Collapse,
  Spin,
  message,
} from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  StarOutlined,
  StarFilled,
  LinkOutlined,
  ReloadOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { usePaperSearchStore, PaperResult } from './store'
import { PaperCard } from './PaperCard'
import { validateSearchParams } from '../../services/paperService'
import styles from './PaperSearch.module.scss'

const { RangePicker } = DatePicker
const { Text, Title, Paragraph } = Typography
const { Panel } = Collapse

export function PaperSearch() {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [form] = Form.useForm()
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

  const [showDetail, setShowDetail] = useState(false)
  const [favoritedPapers, setFavoritedPapers] = useState<Set<string>>(new Set())

  // Handle search on form submit
  const handleSearch = useCallback(async () => {
    const validationError = validateSearchParams({ query })
    if (validationError) {
      message.warning(validationError)
      return
    }

    const values = form.getFieldsValue()
    const yearRange = values.yearRange as [Date, Date] | undefined

    await search({
      query,
      author: values.author || undefined,
      yearFrom: yearRange ? yearRange[0].getFullYear() : undefined,
      yearTo: yearRange ? yearRange[1].getFullYear() : undefined,
      topic: values.topic || undefined,
      page: 1,
      pageSize,
    })
  }, [query, form, search, pageSize])

  // Handle page change
  const handlePageChange = useCallback((p: number) => {
    const yearRange = form.getFieldValue('yearRange') as [Date, Date] | undefined
    search({
      query,
      author: form.getFieldValue('author') || undefined,
      yearFrom: yearRange ? yearRange[0].getFullYear() : undefined,
      yearTo: yearRange ? yearRange[1].getFullYear() : undefined,
      topic: form.getFieldValue('topic') || undefined,
      page: p,
      pageSize,
    })
  }, [query, form, search, pageSize])

  // Handle row click to show detail
  const handleRowClick = useCallback((paper: PaperResult) => {
    selectPaper(paper)
    setShowDetail(true)
  }, [selectPaper])

  // Toggle favorite
  const toggleFavorite = useCallback((paperId: string) => {
    setFavoritedPapers((prev) => {
      const next = new Set(prev)
      if (next.has(paperId)) {
        next.delete(paperId)
      } else {
        next.add(paperId)
      }
      return next
    })
  }, [])

  // Table columns
  const tableColumns = useMemo(() => [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '40%',
      ellipsis: true,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '作者',
      dataIndex: 'authors',
      key: 'authors',
      width: '20%',
      render: (authors: string[]) => (
        <Text type="secondary" ellipsis title={authors.join(', ')}>
          {authors.slice(0, 3).join(', ')}{authors.length > 3 ? '...' : ''}
        </Text>
      ),
    },
    {
      title: '期刊',
      dataIndex: 'journal',
      key: 'journal',
      width: '15%',
      ellipsis: true,
      render: (text: string) => <Text italic type="secondary">{text}</Text>,
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 70,
      align: 'center' as const,
      render: (year: number) => <Text strong>{year}</Text>,
    },
    {
      title: '引用',
      dataIndex: 'citations',
      key: 'citations',
      width: 80,
      align: 'center' as const,
      sorter: (a: PaperResult, b: PaperResult) => a.citations - b.citations,
      render: (citations: number) => (
        <Tag color={citations > 100 ? 'gold' : citations > 10 ? 'blue' : 'default'}>
          {citations}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: PaperResult) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={favoritedPapers.has(record.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(record.id)
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<ExportOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              exportBibtex(record)
            }}
          />
        </Space>
      ),
    },
  ], [favoritedPapers, exportBibtex, toggleFavorite])

  // Detail panel content
  const detailContent = useMemo(() => {
    if (!selectedPaper) return null
    const paper = selectedPaper

    return (
      <div className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <Title level={5} style={{ margin: 0, flex: 1 }}>{paper.title}</Title>
          <Space>
            <Button
              size="small"
              icon={favoritedPapers.has(paper.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => toggleFavorite(paper.id)}
            >
              {favoritedPapers.has(paper.id) ? '已收藏' : '收藏'}
            </Button>
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={() => exportBibtex(paper)}
            >
              导出 BibTeX
            </Button>
            <Button
              size="small"
              icon={<DatabaseOutlined />}
              loading={isLoading}
              onClick={async () => {
                try {
                  await indexToKnowledge(paper)
                  message.success('已成功索引到知识库')
                } catch {
                  message.error('索引失败')
                }
              }}
            >
              索引到知识库
            </Button>
            {paper.doi && (
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')}
              >
                DOI
              </Button>
            )}
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setShowDetail(false)}
            >
              关闭
            </Button>
          </Space>
        </div>

        <div className={styles.detailMeta}>
          <Space size="large">
            <div>
              <Text type="secondary">作者：</Text>
              <Text>{paper.authors.join(', ')}</Text>
            </div>
            <div>
              <Text type="secondary">期刊：</Text>
              <Text italic>{paper.journal}</Text>
            </div>
            <div>
              <Text type="secondary">年份：</Text>
              <Text strong>{paper.year}</Text>
            </div>
            <div>
              <Text type="secondary">引用：</Text>
              <Tag color={paper.citations > 100 ? 'gold' : paper.citations > 10 ? 'blue' : 'default'}>
                {paper.citations}
              </Tag>
            </div>
          </Space>
        </div>

        {paper.keywords.length > 0 && (
          <div className={styles.detailKeywords}>
            <Text type="secondary">关键词：</Text>
            <Space wrap>
              {paper.keywords.map((kw) => (
                <Tag key={kw} color="blue">{kw}</Tag>
              ))}
            </Space>
          </div>
        )}

        <div className={styles.detailAbstract}>
          <Text strong>摘要：</Text>
          <Paragraph>{paper.abstract}</Paragraph>
        </div>

        <div className={styles.detailBibtex}>
          <Text strong>BibTeX：</Text>
          <pre className={styles.bibtexCode}>{paper.bibtex}</pre>
        </div>
      </div>
    )
  }, [selectedPaper, favoritedPapers, isLoading, exportBibtex, indexToKnowledge, toggleFavorite])

  return (
    <Layout className={styles.paperSearchLayout}>
      {/* Search Bar */}
      <div className={styles.searchBar}>
        <Card size="small" className={styles.searchCard}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="搜索论文关键词（如：NDVI remote sensing）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              size="large"
              prefix={<SearchOutlined />}
            />
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={isLoading}
            >
              搜索
            </Button>
            <Button
              size="large"
              icon={<FilterOutlined />}
              onClick={toggleAdvanced}
              className={isAdvancedOpen ? styles.advancedActive : ''}
            >
              高级
            </Button>
          </Space.Compact>

          {/* Advanced Search Panel */}
          {isAdvancedOpen && (
            <div className={styles.advancedPanel}>
              <Form form={form} layout="vertical" className={styles.advancedForm}>
                <div className={styles.advancedRow}>
                  <Form.Item label="作者" name="author" className={styles.advancedField}>
                    <Input placeholder="作者姓名" allowClear />
                  </Form.Item>
                  <Form.Item label="年份范围" name="yearRange" className={styles.advancedField}>
                    <RangePicker
                      picker="year"
                      format="YYYY"
                      allowClear
                      placeholder={['起始年', '结束年']}
                    />
                  </Form.Item>
                </div>
                <div className={styles.advancedRow}>
                  <Form.Item label="主题分类" name="topic" className={styles.advancedField}>
                    <Select
                      placeholder="选择主题分类"
                      allowClear
                      options={[
                        { label: '遥感技术', value: 'remote sensing' },
                        { label: '植被指数', value: 'vegetation index' },
                        { label: '气候变化', value: 'climate change' },
                        { label: '土地利用', value: 'land use' },
                        { label: '水文学', value: 'hydrology' },
                        { label: '土壤科学', value: 'soil science' },
                        { label: '海洋学', value: 'oceanography' },
                        { label: '大气科学', value: 'atmospheric science' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item className={styles.advancedField}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={handleSearch}
                        loading={isLoading}
                      >
                        搜索
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                          form.resetFields()
                          setQuery('')
                          clearResults()
                        }}
                      >
                        重置
                      </Button>
                    </Space>
                  </Form.Item>
                </div>
              </Form>
            </div>
          )}
        </Card>
      </div>

      {/* Results Area */}
      <div className={styles.resultsArea}>
        {isLoading && results.length === 0 ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" tip="正在搜索论文..." />
          </div>
        ) : results.length === 0 && !isLoading ? (
          <div className={styles.emptyContainer}>
            <Typography.Text type="secondary">
              {query ? '未找到相关论文，请尝试其他关键词' : '输入关键词开始搜索 OpenAlex 学术数据库'}
            </Typography.Text>
          </div>
        ) : (
          <>
            {/* Results Header */}
            <div className={styles.resultsHeader}>
              <Space>
                <Text type="secondary">
                  找到 <Text strong>{total}</Text> 篇论文
                </Text>
                <Space size="small">
                  <Button
                    size="small"
                    type={viewMode === 'table' ? 'primary' : 'default'}
                    onClick={() => setViewMode('table')}
                  >
                    表格
                  </Button>
                  <Button
                    size="small"
                    type={viewMode === 'card' ? 'primary' : 'default'}
                    onClick={() => setViewMode('card')}
                  >
                    卡片
                  </Button>
                </Space>
                {results.length > 0 && (
                  <Button
                    size="small"
                    icon={<ExportOutlined />}
                    onClick={() => exportCsv(results)}
                  >
                    导出 CSV
                  </Button>
                )}
              </Space>
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <Table
                rowKey="id"
                dataSource={results}
                columns={tableColumns}
                pagination={false}
                rowClassName={(record) => selectedPaper?.id === record.id ? styles.selectedRow : ''}
                onRow={(record) => ({
                  className: styles.clickableRow,
                  onClick: () => handleRowClick(record),
                })}
                scroll={{ y: 400 }}
                size="small"
              />
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
                <Pagination
                  current={page}
                  total={total}
                  pageSize={pageSize}
                  onChange={handlePageChange}
                  showSizeChanger
                  showTotal={(t) => `共 ${t} 篇`}
                  size="small"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        title="论文详情"
        open={showDetail}
        onCancel={() => setShowDetail(false)}
        footer={null}
        width={720}
        className={styles.detailModal}
      >
        {detailContent}
      </Modal>
    </Layout>
  )
}
