import { GeoMascot } from '../../brand/GeoMascot'
import { DevBadge } from '../../common/DevBadge'
import useShellStore from '../../../stores/shellStore'
import ExpertPanel from '../../../pages/ExpertPanel/ExpertPanel'
import Extensions from '../../../pages/Extensions/Extensions'
import { Automation } from '../../../pages/Automation/Automation'
import { ProjectFiles } from '../../../pages/ProjectFiles/ProjectFiles'
import { PaperSearch } from '../../../pages/PaperSearch/PaperSearch'
import { KnowledgeBase } from '../../../pages/KnowledgeBase/KnowledgeBase'
import { MapAndLayers } from '../../../pages/MapAndLayers/MapAndLayers'
import { SettingsPage } from '../../../pages/Settings/Settings'
import { WorkbenchHome } from './WorkbenchHome'

function ComingSoonView({ title }: { title: string }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-[var(--gw-bg-canvas)]">
      <div className="max-w-[400px] w-full p-8 rounded-[9px] border border-[var(--gw-border)] bg-[var(--gw-bg-panel)] shadow-[var(--gw-shadow-card)] text-center">
        <div className="flex justify-center mb-4">
          <GeoMascot size="lg" state="thinking" />
        </div>
        <DevBadge mode="short" />
        <h2 className="text-[18px] font-semibold text-[var(--gw-text)] mt-3 mb-2">{title}</h2>
        <p className="text-[13px] text-[var(--gw-text-tertiary)] leading-relaxed">
          该能力仍在开发中。入口已保留，后续会接入真实功能。
        </p>
      </div>
    </div>
  )
}

function ImChannelsView() {
  const items = [
    ['钉钉', '通过钉钉机器人接收并回复用户消息'],
    ['飞书', '通过飞书机器人接收并回复用户消息'],
    ['Lark', '通过 Lark 机器人接收并回复用户消息'],
    ['微信', '连接失败 · 微信登录已过期，可能在其他应用上登录了同一账号'],
    ['企业微信', '通过企业微信机器人接收并回复用户消息'],
  ]

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-[var(--gw-bg-canvas)] text-[var(--gw-text)]">
      <div className="mx-auto mt-[52px] w-[545px] max-w-[calc(100%-32px)] text-center">
        <div className="mb-7 flex justify-center"><GeoMascot size="xl" state="idle" /></div>
        <h1 className="m-0 text-[24px] font-semibold leading-8">IM 频道</h1>
        <p className="mx-auto mt-2 mb-9 w-[430px] max-w-full text-[13px] leading-5 text-[var(--gw-text-secondary)]">
          配置 IM 频道，让 QoderWork 接收来自钉钉、飞书等平台的消息。频道配置信息仅存储在本地，不会上传到云端。
        </p>
        <div className="flex flex-col gap-3 text-left">
          {items.map(([name, desc]) => (
            <div key={name} className="grid min-h-[58px] grid-cols-[34px_minmax(0,1fr)_54px] items-center gap-3 rounded-[7px] border border-[var(--gw-border)] bg-[var(--gw-bg-panel)] px-4">
              <div className="grid h-[28px] w-[28px] place-items-center rounded-[6px] bg-[var(--gw-bg-soft)] text-[12px] font-bold text-[var(--gw-accent)]">{name.slice(0, 1)}</div>
              <div className="min-w-0"><strong className="block text-[13px] leading-[18px]">{name}</strong><span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-4 text-[var(--gw-text-secondary)]">{desc}</span></div>
              <button className="h-[28px] rounded-full bg-[var(--gw-bg-soft)] px-3 text-[12px] font-semibold text-[var(--gw-text)] hover:bg-[var(--gw-bg-hover)]">配置</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MainWorkspace() {
  const { activeNavKey } = useShellStore()

  const renderContent = () => {
    switch (activeNavKey) {
      case 'workbench':
        return <WorkbenchHome />
      case 'expert':
        return <ExpertPanel />
      case 'automation':
      case 'scheduler':
        return <Automation />
      case 'extensions':
        return <Extensions variant="extensions" />
      case 'skills':
        return <Extensions variant="skills" />
      case 'mcp':
        return <Extensions variant="connectors" />
      case 'files':
        return <ProjectFiles />
      case 'papers':
        return <PaperSearch />
      case 'knowledge':
        return <KnowledgeBase />
      case 'map':
        return <MapAndLayers />
      case 'settings':
        return <SettingsPage />
      case 'assistant':
        return <ComingSoonView title="助理系统" />
      case 'gee':
        return <ComingSoonView title="GEE 平台" />
      case 'tasks':
        return <ComingSoonView title="任务" />
      case 'channels':
      case 'messaging':
        return <ImChannelsView />
      default:
        return <WorkbenchHome />
    }
  }

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[var(--gw-bg)]">
      {renderContent()}
    </main>
  )
}
