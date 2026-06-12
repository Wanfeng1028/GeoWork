// GeoWork DiffPanel

import { useState } from 'react'
import {
  Check,
  X,
  Download,
  GitCompare,
} from 'lucide-react'
import useDiffStore from '../../../stores/diffStore'
import type { DiffFile } from '../../../types/diff'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Empty } from '../../ui/empty'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import styles from './DiffPanel.module.scss'

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  modified: 'warning',
  added: 'success',
  deleted: 'danger',
}

const STATUS_LABELS: Record<string, string> = {
  modified: '已修改',
  added: '新增',
  deleted: '已删除',
}

export function DiffPanel() {
  const {
    diffs,
    activeDiffId,
    currentDiff,
    acceptedFiles,
    rejectedFiles,
    setActiveDiffId,
    acceptFile,
    rejectFile,
    acceptAll,
    rejectAll,
  } = useDiffStore()

  const handleDownload = () => {
    if (!currentDiff?.patch) return
    const blob = new Blob([currentDiff.patch], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diff-${currentDiff.id}.patch`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (diffs.length === 0) {
    return (
      <div className={styles.panel}>
        <Empty icon={<GitCompare size={40} strokeWidth={1} />} title="暂无差异文件" description="完成任务后自动显示差异" />
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {diffs.length > 1 && (
        <div className={styles.diffSelector}>
          <span className={styles.diffLabel}>差异批次：</span>
          <Select value={activeDiffId ?? undefined} onValueChange={setActiveDiffId}>
            <SelectTrigger className={styles.diffSelect}>
              <SelectValue placeholder="选择批次" />
            </SelectTrigger>
            <SelectContent>
              {diffs.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.id} ({d.files.length} 文件)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className={styles.actionsBar}>
        <span className={styles.actionCount}>
          共 {currentDiff?.files.length || 0} 个文件
          {' '}— 已接受: {acceptedFiles.size}
          {' '}已拒绝: {rejectedFiles.size}
          {' '}待处理: {(currentDiff?.files.length || 0) - acceptedFiles.size - rejectedFiles.size}
        </span>
        <div className="flex items-center gap-1">
          {currentDiff?.patch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download size={14} /> 导出
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载 .patch 文件</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="primary" size="sm" onClick={() => acceptAll(activeDiffId || undefined)}>
                <Check size={14} /> 全部接受
              </Button>
            </TooltipTrigger>
            <TooltipContent>接受所有变更</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="danger" size="sm" onClick={() => rejectAll(activeDiffId || undefined)}>
                <X size={14} /> 全部拒绝
              </Button>
            </TooltipTrigger>
            <TooltipContent>拒绝所有变更</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {currentDiff ? (
        <div className={styles.tableWrapper}>
          <div className="flex flex-col gap-1">
            {currentDiff.files.map((file) => {
              const isAccepted = acceptedFiles.has(file.path)
              const isRejected = rejectedFiles.has(file.path)
              const isPending = !isAccepted && !isRejected

              return (
                <div key={file.path} className={styles.stepItem}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={styles.filePath}>{file.path.split('/').pop()}</span>
                    </TooltipTrigger>
                    <TooltipContent>{file.path}</TooltipContent>
                  </Tooltip>
                  <Badge variant={STATUS_VARIANT[file.status] || 'default'}>
                    {STATUS_LABELS[file.status] || file.status}
                  </Badge>
                  {isPending && (
                    <div className="flex items-center gap-1 ml-auto">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="primary" size="icon-sm" onClick={() => acceptFile(file.path)}>
                            <Check size={12} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>接受变更</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="danger" size="icon-sm" onClick={() => rejectFile(file.path)}>
                            <X size={12} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>拒绝变更</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  {isAccepted && <Badge variant="success" className="ml-auto">已接受</Badge>}
                  {isRejected && <Badge variant="danger" className="ml-auto">已拒绝</Badge>}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <Empty title="请选择一个差异批次" />
      )}

      {currentDiff && currentDiff.files.length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.sectionTitle}>详细对比</h4>
          <div className="flex flex-col gap-2">
            {currentDiff.files.map((file) => {
              const fileAccepted = acceptedFiles.has(file.path)
              const fileRejected = rejectedFiles.has(file.path)
              return (
                <details key={file.path} className={styles.collapseLabel}>
                  <summary className="flex items-center gap-2 cursor-pointer py-1">
                    <span className={styles.collapseFileName}>{file.path.split('/').pop()}</span>
                    <Badge variant={STATUS_VARIANT[file.status] || 'default'}>
                      {STATUS_LABELS[file.status]}
                    </Badge>
                    {fileAccepted && <Badge variant="success">已接受</Badge>}
                    {fileRejected && <Badge variant="danger">已拒绝</Badge>}
                  </summary>
                  <div className={styles.diffContent}>
                    {file.oldContent && (
                      <div className={styles.oldContent}>
                        <span className={styles.diffLabel}>旧内容</span>
                        <pre>{file.oldContent}</pre>
                      </div>
                    )}
                    <div className={styles.newContent}>
                      <span className={styles.diffLabel}>新内容</span>
                      <pre>{file.newContent}</pre>
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DiffPanel
