import { Welcome, Prompts } from '@ant-design/x'
import { Boxes, Code, MapPin, Sparkles } from 'lucide-react'
import type { WorkMode } from '../../../../shared/session/types'
import styles from './antdx.module.css'

export interface WelcomeXProps {
  workMode: WorkMode
  title: string
  subtitle: string
  /** 点击推荐提示词 → 填入输入框 */
  onPickPrompt: (text: string) => void
}

/* 推荐提示词：按工作模式给 GIS 场景示例（二期接真实技能/专家数据） */
const PROMPT_ITEMS: Record<WorkMode, Array<{ key: string; label: string; text: string }>> = {
  work: [
    {
      key: 'buffer',
      label: '缓冲区分析',
      text: '对道路图层做 500 米缓冲区分析，统计影响范围内的地块数量',
    },
    { key: 'overlay', label: '叠加分析', text: '将土地利用图层与坡度图层叠加，找出适宜建设区域' },
    { key: 'stats', label: '空间统计', text: '统计每个行政区内 POI 的数量与密度' },
  ],
  code: [
    { key: 'script', label: '编写分析脚本', text: '用 geopandas 写一个批量裁剪矢量图层的脚本' },
    { key: 'debug', label: '调试空间流水线', text: '帮我调试这个坐标转换报错的分析流水线' },
    {
      key: 'pipeline',
      label: '构建处理流水线',
      text: '构建一个遥感影像预处理流水线：辐射校正→大气校正→裁剪',
    },
  ],
  map: [
    { key: 'thematic', label: '专题制图', text: '用人口数据做一张分级设色专题地图，导出 PNG' },
    { key: 'style', label: '调整地图样式', text: '把当前地图的配色调整为暗色风格，突出水系' },
    { key: 'layout', label: '制图整饰', text: '给地图添加指北针、比例尺和图例，排版出图' },
  ],
}

const MODE_ICON: Record<WorkMode, React.ReactNode> = {
  work: <Boxes size={20} />,
  code: <Code size={20} />,
  map: <MapPin size={20} />,
}

/**
 * antdx 欢迎区（doc/26）：antd-x Welcome + Prompts 替代自研 hero 文案区。
 * Mode Switcher / Composer / 工作目录行仍由 NewTaskPage 组装。
 */
export function WelcomeX({ workMode, title, subtitle, onPickPrompt }: WelcomeXProps) {
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
          items={PROMPT_ITEMS[workMode].map((item) => ({
            key: item.key,
            label: item.label,
            description: item.text,
          }))}
          onItemClick={({ data }) => {
            const item = PROMPT_ITEMS[workMode].find((p) => p.key === data.key)
            if (item) onPickPrompt(item.text)
          }}
        />
      </div>
    </div>
  )
}
