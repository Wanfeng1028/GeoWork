import React from 'react'
import { Button, Modal, Form, Input, message } from 'antd'
import {
  PlusOutlined,
  ImportOutlined,
  ExperimentOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import styles from './QuickActions.module.scss'

export interface QuickAction {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  description: string
  action: () => void
}

export interface QuickActionsProps {
  actions?: QuickAction[]
  onAction?: (action: QuickAction) => void
}

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    key: 'new-project',
    label: '新建项目',
    icon: <PlusOutlined />,
    color: 'blue',
    description: '创建一个新的 GeoWork 项目',
    action: () => message.info('新建项目功能待实现')
  },
  {
    key: 'import-data',
    label: '导入数据',
    icon: <ImportOutlined />,
    color: 'green',
    description: '导入遥感数据或本地文件',
    action: () => message.info('导入数据功能待实现')
  },
  {
    key: 'ndvi-analysis',
    label: '运行 NDVI 分析',
    icon: <ExperimentOutlined />,
    color: 'orange',
    description: '使用 GEE 运行 NDVI 植被指数分析',
    action: () => message.info('NDVI 分析功能待实现')
  },
  {
    key: 'view-report',
    label: '查看报告',
    icon: <FileTextOutlined />,
    color: 'purple',
    description: '查看已生成的实验报告',
    action: () => message.info('查看报告功能待实现')
  }
]

export default function QuickActions({
  actions = DEFAULT_ACTIONS,
  onAction
}: QuickActionsProps) {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedAction, setSelectedAction] = React.useState<QuickAction | null>(null)
  const [form] = Form.useForm()

  const handleActionClick = (action: QuickAction) => {
    if (onAction) {
      onAction(action)
    } else {
      setSelectedAction(action)
      setModalOpen(true)
    }
  }

  const handleModalConfirm = () => {
    if (selectedAction) {
      selectedAction.action()
      setModalOpen(false)
      form.resetFields()
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>快速操作</h3>
        <span className={styles.subtitle}>开始你的地理遥感分析任务</span>
      </div>
      <div className={styles.grid}>
        {actions.map((action) => (
          <button
            key={action.key}
            className={styles.actionCard}
            onClick={() => handleActionClick(action)}
          >
            <div className={`${styles.iconWrapper} ${styles[`iconColor${action.color}`]}`}>
              {action.icon}
            </div>
            <div className={styles.actionInfo}>
              <span className={styles.actionLabel}>{action.label}</span>
              <span className={styles.actionDesc}>{action.description}</span>
            </div>
          </button>
        ))}
      </div>

      <Modal
        title={selectedAction?.label}
        open={modalOpen}
        onOk={handleModalConfirm}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        okText="确认执行"
        cancelText="取消"
      >
        {selectedAction && (
          <div className={styles.modalContent}>
            <p>{selectedAction.description}</p>
            <Form form={form} layout="vertical">
              <Form.Item
                name="prompt"
                label="任务描述"
                rules={[{ required: true, message: '请输入任务描述' }]}
              >
                <Input.TextArea rows={3} placeholder="请输入任务描述..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
