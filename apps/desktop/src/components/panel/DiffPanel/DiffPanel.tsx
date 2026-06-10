// GeoWork DiffPanel

import { Table, Button, Space, Tag } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import styles from './DiffPanel.module.scss'

const mockDiffs = [
  {
    key: '1',
    file: 'ndvi_analysis.py',
    path: '/workspace/scripts/ndvi_analysis.py',
    status: 'pending',
    changes: '+15 -3'
  },
  {
    key: '2',
    file: 'ndvi_report.md',
    path: '/workspace/docs/ndvi_report.md',
    status: 'accepted',
    changes: '+42 -0'
  },
  {
    key: '3',
    file: 'config.json',
    path: '/workspace/config.json',
    status: 'rejected',
    changes: '+1 -1'
  }
]

export function DiffPanel() {
  const columns = [
    {
      title: '文件',
      dataIndex: 'file',
      key: 'file',
      width: 150
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path'
    },
    {
      title: '变更',
      dataIndex: 'changes',
      key: 'changes',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={
          status === 'accepted' ? 'green' : 
          status === 'rejected' ? 'red' : 'blue'
        }>
          {status === 'accepted' ? '已接受' : 
           status === 'rejected' ? '已拒绝' : '待处理'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button size="small" icon={<CheckOutlined />}>接受</Button>
              <Button size="small" icon={<CloseOutlined />}>拒绝</Button>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className={styles.panel}>
      <Table
        columns={columns}
        dataSource={mockDiffs}
        pagination={false}
        size="small"
      />
    </div>
  )
}
