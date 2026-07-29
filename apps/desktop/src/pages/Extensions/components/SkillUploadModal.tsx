import { useState } from 'react'
import { App, Modal, Typography, Upload, theme } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import styles from './SkillUploadModal.module.css'

const { Text } = Typography
const { Dragger } = Upload

type SkillUploadModalProps = {
  open: boolean
  onClose: () => void
  onInstall: (file: UploadFile) => void
}

export function SkillUploadModal({ open, onClose, onInstall }: SkillUploadModalProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const handleInstall = () => {
    if (fileList.length === 0) {
      message.warning('请先选择技能文件')
      return
    }

    const file = fileList[0]
    const fileName = file.name?.toLowerCase() ?? ''

    // .md 文件必须是 SKILL.md
    if (fileName.endsWith('.md') && fileName !== 'skill.md') {
      message.warning('请上传 SKILL.md 文件或包含 SKILL.md 的 zip 压缩包')
      return
    }

    onInstall(file)
    setFileList([])
  }

  return (
    <Modal
      title="安装技能"
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
        accept=".zip,.md"
        maxCount={1}
        fileList={fileList}
        beforeUpload={() => false}
        onChange={({ fileList: fl }) => setFileList(fl)}
        className={styles.dragger}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: token.colorPrimary }} />
        </p>
        <Text>拖放 .zip 或 SKILL.md 文件，或点击选择</Text>
      </Dragger>

      <div
        className={styles.requirements}
        style={{
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          文件要求：
        </Text>
        <ul className={styles.requirementsList}>
          <li>包含 SKILL.md 文件的 .zip 压缩包</li>
          <li>或直接拖入 SKILL.md 文件</li>
          <li>当前仅做前端占位，不会真实解析或执行技能</li>
        </ul>
      </div>
    </Modal>
  )
}
