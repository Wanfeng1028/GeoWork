// GeoWork MainWorkspace

import { DevBadge } from '../../common/DevBadge'
import { GeoComposer } from '../composer/GeoComposer/GeoComposer'
import { GeoMascot } from '../../brand/GeoMascot'
import useShellStore from '../../../stores/shellStore'
import ExpertPanel from '../../../pages/ExpertPanel/ExpertPanel'
import Extensions from '../../../pages/Extensions/Extensions'
import { Automation } from '../../../pages/Automation/Automation'
import { ProjectFiles } from '../../../pages/ProjectFiles/ProjectFiles'
import { PaperSearch } from '../../../pages/PaperSearch/PaperSearch'
import { KnowledgeBase } from '../../../pages/KnowledgeBase/KnowledgeBase'
import { MapAndLayers } from '../../../pages/MapAndLayers/MapAndLayers'
import { SettingsPage } from '../../../pages/Settings/Settings'
import styles from './MainWorkspace.module.scss'

function WorkbenchHome() {
  return (
    <div className={styles.home}>
      <div className={styles.dotField} />
      <section className={styles.hero}>
        <div className={styles.mascot} aria-hidden="true">
          <div className={styles.mascotHalo} />
          <GeoMascot size="xl" state="idle" />
        </div>

        <div className={styles.heroHeader}>
          <DevBadge mode="short" />
          <h1>GeoWork</h1>
          <p>GIS、遥感、论文、GEE 与自动化的本地 AI 工作台</p>
        </div>

        <GeoComposer />

        <div className={styles.workspaceStrip}>
          <button>本地工作区</button>
          <button>遥感实验</button>
          <button>论文资料</button>
          <button>GEE 脚本</button>
        </div>
      </section>
    </div>
  )
}

function ComingSoonView({ title }: { title: string }) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderPanel}>
        <GeoMascot size="lg" state="thinking" />
        <DevBadge mode="short" />
        <h2>{title}</h2>
        <p>该能力仍在开发中。入口已保留，后续会接入真实功能。</p>
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

  return <main className={styles.main}>{renderContent()}</main>
}
