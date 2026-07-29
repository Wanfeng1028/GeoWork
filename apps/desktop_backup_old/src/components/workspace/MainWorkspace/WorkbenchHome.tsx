import { ChevronDown, FolderOpen } from 'lucide-react'
import { GeoComposer } from '../composer/GeoComposer/GeoComposer'
import useShellStore from '../../../stores/shellStore'
import styles from './MainWorkspace.module.scss'

export function WorkbenchHome() {
  const setActiveNavKey = useShellStore((s) => s.setActiveNavKey)

  return (
    <div className={styles.home}>
      <div className={styles.dotGrid} aria-hidden="true" />

      <div className={styles.homeInner}>
        <div className={styles.mascotWrap}>
          <div className={styles.mascotGlow} aria-hidden="true" />
          <QoderMascot />
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>不止聊天，搞定一切</h1>
          <p className={styles.subtitle}>本地运行、自主规划、安全可控的 AI 工作搭子</p>
        </div>

        <div className={styles.composerWrap}>
          <GeoComposer />
        </div>

        <button className={styles.folderSelect} onClick={() => setActiveNavKey('files')}>
          <FolderOpen size={14} />
          选择工作目录
          <ChevronDown size={13} />
        </button>

        <PromoCard />
      </div>

      <button
        className={styles.edgeHandle}
        onClick={() => setActiveNavKey('tasks')}
        title="打开任务"
        aria-label="打开任务"
      >
        ?
      </button>
    </div>
  )
}

function QoderMascot() {
  return (
    <div className={styles.qoderMascot} aria-hidden="true">
      <span className={styles.curl} />
      <span className={`${styles.eyeWhite} ${styles.leftWhite}`} />
      <span className={`${styles.eyeWhite} ${styles.rightWhite}`} />
      <span className={`${styles.eye} ${styles.leftEye}`} />
      <span className={`${styles.eye} ${styles.rightEye}`} />
      <span className={styles.beak} />
    </div>
  )
}

function PromoCard() {
  return (
    <div className={styles.promo}>
      <div className={styles.giftArt} aria-hidden="true">
        <div className={styles.giftBox} />
        <div className={styles.giftRibbon} />
        <div className={styles.giftLeaf} />
        <div className={styles.giftTag} />
      </div>
      <div className={styles.promoCopy}>
        <strong>新用户首登立领2000积分，教师/学生认证再送4000积分</strong>
        <span>2000积分含新用户注册时赠送的300积分，查看 <em>教师/学生认证</em> 和 <em>活动规则</em></span>
      </div>
      <button>已领取</button>
    </div>
  )
}
