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
    <div className="flex-1">
      <div className="border">
        <div >
          <GeoMascot size="lg" state="thinking" />
        </div>
        <DevBadge mode="short" />
        <h2 >{title}</h2>
        <p >
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
    <div className="flex-1">
      <div >
        <div ><GeoMascot size="xl" state="idle" /></div>
        <h1 >IM 频道</h1>
        <p >
          配置 IM 频道，让 QoderWork 接收来自钉钉、飞书等平台的消息。频道配置信息仅存储在本地，不会上传到云端。
        </p>
        <div className="flex-col">
          {items.map(([name, desc]) => (
            <div key={name} className="grid-cols-[34px_minmax(0,1fr)_54px] border">
              <div >{name.slice(0, 1)}</div>
              <div ><strong >{name}</strong><span >{desc}</span></div>
              <button >配置</button>
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
    <main className="flex-1 flex-col">
      {renderContent()}
    </main>
  )
}
