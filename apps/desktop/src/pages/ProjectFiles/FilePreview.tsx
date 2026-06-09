import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Descriptions, Empty, Spin, Tag } from 'antd'
import { DownloadOutlined, FileImageOutlined, FileTextOutlined } from '@ant-design/icons'
import type { FileNode } from '../../services/fileService'
import { fileService } from '../../services/fileService'
import styles from './FilePreview.module.scss'

// Image extensions
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff']
// Text/code extensions
const TEXT_EXTS = ['.txt', '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.xml', '.csv', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.ps1', '.sql', '.r', '.R', '.log']
// Geo extensions
const GEO_EXTS = ['.geojson', '.json', '.shp', '.shx', '.dbf', '.prj', '.kml', '.kmz', '.gpx', '.osm']

interface FilePreviewProps {
  file: FileNode | null
}

export function FilePreview({ file }: FilePreviewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!file) {
      setImageSrc(null)
      setTextContent(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const ext = getFileExtension(file.name)

    if (isImageFile(file)) {
      loadFileContent(file)
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          setImageSrc(url)
          setTextContent(null)
          setLoading(false)
        })
        .catch((err) => {
          setError(err.message)
          setLoading(false)
        })
    } else if (isTextFile(file) || isGeoFile(file)) {
      loadFileContent(file)
        .then((blob) => {
          blob.text().then((text) => {
            setTextContent(text)
            setImageSrc(null)
            setLoading(false)
          })
        })
        .catch((err) => {
          setError(err.message)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }

    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc)
    }
  }, [file])

  const loadFileContent = async (node: FileNode): Promise<Blob> => {
    try {
      const project = (window as any).geowork?.coreUrl ?? 'http://127.0.0.1:8765'
      const res = await fetch(`${project}/api/v1/files/${node.projectId}/${node.id}/content`)
      if (!res.ok) throw new Error(`Failed to load file: ${res.statusText}`)
      return await res.blob()
    } catch {
      // Fallback: if the file is already available locally, use it
      throw new Error('Unable to load file content')
    }
  }

  const handleDownload = useCallback(() => {
    if (!file) return
    const project = (window as any).geowork?.coreUrl ?? 'http://127.0.0.1:8765'
    const link = document.createElement('a')
    link.href = `${project}/api/v1/files/${file.projectId}/${file.id}/content`
    link.download = file.name
    link.click()
  }, [file])

  if (!file) {
    return (
      <div className={styles.previewEmpty}>
        <Empty description="选择文件以预览" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.previewLoading}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.previewError}>
        <Empty description={`加载失败: ${error}`} />
      </div>
    )
  }

  return (
    <div className={styles.previewContainer}>
      {/* File info header */}
      <div className={styles.previewHeader}>
        <div className={styles.previewFileInfo}>
          {getFileIcon(file)}
          <span className={styles.previewFileName}>{file.name}</span>
          {file.mimeType && <Tag>{file.mimeType}</Tag>}
          {file.type === 'file' && file.size !== undefined && (
            <Tag color="blue">{formatFileSize(file.size)}</Tag>
          )}
        </div>
        {file.type === 'file' && (
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            下载
          </Button>
        )}
      </div>

      {/* Preview area */}
      <div className={styles.previewBody}>
        {imageSrc && <img src={imageSrc} alt={file.name} className={styles.previewImage} />}
        {textContent !== null && (
          <pre className={styles.previewText}>
            <code>{textContent}</code>
          </pre>
        )}
        {!imageSrc && textContent === null && (
          <div className={styles.previewBinary}>
            <Empty description="该文件类型暂不支持预览" />
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="文件名">{file.name}</Descriptions.Item>
              <Descriptions.Item label="类型">{file.type}</Descriptions.Item>
              {file.mimeType && <Descriptions.Item label="MIME">{file.mimeType}</Descriptions.Item>}
              {file.size !== undefined && <Descriptions.Item label="大小">{formatFileSize(file.size)}</Descriptions.Item>}
              {file.modifiedAt && <Descriptions.Item label="修改时间">{new Date(file.modifiedAt).toLocaleString()}</Descriptions.Item>}
              {file.path && <Descriptions.Item label="路径">{file.path}</Descriptions.Item>}
            </Descriptions>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Helpers ---

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function isImageFile(node: FileNode): boolean {
  if (node.type !== 'file') return false
  const ext = getFileExtension(node.name)
  return IMAGE_EXTS.includes(ext) || node.mimeType?.startsWith('image/') === true
}

function isTextFile(node: FileNode): boolean {
  if (node.type !== 'file') return false
  const ext = getFileExtension(node.name)
  return TEXT_EXTS.includes(ext) || node.mimeType?.startsWith('text/') === true
}

function isGeoFile(node: FileNode): boolean {
  if (node.type !== 'file') return false
  const ext = getFileExtension(node.name)
  return GEO_EXTS.includes(ext) || node.mimeType?.includes('geo') === true
}

function getFileIcon(node: FileNode) {
  if (node.type === 'folder') {
    return <FileTextOutlined className={styles.iconFolder} />
  }
  const ext = getFileExtension(node.name)
  if (IMAGE_EXTS.includes(ext)) {
    return <FileImageOutlined className={styles.iconImage} />
  }
  return <FileTextOutlined className={styles.iconFile} />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
