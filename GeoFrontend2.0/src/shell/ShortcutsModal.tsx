import { App, Button, Divider, Modal, theme } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import styles from './ShortcutsModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { label: '创建新任务', keys: [['Ctrl', 'N']] },
  { label: '任务列表多选', keys: [['Shift', '.']] },
  { label: '搜索全部任务', keys: [['Ctrl', 'G']] },
  { label: '在当前任务中搜索', keys: [['Ctrl', 'F']] },
  { label: '快速切换任务', keys: [['Ctrl', 'Tab']] },
  { label: '切换侧边栏', keys: [['Ctrl', '\\']] },
  { label: '打开设置', keys: [['Ctrl', ',']] },
  { label: '发送消息', keys: [['Enter'], ['Ctrl', 'Enter']] },
  { label: '插入换行', keys: [['Shift', 'Enter']] },
]

export function ShortcutsModal({ open, onClose }: Props) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  const handleSetShortcuts = () => {
    message.success('快捷键设置功能后续接入')
    onClose()
  }

  return (
    <Modal
      title="快捷键指引"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <p className={styles.subtitle}>
        常用快捷键可帮助你快速创建任务、搜索、切换上下文和发送消息。
      </p>

      <div className={styles.list}>
        {shortcuts.map((item, i) => (
          <div key={item.label}>
            <div className={styles.row}>
              <span>{item.label}</span>
              <span className={styles.keys}>
                {item.keys.map((combo, j) => (
                  <span key={j}>
                    {j > 0 && <span className={styles.or}>或</span>}
                    {combo.map((k) => (
                      <kbd
                        key={k}
                        className={styles.kbd}
                        style={{
                          background: token.colorFillSecondary,
                          borderColor: token.colorBorder,
                          color: token.colorText,
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                ))}
              </span>
            </div>
            {i < shortcuts.length - 1 && (
              <Divider style={{ margin: '0' }} />
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <Button type="primary" icon={<SettingOutlined />} onClick={handleSetShortcuts}>
          设置快捷键
        </Button>
      </div>
    </Modal>
  )
}
