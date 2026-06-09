import { useCallback, useMemo, useState } from 'react'
import { Button, Descriptions, Empty, Input, message, Modal, Space, Tag, Typography } from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useKnowledgeBaseStore } from './store'
import styles from './KnowledgeDetail.module.scss'

const { Title, Paragraph, Text } = Typography

interface KnowledgeDetailProps {
  visible: boolean
  onClose: () => void
}

export function KnowledgeDetail({ visible, onClose }: KnowledgeDetailProps) {
  const { selectedEntry, deleteEntry, loadEntryDetail, isLoading } = useKnowledgeBaseStore()
  const [searchText, setSearchText] = useState('')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  const handleDelete = useCallback(() => {
    if (!selectedEntry) return
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${selectedEntry.title}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteEntry(selectedEntry.id)
          message.success('已删除')
          onClose()
        } catch {
          message.error('删除失败')
        }
      },
    })
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
    message.success('导出成功')
  }, [selectedEntry])

  const handleEdit = useCallback(() => {
    if (!selectedEntry) return
    setEditContent(selectedEntry.content)
    setEditing(true)
  }, [selectedEntry])

  const handleSaveEdit = useCallback(() => {
    // TODO: Implement save edit via API
    setEditing(false)
    message.success('保存成功')
  }, [])

  const handleCiteInPaper = useCallback(() => {
    if (!selectedEntry) return
    message.info(`已在论文中引用: ${selectedEntry.title}`)
  }, [selectedEntry])

  const sourceTagColor = useMemo(() => {
    if (!selectedEntry) return 'default'
    switch (selectedEntry.source) {
      case 'paper_id': return 'blue'
      case 'pdf': return 'green'
      case 'manual': return 'orange'
      default: return 'default'
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

  // Highlight matching text in content
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
        <Title level={4} className={styles.detailTitle}>
          {selectedEntry.title}
        </Title>
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={handleEdit}>编辑</Button>
          <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>导出</Button>
          <Button icon={<FileTextOutlined />} size="small" onClick={handleCiteInPaper}>在论文中引用</Button>
          <Button danger icon={<DeleteOutlined />} size="small" onClick={handleDelete}>删除</Button>
        </Space>
      </div>

      <div className={styles.detailMeta}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="来源">
            <Tag color={sourceTagColor}>{sourceLabel}</Tag>
            <Text type="secondary" style={{ marginLeft: 8 }}>{selectedEntry.source}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="分类">
            {selectedEntry.category || '未分类'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(selectedEntry.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {new Date(selectedEntry.updatedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="标签" span={2}>
            <Space wrap>
              {selectedEntry.tags?.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
              {(!selectedEntry.tags || selectedEntry.tags.length === 0) && (
                <Text type="secondary">暂无标签</Text>
              )}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div className={styles.detailSearch}>
        <Input
          placeholder="在内容中搜索..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      <div className={styles.detailContent}>
        {isLoading ? (
          <Text>加载中...</Text>
        ) : (
          <Paragraph className={styles.contentText}>
            {highlightedContent}
          </Paragraph>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        title="编辑知识条目"
        open={editing}
        onOk={handleSaveEdit}
        onCancel={() => setEditing(false)}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Input.TextArea
          rows={16}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
        />
      </Modal>
    </div>
  )
}
