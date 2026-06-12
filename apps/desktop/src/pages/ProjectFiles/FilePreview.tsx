import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Spinner } from '../../components/ui/spinner'
import { Empty } from '../../components/ui/empty'
import { Download, FileImage, FileText } from 'lucide-react'
import type { FileNode } from '../../services/fileService'
import { fileService } from '../../services/fileService'
import styles from './FilePreview.module.scss'

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff']
const TEXT_EXTS = ['.txt', '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.xml', '.csv', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.ps1', '.sql', '.r', '.R', '.log']
const GEO_EXTS = ['.geojson', '.json', '.shp', '.shx', '.dbf', '.prj', '.kml', '.kmz', '.gpx', '.osm']

interface FilePreviewProps {
  file: FileNode | null
}

export function FilePreview({ file }: FilePreviewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setImageSrc(null)
      setTextContent(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

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
        <Spinner className="w-8 h-8" />
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
      <div className={styles.previewHeader}>
        <div className={styles.previewFileInfo}>
          {getFileIcon(file)}
          <span className={styles.previewFileName}>{file.name}</span>
          {file.mimeType && <Badge variant="outline">{file.mimeType}</Badge>}
          {file.type === 'file' && file.size !== undefined && (
            <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
          )}
        </div>
        {file.type === 'file' && (
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" /> 下载
          </Button>
        )}
      </div>

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
            <div className="grid grid-cols-1 gap-1 border rounded p-3 mt-4 text-sm">
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">文件名</span><span>{file.name}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">类型</span><span>{file.type}</span></div>
              {file.mimeType && <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">MIME</span><span>{file.mimeType}</span></div>}
              {file.size !== undefined && <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">大小</span><span>{formatFileSize(file.size)}</span></div>}
              {file.modifiedAt && <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">修改时间</span><span>{new Date(file.modifiedAt).toLocaleString()}</span></div>}
              {file.path && <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">路径</span><span>{file.path}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
    return <FileText className={styles.iconFolder} />
  }
  const ext = getFileExtension(node.name)
  if (IMAGE_EXTS.includes(ext)) {
    return <FileImage className={styles.iconImage} />
  }
  return <FileText className={styles.iconFile} />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
