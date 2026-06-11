// GeoWork DiffPanel - Real data from diffStore

import { useState } from 'react'
import { Table, Button, Space, Tag, Select, Collapse, Tooltip } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  DiffOutlined,
} from '@ant-design/icons'
import useDiffStore from '../../../stores/diffStore'
import type { DiffFile } from '../../../types/diff'
import styles from './DiffPanel.module.scss'

const STATUS_LABELS: Record<string, { color: string; text: string }> = {
  modified: { color: 'orange', text: '已修改' },
  added: { color: 'green', text: '新增' },
  deleted: { color: 'red', text: '已删除' },
}

const FILE_ACCEPTED = (path: string, acceptedFiles: Set<string>) => acceptedFiles.has(path)
const FILE_REJECTED = (path: string, rejectedFiles: Set<string>) => rejectedFiles.has(path)
const FILE_PENDING = (path: string, acceptedFiles: Set<string>, rejectedFiles: Set<string>) =>
  !acceptedFiles.has(path) && !rejectedFiles.has(path)

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

  const handleAccept = (path: string) => {
    acceptFile(path)
  }

  const handleReject = (path: string) => {
    rejectFile(path)
  }

  const handleAcceptAll = () => {
    acceptAll(activeDiffId || undefined)
  }

  const handleRejectAll = () => {
    rejectAll(activeDiffId || undefined)
  }

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

  const columns = [
    {
      title: '文件',
      dataIndex: 'path',
      key: 'path',
      width: 200,
      render: (path: string) => {
        const filename = path.split('/').pop() || path
        return (
          <Tooltip title={path}>
            <span className={styles.filePath}>{filename}</span>
          </Tooltip>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: DiffFile['status']) => (
        <Tag color={STATUS_LABELS[status]?.color || 'default'}>
          {STATUS_LABELS[status]?.text || status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: DiffFile) => {
        const isAccepted = FILE_ACCEPTED(record.path, acceptedFiles)
        const isRejected = FILE_REJECTED(record.path, rejectedFiles)
        const isPending = FILE_PENDING(record.path, acceptedFiles, rejectedFiles)

        return (
          <Space size="small">
            {isPending && (
              <>
                <Tooltip title="接受变更">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => handleAccept(record.path)}
                    className={styles.acceptBtn}
                  />
                </Tooltip>
                <Tooltip title="拒绝变更">
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => handleReject(record.path)}
                    className={styles.rejectBtn}
                  />
                </Tooltip>
              </>
            )}
            {isAccepted && (
              <Tag color="green">已接受</Tag>
            )}
            {isRejected && (
              <Tag color="red">已拒绝</Tag>
            )}
          </Space>
        )
      },
    },
  ]

  if (diffs.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <DiffOutlined className={styles.emptyIcon} />
          <p className={styles.emptyText}>暂无差异文件</p>
          <p className={styles.emptyHint}>完成任务后自动显示差异</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Multi-diff selector */}
      {diffs.length > 1 && (
        <div className={styles.diffSelector}>
          <span className={styles.diffLabel}>差异批次：</span>
          <Select
            value={activeDiffId}
            onChange={setActiveDiffId}
            size="small"
            className={styles.diffSelect}
            options={diffs.map(d => ({
              label: `${d.id} (${d.files.length} 文件)`,
              value: d.id,
            }))}
          />
        </div>
      )}

      {/* Actions bar */}
      <div className={styles.actionsBar}>
        <span className={styles.actionCount}>
          共 {currentDiff?.files.length || 0} 个文件
          {' '}
          — 已接受: {acceptedFiles.size}
          {' '}
          已拒绝: {rejectedFiles.size}
          {' '}
          待处理: {(currentDiff?.files.length || 0) - acceptedFiles.size - rejectedFiles.size}
        </span>
        <Space size="small">
          {currentDiff?.patch && (
            <Tooltip title="下载 .patch 文件">
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
                导出
              </Button>
            </Tooltip>
          )}
          <Tooltip title="接受所有变更">
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleAcceptAll}>
              全部接受
            </Button>
          </Tooltip>
          <Tooltip title="拒绝所有变更">
            <Button size="small" danger icon={<CloseOutlined />} onClick={handleRejectAll}>
              全部拒绝
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* File list table */}
      {currentDiff ? (
        <div className={styles.tableWrapper}>
          <Table
            columns={columns}
            dataSource={currentDiff.files}
            rowKey={(record) => record.path}
            pagination={false}
            size="small"
            className={styles.diffTable}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyText}>请选择一个差异批次</p>
        </div>
      )}

      {/* File detail collapse */}
      {currentDiff && currentDiff.files.length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.sectionTitle}>详细对比</h4>
          <Collapse
            className={styles.diffCollapse}
            size="small"
            items={currentDiff.files.map((file) => {
              const fileAccepted = FILE_ACCEPTED(file.path, acceptedFiles)
              const fileRejected = FILE_REJECTED(file.path, rejectedFiles)
              return {
                key: file.path,
                label: (
                  <div className={styles.collapseLabel}>
                    <span className={styles.collapseFileName}>{file.path.split('/').pop()}</span>
                    <Tag color={STATUS_LABELS[file.status]?.color}>
                      {STATUS_LABELS[file.status]?.text}
                    </Tag>
                    {fileAccepted && <Tag color="green">已接受</Tag>}
                    {fileRejected && <Tag color="red">已拒绝</Tag>}
                  </div>
                ),
                children: (
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
                ),
              }
            })}
          />
        </div>
      )}
    </div>
  )
}

export default DiffPanel
