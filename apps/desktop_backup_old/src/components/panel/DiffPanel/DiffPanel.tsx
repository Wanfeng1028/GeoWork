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
        <div className={styles.emptyState}>暂无差异文件</div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {diffs.length > 1 && (
        <div className={styles.diffSelector}>
          <span className={styles.diffLabel}>差异批次：</span>
          <select>
            <div className={styles.diffSelect}>
              选择批次
            </div>
            <div>
              {diffs.map(d => (
                <option key={d.id}>
                  {d.id} ({d.files.length} 文件)
                </option>
              ))}
            </div>
          </select>
        </div>
      )}

      <div className={styles.actionsBar}>
        <span className={styles.actionCount}>
          共 {currentDiff?.files.length || 0} 个文件
          {' '}— 已接受: {acceptedFiles.size}
          {' '}已拒绝: {rejectedFiles.size}
          {' '}待处理: {(currentDiff?.files.length || 0) - acceptedFiles.size - rejectedFiles.size}
        </span>
        <div >
          {currentDiff?.patch && (
            <div>
              <button onClick={handleDownload}>
                  <Download size={14} /> 导出
                </button>
              <div>下载 .patch 文件</div>
            </div>
          )}
          <div>
            <button onClick={() => acceptAll(activeDiffId || undefined)}>
                <Check size={14} /> 全部接受
              </button>
            <div>接受所有变更</div>
          </div>
          <div>
            <button onClick={() => rejectAll(activeDiffId || undefined)}>
                <X size={14} /> 全部拒绝
              </button>
            <div>拒绝所有变更</div>
          </div>
        </div>
      </div>

      {currentDiff ? (
        <div className={styles.tableWrapper}>
          <div >
            {currentDiff.files.map((file) => {
              const isAccepted = acceptedFiles.has(file.path)
              const isRejected = rejectedFiles.has(file.path)
              const isPending = !isAccepted && !isRejected

              return (
                <div key={file.path} className={styles.stepItem}>
                  <div>
                    <span className={styles.filePath}>{file.path.split('/').pop()}</span>
                    <div>{file.path}</div>
                  </div>
                  <span>
                    {STATUS_LABELS[file.status] || file.status}
                  </span>
                  {isPending && (
                    <div >
                      <div>
                        <button onClick={() => acceptFile(file.path)}>
                            <Check size={12} />
                          </button>
                        <div>接受变更</div>
                      </div>
                      <div>
                        <button onClick={() => rejectFile(file.path)}>
                            <X size={12} />
                          </button>
                        <div>拒绝变更</div>
                      </div>
                    </div>
                  )}
                  {isAccepted && <span >已接受</span>}
                  {isRejected && <span >已拒绝</span>}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div />
      )}

      {currentDiff && currentDiff.files.length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.sectionTitle}>详细对比</h4>
          <div >
            {currentDiff.files.map((file) => {
              const fileAccepted = acceptedFiles.has(file.path)
              const fileRejected = rejectedFiles.has(file.path)
              return (
                <details key={file.path} className={styles.collapseLabel}>
                  <summary >
                    <span className={styles.collapseFileName}>{file.path.split('/').pop()}</span>
                    <span>
                      {STATUS_LABELS[file.status]}
                    </span>
                    {fileAccepted && <span>已接受</span>}
                    {fileRejected && <span>已拒绝</span>}
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
