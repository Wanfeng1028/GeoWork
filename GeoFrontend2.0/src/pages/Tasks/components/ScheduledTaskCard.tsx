import { App, Button, Dropdown, Switch, Tag, Typography, theme } from 'antd'
import type { MenuProps } from 'antd'
import { MoreOutlined, EditOutlined, CopyOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ScheduledTask } from '../TasksPage'
import styles from './ScheduledTaskCard.module.css'

const { Text, Paragraph } = Typography

interface ScheduledTaskCardProps {
  task: ScheduledTask
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (task: ScheduledTask) => void
  onCopyToNew: (task: ScheduledTask) => void
  onDelete: (id: string) => void
}

export function ScheduledTaskCard({ task, onToggle, onEdit, onCopyToNew, onDelete }: ScheduledTaskCardProps) {
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()

  const menuItems: MenuProps['items'] = [
    { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => onEdit(task) },
    { key: 'copy', icon: <CopyOutlined />, label: '复制到新任务', onClick: () => onCopyToNew(task) },
    { key: 'run', icon: <PlayCircleOutlined />, label: '立即运行', onClick: () => message.info('立即运行功能后续接入') },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => {
        modal.confirm({
          title: '确认删除',
          content: `确定要删除定时任务"${task.name}"吗？`,
          okText: '删除',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => onDelete(task.id),
        })
      },
    },
  ]

  return (
    <div
      className={styles.card}
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <div className={styles.header}>
        <Switch
          size="small"
          checked={task.enabled}
          onChange={(checked) => onToggle(task.id, checked)}
        />
        <Text strong className={styles.title}>{task.name}</Text>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      </div>

      <Paragraph
        className={styles.description}
        type="secondary"
        ellipsis={{ rows: 3 }}
      >
        {task.description}
      </Paragraph>

      <div className={styles.footer}>
        <Tag>{task.schedule}</Tag>
      </div>
    </div>
  )
}
