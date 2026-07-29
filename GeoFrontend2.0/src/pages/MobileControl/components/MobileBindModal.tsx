import { useState, useEffect } from 'react'
import { App, Avatar, Button, Modal, QRCode, Typography, theme } from 'antd'
import { ReloadOutlined, SettingOutlined, CheckOutlined } from '@ant-design/icons'
import type { MobileChannel } from './MobileChannelCard'
import styles from './MobileBindModal.module.css'

const { Text, Paragraph } = Typography

interface MobileBindModalProps {
  open: boolean
  channel: MobileChannel | null
  onClose: () => void
  onDone: (channelKey: string) => void
}

export function MobileBindModal({ open, channel, onClose, onDone }: MobileBindModalProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [qrNonce, setQrNonce] = useState(Date.now())

  /* 每次打开 Modal 重置 nonce */
  useEffect(() => {
    if (open) setQrNonce(Date.now())
  }, [open, channel?.key])

  if (!channel) return null

  const qrValue = `geowork://mobile-control/bind?channel=${channel.key}&nonce=${qrNonce}`

  const handleRefresh = () => {
    setQrNonce(Date.now())
    message.success('二维码已刷新')
  }

  const handleManual = () => {
    message.info('手动配置后续接入')
  }

  const handleDone = () => {
    onDone(channel.key)
    onClose()
  }

  return (
    <Modal
      title={`配置 ${channel.name}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnHidden
    >
      <div className={styles.modalBody}>
        {/* 顶部图标 */}
        <div
          className={styles.channelIcon}
          style={{
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
          }}
        >
          <Avatar
            size={48}
            style={{
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              fontSize: 24,
            }}
            icon={channel.icon}
          />
        </div>

        {/* 标题 */}
        <Text strong style={{ fontSize: 16 }}>
          绑定 {channel.name}
        </Text>

        {/* 说明文案 */}
        <Paragraph
          className={styles.modalNote}
          type="secondary"
        >
          请使用移动端扫描二维码，完成 GeoWork 移动端控制绑定。
        </Paragraph>

        {/* 二维码 */}
        <div className={styles.qrWrap}>
          <QRCode
            value={qrValue}
            size={180}
            type="svg"
            color={token.colorText}
            bgColor="transparent"
            bordered={false}
            errorLevel="M"
          />
        </div>

        {/* 补充说明 */}
        <Paragraph
          className={styles.modalNote}
          type="secondary"
          style={{ fontSize: 12 }}
        >
          当前为前端占位流程，后续将接入真实设备授权、消息通道和本地权限校验。
        </Paragraph>

        {/* 操作按钮 */}
        <div className={styles.footerActions}>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新二维码
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={handleManual}
          >
            手动配置
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleDone}
          >
            完成
          </Button>
        </div>
      </div>
    </Modal>
  )
}
