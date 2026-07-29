// GeoWork ConversationMinimap

import useShellStore from '../../stores/shellStore'
import useChatStore from '../../stores/chatStore'
import styles from './ConversationMinimap.module.scss'

export function ConversationMinimap() {
  const { conversationMinimapEnabled } = useShellStore()
  const { messages } = useChatStore()

  if (!conversationMinimapEnabled || messages.length === 0) {
    return null
  }

  return (
    <div className={styles.minimap}>
      {messages.map((msg, index) => (
        <div
          key={msg.id}
          className={`${styles.minimapItem} ${styles[msg.role]}`}
          title={`${msg.role}: ${msg.content.substring(0, 50)}`}
        />
      ))}
    </div>
  )
}
