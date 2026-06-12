import { GeoComposer } from '../composer/GeoComposer/GeoComposer'
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

function WorkbenchHome() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: 'radial-gradient(circle, rgba(92,184,112,0.15) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)',
      }} />

      {/* Welcome content */}
      <div className="relative z-10 flex flex-col items-center pt-14 pb-16 px-6">
        <div className="w-full max-w-[760px] flex flex-col items-center gap-6">
          {/* Mascot */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(92,184,112,0.2),transparent_65%)] blur-lg animate-[gw-glow_3s_ease-in-out_infinite]" />
            <GeoMascot size="xl" state="idle" />
          </div>

          {/* Header */}
          <div className="text-center">
            <div className="mb-2"><DevBadge mode="short" /></div>
            <h1 className="text-[28px] font-bold text-[var(--gw-text)] tracking-tight leading-tight">
              今天要分析什么？
            </h1>
            <p className="text-[14px] text-[var(--gw-text-tertiary)] mt-1.5">
              用 GeoWork 创建任务、分析数据、运行地理工作流
            </p>
          </div>

          {/* Composer */}
          <div className="w-full">
            <GeoComposer />
          </div>

          {/* Quick entries */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['Research', 'Data', 'GeoCode', 'Analysis', 'Write'].map((mode) => (
              <button
                key={mode}
                className="h-[32px] px-4 rounded-full border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] text-[12px] font-medium text-[var(--gw-text-secondary)] hover:text-[var(--gw-text)] hover:border-[var(--gw-border)] hover:bg-[var(--gw-bg-hover)] transition-all cursor-pointer"
                onClick={() => useShellStore.getState().setActiveMode(mode.toLowerCase() as any)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ComingSoonView({ title }: { title: string }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-6">
      <div className="max-w-[400px] w-full p-8 rounded-xl border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] shadow-[var(--gw-shadow-panel)] text-center">
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
      case 'skills':
        return <Extensions />
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
      case 'mcp':
        return <ComingSoonView title="MCP" />
      case 'gee':
        return <ComingSoonView title="GEE 平台" />
      case 'tasks':
        return <ComingSoonView title="任务" />
      case 'channels':
        return <ComingSoonView title="频道" />
      case 'messaging':
        return <ComingSoonView title="消息入口" />
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
