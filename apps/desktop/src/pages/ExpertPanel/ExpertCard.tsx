import React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Bot,
  BookOpen,
  Database,
  Cloud,
  Monitor,
  ScanLine,
  LayoutGrid,
  Image,
  FileCheck,
  Edit,
  CheckSquare,
  Code
} from 'lucide-react'
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
  '总控专家': <Bot />,
  '论文专家': <BookOpen />,
  '数据专家': <Database />,
  'GEE 专家': <Cloud />,
  'QGIS 专家': <Monitor />,
  '遥感分析专家': <ScanLine />,
  'GIS 工程专家': <LayoutGrid />,
  '地图制图专家': <Image />,
  '实验报告专家': <FileCheck />,
  '论文写作专家': <Edit />,
  '质量检查专家': <CheckSquare />,
  '代码审查专家': <Code />
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
      onClick={handleCall}
    >
      <CardContent>
        <div className={styles.cardContent}>
          <div className={styles.expertHeader}>
            <div
              className="flex items-center justify-center rounded-full w-12 h-12"
              style={{ background: expert.color }}
            >
              <span className="text-white">{expert.icon || ICON_MAP[expert.name] || <Bot />}</span>
            </div>
            <div className={styles.expertInfo}>
              <h4 className={styles.expertName}>{expert.name}</h4>
              <span className={styles.expertCategory}>{expert.category}</span>
            </div>
          </div>
          <p className={styles.expertDesc}>{expert.description}</p>
          <div className={styles.skills}>
            {expert.skills.slice(0, 3).map((skill) => (
              <Badge key={skill.id} variant="secondary" className={styles.skillTag}>
                {skill.name}
              </Badge>
            ))}
            {expert.skills.length > 3 && (
              <Badge variant="outline" className={styles.skillTag}>
                +{expert.skills.length - 3}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            className={styles.callButton}
            onClick={(e) => {
              e.stopPropagation()
              handleCall()
            }}
          >
            调用专家
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
