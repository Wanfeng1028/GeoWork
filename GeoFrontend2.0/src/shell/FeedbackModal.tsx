import { useState } from 'react'
import { App, Button, Input, Modal, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import styles from './FeedbackModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

/* SVG 占位 Logo */
function FeedbackLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#52c41a" />
      <path
        d="M10 22c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="12" r="4" fill="#fff" />
    </svg>
  )
}

export function FeedbackModal({ open, onClose }: Props) {
  const { message } = App.useApp()

  const [content, setContent] = useState('')
  const [email, setEmail] = useState('')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) {
      message.warning('请输入问题或建议')
      return
    }
    setSubmitting(true)
    /* 模拟提交 */
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    message.success('反馈已提交，感谢你的建议')
    setContent('')
    setEmail('')
    setFileList([])
    onClose()
  }

  const handleCancel = () => {
    setContent('')
    setEmail('')
    setFileList([])
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={560}
      closable
    >
      <div className={styles.header}>
        <FeedbackLogo />
        <div>
          <div className={styles.title}>问题反馈</div>
          <div className={styles.subtitle}>
            如果您在使用过程中遇到任何问题，请随时反馈给我们。您的反馈将帮助我们不断改进和优化产品。
          </div>
        </div>
      </div>

      <div className={styles.form}>
        <label className={styles.label}>请输入您的问题或建议</label>
        <Input.TextArea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="请详细描述您遇到的问题或建议…"
        />

        <label className={styles.label}>屏幕截图</label>
        <Upload.Dragger
          accept="image/*"
          listType="picture"
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => setFileList(next)}
          maxCount={3}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            点击添加，或拖拽/粘贴图片到此区域
          </p>
        </Upload.Dragger>

        <label className={styles.label}>联系邮箱</label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="请输入您的邮箱地址"
        />
      </div>

      <div className={styles.footer}>
        <Button onClick={handleCancel}>取消</Button>
        <Button
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
        >
          提交
        </Button>
      </div>
    </Modal>
  )
}
