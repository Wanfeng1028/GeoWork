import React from 'react'
import { Card, Tag, Tooltip } from 'antd'
import {
  FolderOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined
} from '@ant-design/icons'
import styles from './ProjectCard.module.scss'

export interface ProjectItem {
  id: string
  name: string
  description: string
  mode: string
  lastModified: string
  status: 'active' | 'paused' | 'completed' | 'error'
  thumbnail?: string
}

export interface ProjectCardProps {
  project: ProjectItem
  onClick?: (project: ProjectItem) => void
}

const STATUS_MAP: Record<ProjectItem['status'], { color: string; icon: React.ReactNode; text: string }> = {
  active: { color: 'green', icon: <CheckCircleOutlined />, text: '进行中' },
  paused: { color: 'orange', icon: <PauseCircleOutlined />, text: '已暂停' },
  completed: { color: 'blue', icon: <CheckCircleOutlined />, text: '已完成' },
  error: { color: 'red', icon: <PauseCircleOutlined />, text: '异常' }
}

const MODE_COLORS: Record<string, string> = {
  Research: 'blue',
  Data: 'green',
  GeoCode: 'purple',
  Analysis: 'orange',
  Write: 'cyan'
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusInfo = STATUS_MAP[project.status] ?? STATUS_MAP.active
  const modeColor = MODE_COLORS[project.mode] ?? 'default'

  const handleClick = () => {
    if (onClick) {
      onClick(project)
    }
  }

  return (
    <Card
      className={styles.card}
      hoverable
      onClick={handleClick}
      cover={
        project.thumbnail ? (
          <img
            alt={project.name}
            src={project.thumbnail}
            className={styles.thumbnail}
          />
        ) : (
          <div className={styles.placeholder}>
            <FolderOutlined className={styles.placeholderIcon} />
          </div>
        )
      }
    >
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <span className={styles.projectName}>{project.name}</span>
          <Tag color={modeColor}>{project.mode}</Tag>
        </div>
        <p className={styles.description}>{project.description}</p>
        <div className={styles.cardFooter}>
          <Tooltip title={project.lastModified}>
            <span className={styles.time}>
              <ClockCircleOutlined />
              {formatRelativeTime(project.lastModified)}
            </span>
          </Tooltip>
          <Tag color={statusInfo.color} icon={statusInfo.icon}>
            {statusInfo.text}
          </Tag>
        </div>
      </div>
    </Card>
  )
}

function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now()
    const date = new Date(dateStr).getTime()
    if (isNaN(date)) return dateStr

    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 7) return `${days} 天前`
    return dateStr
  } catch {
    return dateStr
  }
}
