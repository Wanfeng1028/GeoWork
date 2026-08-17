import { useMemo } from 'react'
import { Welcome, Prompts } from '@ant-design/x'
import { Boxes, Code, MapPin, Sparkles } from 'lucide-react'
import type { WorkMode } from '../../../../shared/session/types'
import { loadWelcomePrompts } from './promptData'
import styles from './antdx.module.css'

export interface WelcomeXProps {
  workMode: WorkMode
  title: string
  subtitle: string
  /** 点击推荐提示词 → 填入输入框 */
  onPickPrompt: (text: string) => void
}

const MODE_ICON: Record<WorkMode, React.ReactNode> = {
  work: <Boxes size={20} />,
  code: <Code size={20} />,
  map: <MapPin size={20} />,
}

/**
 * antdx 欢迎区（doc/26）：antd-x Welcome + Prompts 替代自研 hero 文案区。
 * Mode Switcher / Composer / 工作目录行仍由 NewTaskPage 组装。
 * 二期：Prompts 推荐数据接真实已安装技能（promptData），无技能时回退 GIS 场景文案。
 */
export function WelcomeX({ workMode, title, subtitle, onPickPrompt }: WelcomeXProps) {
  const prompts = useMemo(() => loadWelcomePrompts(), [])

  return (
    <div className={styles.welcomeRoot}>
      <Welcome
        className={styles.welcomeCard}
        variant="borderless"
        icon={<Sparkles size={22} />}
        title={title}
        description={subtitle}
        extra={MODE_ICON[workMode]}
      />
      <div className={styles.promptsWrap}>
        <Prompts
          title="试试这些任务"
          wrap
          items={prompts.map((item) => ({
            key: item.key,
            label: item.label,
            description: item.description,
          }))}
          onItemClick={({ data }) => {
            const item = prompts.find((p) => p.key === data.key)
            if (item) onPickPrompt(item.text)
          }}
        />
      </div>
    </div>
  )
}
