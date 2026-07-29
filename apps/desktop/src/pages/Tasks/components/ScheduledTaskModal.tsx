import { useEffect } from 'react'
import { App, Button, Dropdown, Form, Input, Modal, Select, Space, TimePicker, theme } from 'antd'
import { FolderOpenOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ScheduledTask } from '../TasksPage'
import styles from './ScheduledTaskModal.module.css'

interface ScheduledTaskModalProps {
  open: boolean
  task: ScheduledTask | null
  onClose: () => void
  onSave: (data: { name: string; description: string; schedule: string; prompt: string }) => void
}

const FREQUENCY_OPTIONS = [
  { label: '每天', value: '每天' },
  { label: '工作日', value: '工作日' },
  { label: '每周', value: '每周' },
  { label: '每月', value: '每月' },
]

const MODEL_OPTIONS = [
  { label: 'Auto', value: 'Auto' },
  { label: 'GeoWork Planner', value: 'GeoWork Planner' },
  { label: 'Qwen GIS Assistant', value: 'Qwen GIS Assistant' },
]

export function ScheduledTaskModal({ open, task, onClose, onSave }: ScheduledTaskModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      if (task) {
        form.setFieldsValue({
          name: task.name,
          frequency: task.schedule.replace(/\s\d+:\d+$/, ''),
          time: dayjs(task.schedule.match(/\d+:\d+/)?.[0] || '09:00', 'HH:mm'),
          description: task.prompt,
        })
      } else {
        form.resetFields()
      }
    }
  }, [open, task, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const timeStr = values.time?.format('HH:mm') || '09:00'
      const schedule = `${values.frequency} ${timeStr}`
      onSave({
        name: values.name,
        description: values.description,
        schedule,
        prompt: values.description,
      })
    } catch {
      // validation failed
    }
  }

  const modelMenu = {
    items: MODEL_OPTIONS.map((opt) => ({
      key: opt.value,
      label: opt.label,
      onClick: () => message.info(`模型已选择：${opt.label}`),
    })),
  }

  return (
    <Modal
      title={task ? '编辑任务' : '新建定时任务'}
      open={open}
      onCancel={onClose}
      width={560}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ frequency: '每天', time: dayjs('09:00', 'HH:mm') }}
        className={styles.form}
      >
        <Form.Item
          name="name"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="描述你的任务" />
        </Form.Item>

        <Form.Item label="计划时间" required>
          <div className={styles.scheduleRow}>
            <Form.Item name="frequency" noStyle>
              <Select options={FREQUENCY_OPTIONS} className={styles.frequencySelect} />
            </Form.Item>
            <Form.Item name="time" noStyle>
              <TimePicker format="HH:mm" minuteStep={5} />
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item
          name="description"
          label="让 GeoWork 帮你做什么"
          rules={[{ required: true, message: '请输入任务描述' }]}
        >
          <Input.TextArea rows={4} placeholder="让 GeoWork 帮你做什么..." />
        </Form.Item>

        <div
          className={styles.bottomToolbar}
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Button
            icon={<FolderOpenOutlined />}
            size="small"
            onClick={() => message.info('工作目录选择后续接入')}
          >
            选择工作目录
          </Button>
          <Button
            icon={<PlusOutlined />}
            size="small"
            shape="circle"
            onClick={() => message.info('附件与工具选择后续接入')}
          />
          <Dropdown menu={modelMenu} trigger={['click']}>
            <Button size="small" icon={<RobotOutlined />}>
              Auto
            </Button>
          </Dropdown>
        </div>
      </Form>
    </Modal>
  )
}
