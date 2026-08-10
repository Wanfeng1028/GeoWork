import { useState } from 'react'
import { App, Button, Input, Modal, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import styles from './FeedbackModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

/* GeoWork 品牌符号 Logo */
function FeedbackLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#73DEFF" />
          <stop offset="0.48" stopColor="#25BDF4" />
          <stop offset="1" stopColor="#1B6DB0" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="128" cy="128" r="91" stroke="url(#brandGradient)" strokeWidth="13" />
        <path d="M53 188 C83 102 132 48 204 53" stroke="url(#brandGradient)" strokeWidth="12" />
        <path d="M52 58 C105 99 157 157 205 201" stroke="url(#brandGradient)" strokeWidth="12" />
        <path d="M45 136 C86 92 161 82 213 116" stroke="url(#brandGradient)" strokeWidth="10" />
        <path d="M63 174 C108 213 171 207 208 155" stroke="url(#brandGradient)" strokeWidth="10" />
        <path d="M76 40 C45 91 45 164 86 209" stroke="url(#brandGradient)" strokeWidth="9" />
        <path d="M198 49 C176 76 164 98 158 127" stroke="#73DEFF" strokeWidth="13" />
        <path d="M157 127 C181 97 198 76 204 53" stroke="#73DEFF" strokeWidth="13" />
      </g>
      <g>
        <circle cx="52" cy="58" r="13" fill="#17396F" />
        <circle cx="204" cy="53" r="13" fill="#73DEFF" />
        <circle cx="53" cy="188" r="13" fill="#17396F" />
        <circle cx="205" cy="201" r="13" fill="#17396F" />
        <circle cx="109" cy="104" r="11" fill="#25BDF4" />
        <circle cx="158" cy="127" r="11" fill="#25BDF4" />
      </g>
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
