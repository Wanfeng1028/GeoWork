import React from 'react'
import { Card, Tag, Button, Avatar } from 'antd'
import {
  RobotOutlined,
  BookOutlined,
  DatabaseOutlined,
  CloudOutlined,
  DesktopOutlined,
  ScanOutlined,
  AppstoreOutlined,
  PictureOutlined,
  FileDoneOutlined,
  EditOutlined,
  CheckSquareOutlined,
  CodeOutlined
} from '@ant-design/icons'
import styles from './ExpertCard.module.scss'

export interface ExpertSkill {
  id: string
  name: string
  description: string
}

export interface ExpertItem {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  color: string
  skills: ExpertSkill[]
  category: string
}

export interface ExpertCardProps {
  expert: ExpertItem
  onCall?: (expert: ExpertItem) => void
}

const ICON_MAP: Record<string, React.ReactNode> = {
  '总控专家': <RobotOutlined />,
  '论文专家': <BookOutlined />,
  '数据专家': <DatabaseOutlined />,
  'GEE 专家': <CloudOutlined />,
  'QGIS 专家': <DesktopOutlined />,
  '遥感分析专家': <ScanOutlined />,
  'GIS 工程专家': <AppstoreOutlined />,
  '地图制图专家': <PictureOutlined />,
  '实验报告专家': <FileDoneOutlined />,
  '论文写作专家': <EditOutlined />,
  '质量检查专家': <CheckSquareOutlined />,
  '代码审查专家': <CodeOutlined />
}

export default function ExpertCard({ expert, onCall }: ExpertCardProps) {
  const handleCall = () => {
    if (onCall) {
      onCall(expert)
    }
  }

  return (
    <Card
      className={styles.card}
      hoverable
      onClick={handleCall}
    >
      <div className={styles.cardContent}>
        <div className={styles.expertHeader}>
          <Avatar
            size={48}
            icon={expert.icon || ICON_MAP[expert.name] || <RobotOutlined />}
            style={{ background: expert.color }}
          />
          <div className={styles.expertInfo}>
            <h4 className={styles.expertName}>{expert.name}</h4>
            <span className={styles.expertCategory}>{expert.category}</span>
          </div>
        </div>
        <p className={styles.expertDesc}>{expert.description}</p>
        <div className={styles.skills}>
          {expert.skills.slice(0, 3).map((skill) => (
            <Tag key={skill.id} color={expert.color} className={styles.skillTag}>
              {skill.name}
            </Tag>
          ))}
          {expert.skills.length > 3 && (
            <Tag color="default" className={styles.skillTag}>
              +{expert.skills.length - 3}
            </Tag>
          )}
        </div>
        <Button
          type="primary"
          size="small"
          block
          className={styles.callButton}
          onClick={(e) => {
            e.stopPropagation()
            handleCall()
          }}
        >
          调用专家
        </Button>
      </div>
    </Card>
  )
}
