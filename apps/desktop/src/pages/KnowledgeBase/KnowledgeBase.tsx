import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Breadcrumb,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tree,
  Upload,
} from 'antd'
import {
  FolderAddOutlined,
  FolderOutlined,
  FileOutlined,
  FilePdfOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import { useKnowledgeBaseStore, type KnowledgeCategory, type KnowledgeEntry } from './store'
import { KnowledgeDetail } from './KnowledgeDetail'
import styles from './KnowledgeBase.module.scss'

const { Dragger } = Upload

export function KnowledgeBase() {
  const {
    categories,
    entries,
    selectedCategory,
    selectedEntry,
    searchQuery,
    isLoading,
    error,
    setCategories,
    setEntries,
    setSelectedCategory,
    setSelectedEntry,
    setSearchQuery,
    createCategory,
    addEntry,
    indexFromPaper,
    importFromFile,
    deleteEntry,
    search,
    loadCategories,
    loadEntries,
    refresh,
  } = useKnowledgeBaseStore()

  const [detailVisible, setDetailVisible] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [paperIndexModalOpen, setPaperIndexModalOpen] = useState(false)
  const [paperIndexForm] = Form.useForm()

  // Load data on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  // Load entries when category changes
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
      const values = await createForm.validateFields()
      await createCategory(values.name, values.parentId || undefined)
      createForm.reset()
      setCreateModalOpen(false)
      message.success('分类创建成功')
    } catch {
      message.error('分类创建失败')
    }
  }, [createForm, createCategory])

  const handleImportFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      await importFromFile(file)
      message.success('文件导入成功')
    } catch {
      message.error('文件导入失败')
    } finally {
      setUploading(false)
    }
    return false // prevent default upload
  }, [importFromFile])

  const handleIndexFromPaper = useCallback(async () => {
    try {
      const values = await paperIndexForm.validateFields()
      await indexFromPaper(values.paperId, values.title, values.content, values.tags?.split(',').map((t: string) => t.trim()) || [])
      paperIndexForm.reset()
      setPaperIndexModalOpen(false)
      message.success('论文索引成功')
    } catch {
      message.error('论文索引失败')
    }
  }, [paperIndexForm, indexFromPaper])

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      await deleteEntry(id)
      message.success('已删除')
    } catch {
      message.error('删除失败')
    }
  }, [deleteEntry])

  // Build tree data from categories
  const treeData = useMemo(() => {
    const buildTree = (cats: KnowledgeCategory[]): any[] => {
      return cats.map((cat) => ({
        title: (
          <div
            className={`${styles.treeNode} ${selectedCategory === cat.id ? styles.selected : ''}`}
            onClick={() => handleSelectCategory(cat.id)}
          >
            <FolderOutlined className={styles.treeIcon} />
            <span className={styles.treeLabel}>{cat.name}</span>
          </div>
        ),
        key: cat.id,
        children: buildTree(cat.children || []),
      }))
    }
    return buildTree(categories)
  }, [categories, selectedCategory, handleSelectCategory])

  // Table columns
  const columns = useMemo(() => [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '40%',
      render: (text: string) => <span className={styles.entryTitle}>{text}</span>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: string) => {
        const colors: Record<string, string> = {
          paper_id: 'blue',
          pdf: 'green',
          manual: 'orange',
        }
        const labels: Record<string, string> = {
          paper_id: '论文',
          pdf: 'PDF',
          manual: '手动',
        }
        return <Tag color={colors[source] || 'default'}>{labels[source] || source}</Tag>
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: string[]) => (
        <Space wrap>
          {(tags || []).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: KnowledgeEntry) => (
        <Button
          danger
          size="small"
          type="text"
          onClick={() => handleDeleteEntry(record.id)}
        >
          删除
        </Button>
      ),
    },
  ], [handleDeleteEntry])

  // Filter entries by search query
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

  const breadcrumbItems = useMemo(() => {
    const items: { title: string }[] = [{ title: '知识库' }]
    if (selectedCategory) {
      const cat = findCategory(categories, selectedCategory)
      if (cat) {
        items.push({ title: cat.name })
      }
    }
    return items
  }, [categories, selectedCategory])

  if (error) {
    return (
      <div className={styles.emptyState}>
        <Empty description={`加载失败: ${error}`} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar: category tree */}
      <div className={styles.sidebar} style={{ width: 260, flexShrink: 0 }}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>知识分类</h3>
          <Space>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              title="新建分类"
            />
            <Button
              size="small"
              icon={<ImportOutlined />}
              onClick={() => setPaperIndexModalOpen(true)}
              title="从论文索引"
            />
          </Space>
        </div>
        <div className={styles.sidebarContent}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Spin size="small" />
            </div>
          ) : (
            <Tree
              treeData={treeData}
              selectedKeys={selectedCategory ? [selectedCategory] : []}
              showIcon={false}
              defaultExpandAll
            />
          )}
          {/* "All entries" option */}
          <div
            className={`${styles.treeNode} ${!selectedCategory ? styles.selected : ''}`}
            onClick={() => handleSelectCategory(null)}
          >
            <FileOutlined className={styles.treeIcon} />
            <span className={styles.treeLabel}>全部条目</span>
          </div>
        </div>
      </div>

      {/* Right content: entry list + detail drawer */}
      <div className={styles.mainContent} style={{ flex: 1 }}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <Breadcrumb items={breadcrumbItems} />
          <Space style={{ flex: 1, minWidth: 0 }}>
            <Input
              className={styles.toolbarSearch}
              placeholder="搜索知识条目..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              onSearch={(val) => search(val)}
            />
            <Upload
              accept=".pdf,.txt,.md,.csv,.json"
              showUploadList={false}
              beforeUpload={(file) => handleImportFile(file)}
              disabled={uploading}
            >
              <Button
                icon={<UploadOutlined />}
                loading={uploading}
              >
                导入文件
              </Button>
            </Upload>
          </Space>
        </div>

        {/* Entry list */}
        <div className={styles.entryList}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <Empty
              description="暂无知识条目"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              rowKey="id"
              dataSource={filteredEntries}
              columns={columns}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              size="small"
              onRow={(record) => ({
                onClick: () => handleSelectEntry(record),
                style: { cursor: 'pointer' },
              })}
            />
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <Drawer
        title="知识详情"
        placement="right"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        destroyOnClose
      >
        <KnowledgeDetail
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
        />
      </Drawer>

      {/* Create category modal */}
      <Modal
        title="新建知识分类"
        open={createModalOpen}
        onOk={handleCreateCategory}
        onCancel={() => { setCreateModalOpen(false); createForm.reset() }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="例如：遥感算法、NDVI 研究" />
          </Form.Item>
          <Form.Item name="parentId" label="父分类">
            <Input placeholder="留空表示顶级分类" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Index from paper modal */}
      <Modal
        title="从论文索引到知识库"
        open={paperIndexModalOpen}
        onOk={handleIndexFromPaper}
        onCancel={() => { setPaperIndexModalOpen(false); paperIndexForm.reset() }}
        okText="索引"
        cancelText="取消"
        width={600}
      >
        <Form form={paperIndexForm} layout="vertical">
          <Form.Item
            name="paperId"
            label="论文 ID"
            rules={[{ required: true, message: '请输入论文 ID' }]}
          >
            <Input placeholder="例如：paper_ndvi_review" />
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="知识条目标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={6} placeholder="知识条目的正文内容" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="多个标签用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>
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
