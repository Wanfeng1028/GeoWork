import React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import {
  Folder,
  Clock,
  CheckCircle,
  Loader2,
  PauseCircle
} from 'lucide-react'
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
  active: { color: 'bg-green-500', icon: <CheckCircle />, text: '进行中' },
  paused: { color: 'bg-orange-500', icon: <PauseCircle />, text: '已暂停' },
  completed: { color: 'bg-blue-500', icon: <CheckCircle />, text: '已完成' },
  error: { color: 'bg-red-500', icon: <PauseCircle />, text: '异常' }
}

const MODE_COLORS: Record<string, string> = {
  Research: 'bg-blue-100 text-blue-800',
  Data: 'bg-green-100 text-green-800',
  GeoCode: 'bg-purple-100 text-purple-800',
  Analysis: 'bg-orange-100 text-orange-800',
  Write: 'bg-cyan-100 text-cyan-800'
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusInfo = STATUS_MAP[project.status] ?? STATUS_MAP.active

  const handleClick = () => {
    if (onClick) {
      onClick(project)
    }
  }

  return (
    <Card
      className={styles.card}
      onClick={handleClick}
    >
      <CardContent>
        {project.thumbnail ? (
          <img
            alt={project.name}
            src={project.thumbnail}
            className={styles.thumbnail}
          />
        ) : (
          <div className={styles.placeholder}>
            <Folder className={styles.placeholderIcon} />
          </div>
        )}
        <div className={styles.cardBody}>
          <div className={styles.cardHeader}>
            <span className={styles.projectName}>{project.name}</span>
            <Badge variant="secondary" className={MODE_COLORS[project.mode] || ''}>{project.mode}</Badge>
          </div>
          <p className={styles.description}>{project.description}</p>
          <div className={styles.cardFooter}>
            <span className={styles.time}>
              <Clock className="w-3.5 h-3.5" />
              {formatRelativeTime(project.lastModified)}
            </span>
            <Badge variant="secondary" className={statusInfo.color}>
              {statusInfo.icon} {statusInfo.text}
            </Badge>
          </div>
        </div>
      </CardContent>
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
