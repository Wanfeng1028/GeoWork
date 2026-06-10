import { useState, useCallback, useEffect } from 'react'
import { Layout, Card, Row, Col, Button, Input, Table, Tag, Space, Typography, Modal, Form, Select, message, Popconfirm } from 'antd'
import {
  PlusOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  ExportOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDataCenterStore } from './store'
import { DataPreview } from './DataPreview'
import type { Dataset } from '../../services/dataService'
import styles from './DataCenter.module.scss'

const { Content } = Layout
const { Title, Text } = Typography

// ─── Main Page ──────────────────────────────────────────────────────

export default function DataCenter() {
  const [search, setSearch] = useState('')
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { datasets, selectedDataset, isLoading, setSelectedDataset, refreshDatasets, registerDataset, removeDataset, exportMetadata } = useDataCenterStore()

  useEffect(() => {
    refreshDatasets()
  }, [refreshDatasets])

  const handleRegister = useCallback(async () => {
    const values = await form.validateFields()
    try {
      await registerDataset({
        name: values.name,
        type: values.type,
        path: values.path,
        crs: values.crs || 'EPSG:4326',
        extent: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        size: values.size || 0,
        metadata: {}
      })
      setRegisterModalOpen(false)
      form.resetFields()
      message.success('数据集已登记')
    } catch {
      // error already handled in store
    }
  }, [form, registerDataset])

  const handleRemove = useCallback(async (id: string) => {
    try {
      await removeDataset(id)
      message.success('数据集已移除')
    } catch {
      // error already handled in store
    }
  }, [removeDataset])

  const handleExport = useCallback(async (id: string) => {
    try {
      await exportMetadata(id)
      message.success('元数据已导出')
    } catch {
      // error already handled in store
    }
  }, [exportMetadata])

  const filtered = datasets.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.path.toLowerCase().includes(search.toLowerCase())
  )

  const columns: ColumnsType<Dataset> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Dataset) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1677ff' }} />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const colors: Record<string, string> = {
          GeoTIFF: 'blue', Shapefile: 'green', GeoPackage: 'purple',
          CSV: 'orange', GeoJSON: 'cyan', NetCDF: 'magenta'
        }
        return <Tag color={colors[type] || 'default'}>{type}</Tag>
      }
    },
    {
      title: 'CRS',
      dataIndex: 'crs',
      key: 'crs',
      width: 120
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => {
        if (size === 0) return 'N/A'
        const units = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(size) / Math.log(1024))
        return `${(size / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'registered' ? 'green' : status === 'processing' ? 'orange' : 'red'}>
          {status === 'registered' ? '已登记' : status === 'processing' ? '处理中' : '错误'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record: Dataset) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedDataset(record)}>
            预览
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => handleExport(record.id)}>
            导出
          </Button>
          <Popconfirm title="确认移除此数据集？" onConfirm={() => handleRemove(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Layout className={styles.dataCenter}>
      <Content className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <Title level={3} style={{ margin: 0 }}>数据中心</Title>
            <Text type="secondary">管理和预览项目数据集</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refreshDatasets} loading={isLoading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
              登记数据集
            </Button>
          </Space>
        </div>

        {/* Search */}
        <Input
          placeholder="搜索数据集名称或路径..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          size="large"
          className={styles.searchInput}
        />

        {/* Dataset Table */}
        <Card size="small" className={styles.tableCard}>
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 800 }}
          />
        </Card>

        {/* Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card className={styles.statCard}>
              <div className={styles.statValue}>{datasets.length}</div>
              <div className={styles.statLabel}>数据集总数</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className={styles.statCard}>
              <div className={styles.statValue}>{datasets.filter((d) => d.type === 'GeoTIFF').length}</div>
              <div className={styles.statLabel}>栅格数据</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className={styles.statCard}>
              <div className={styles.statValue}>{datasets.filter((d) => ['Shapefile', 'GeoPackage', 'GeoJSON'].includes(d.type)).length}</div>
              <div className={styles.statLabel}>矢量数据</div>
            </Card>
          </Col>
        </Row>
      </Content>

      {/* Register Dataset Modal */}
      <Modal
        title="登记新数据集"
        open={registerModalOpen}
        onCancel={() => setRegisterModalOpen(false)}
        onOk={handleRegister}
        okText="登记"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入数据集名称' }]}>
            <Input placeholder="例如: Sentinel-2 NDVI 2024" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择数据类型' }]}>
            <Select placeholder="选择数据类型">
              <Select.Option value="GeoTIFF">GeoTIFF</Select.Option>
              <Select.Option value="Shapefile">Shapefile</Select.Option>
              <Select.Option value="GeoPackage">GeoPackage</Select.Option>
              <Select.Option value="CSV">CSV</Select.Option>
              <Select.Option value="GeoJSON">GeoJSON</Select.Option>
              <Select.Option value="NetCDF">NetCDF</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="path" label="路径" rules={[{ required: true, message: '请输入文件路径' }]}>
            <Input placeholder="C:\data\sensor\image.tif" />
          </Form.Item>
          <Form.Item name="crs" label="CRS">
            <Input placeholder="EPSG:4326" />
          </Form.Item>
          <Form.Item name="size" label="文件大小 (bytes)">
            <Input type="number" placeholder="1048576" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Data Preview Drawer */}
      <DataPreview dataset={selectedDataset} open={!!selectedDataset} onClose={() => setSelectedDataset(null)} />
    </Layout>
  )
}
