import { useState } from 'react'
import { App, Modal, Typography, Upload, theme } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import styles from './ExpertUploadModal.module.css'

const { Text } = Typography
const { Dragger } = Upload

type ExpertUploadModalProps = {
  open: boolean
  onClose: () => void
}

export function ExpertUploadModal({ open, onClose }: ExpertUploadModalProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const handleInstall = () => {
    if (fileList.length === 0) {
      message.warning('请先选择专家套件 ZIP 文件')
      return
    }
    message.success('专家套件安装流程后续接入')
    setFileList([])
    onClose()
  }

  return (
    <Modal
      title="上传专家套件"
      open={open}
      onCancel={() => {
        setFileList([])
        onClose()
      }}
      onOk={handleInstall}
      okText="安装"
      destroyOnHidden
    >
      <Dragger
        accept=".zip"
        maxCount={1}
        fileList={fileList}
        beforeUpload={() => false}
        onChange={({ fileList: fl }) => setFileList(fl)}
        className={styles.dragger}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: token.colorPrimary }} />
        </p>
        <Text>点击或拖拽 .zip 文件到此处</Text>
      </Dragger>

      <div
        className={styles.requirements}
        style={{
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          要求说明：
        </Text>
        <ul className={styles.requirementsList}>
          <li>ZIP 中需包含 geowork-expert/manifest.json</li>
          <li>manifest.json 需包含 name、version、commands 字段</li>
          <li>当前仅做前端占位，不会真实安装</li>
        </ul>
      </div>
    </Modal>
  )
}
