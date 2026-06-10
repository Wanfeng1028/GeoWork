// GeoWork MainWorkspace

import { GeoComposer } from '../composer/GeoComposer/GeoComposer'
import { ChatTimeline } from '../chat/ChatTimeline/ChatTimeline'
import useShellStore from '../../../stores/shellStore'
import styles from './MainWorkspace.module.scss'

export function MainWorkspace() {
  const { activeMode } = useShellStore()

  return (
    <main className={styles.main}>
      <div className={styles.modeIndicator}>
        当前模式: {activeMode}
      </div>
      
      <GeoComposer />
      
      <ChatTimeline />
    </main>
  )
}
