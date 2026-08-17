/**
 * promptData.ts（doc/26 二期）
 *
 * WelcomeX 推荐提示词与 SenderX 输入联想的共享数据层。
 * 数据来源与 ContextPickerModal 一致：skillsStorage / expertStorage（localStorage 快照），
 * 组件挂载时读取一次——与 settings 的快照读取惯例相同。
 */

import { loadSkillsStore } from '../../../Extensions/skillsStorage'
import { marketSkills, builtInSkills } from '../../../Extensions/skillsMockData'
import type { SkillItem } from '../../../Extensions/skillsMockData'
import { loadExpertStore, mergeExperts } from '../../../Extensions/expertStorage'
import type { ExpertSuite } from '../../../Extensions/expertMockData'

export interface PromptSkillItem {
  key: string
  /** 技能名（如「缓冲区分析」） */
  label: string
  /** 技能描述 */
  description: string
  /** 点击后填入输入框的提示词 */
  text: string
}

export interface PromptExpertCommand {
  key: string
  /** 专家命令触发词（如「/缓冲区分析」） */
  label: string
  description: string
  /** 所属专家名 */
  expertName: string
}

/* 无已安装技能时的兜底推荐（GIS 场景示例文案） */
const FALLBACK_PROMPTS: PromptSkillItem[] = [
  {
    key: 'fallback-buffer',
    label: '缓冲区分析',
    description: '对道路图层做 500 米缓冲区分析，统计影响范围内的地块数量',
    text: '对道路图层做 500 米缓冲区分析，统计影响范围内的地块数量',
  },
  {
    key: 'fallback-overlay',
    label: '叠加分析',
    description: '将土地利用图层与坡度图层叠加，找出适宜建设区域',
    text: '将土地利用图层与坡度图层叠加，找出适宜建设区域',
  },
  {
    key: 'fallback-stats',
    label: '空间统计',
    description: '统计每个行政区内 POI 的数量与密度',
    text: '统计每个行政区内 POI 的数量与密度',
  },
]

/** 已安装且启用的技能 → 推荐提示词（点击填入「使用技能 X：」引导语） */
export function loadPromptSkills(): PromptSkillItem[] {
  const store = loadSkillsStore()
  const allSkills: SkillItem[] = [...marketSkills, ...builtInSkills, ...store.localSkills].map(
    (skill) => {
      const stored = store.states[skill.id]
      if (!stored) return skill
      return { ...skill, installed: stored.installed, enabled: stored.enabled }
    },
  )
  const seen = new Set<string>()
  return allSkills
    .filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return s.installed && s.enabled
    })
    .slice(0, 6)
    .map((s) => ({
      key: `skill-${s.id}`,
      label: s.name,
      description: s.description,
      text: `使用技能「${s.name}」：`,
    }))
}

/** 已安装专家的快捷命令 → 联想项（选中即填入触发词，如「/缓冲区分析 」） */
export function loadExpertCommands(): PromptExpertCommand[] {
  const store = loadExpertStore()
  const installed: ExpertSuite[] = mergeExperts(store).filter((e) => e.installed)
  return installed
    .flatMap((e) =>
      e.quickCommands.map((cmd) => ({
        key: `expert-${e.id}-${cmd.trigger}`,
        label: cmd.trigger,
        description: cmd.description,
        expertName: e.name,
      })),
    )
    .slice(0, 12)
}

/** WelcomeX 推荐提示词：优先真实技能，无则兜底文案 */
export function loadWelcomePrompts(): PromptSkillItem[] {
  const skills = loadPromptSkills()
  return skills.length > 0 ? skills : FALLBACK_PROMPTS
}
