// GeoWork Model Gateway - Speed Profile Selector
// Visual selector for speed/rate-limit profiles

import { Tag, Tooltip } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import useModelGatewayStore from '../modelGatewayStore'
import styles from './SpeedProfileSelector.module.scss'

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  '1x': '标准速率，默认限制',
  '2x': '加速模式，两倍请求并发',
  'Turbo': '极限加速，请注意成本与限制',
}

export function SpeedProfileSelector() {
  const { speedProfiles, selectedSpeedProfile, setSelectedSpeedProfile, loadSpeedProfiles } = useModelGatewayStore()

  if (speedProfiles.length === 0) {
    loadSpeedProfiles()
    return null
  }

  return (
    <div className={styles.container}>
      <span className={styles.label}>速度配置</span>
      <div className={styles.options}>
        {speedProfiles.map((profile) => {
          const isSelected = selectedSpeedProfile === profile.id
          const isHighCost = profile.tokenBudgetMultiplier > 1.5
          const isTurbo = profile.tokenBudgetMultiplier >= 2

          return (
            <Tooltip
              key={profile.id}
              title={PROFILE_DESCRIPTIONS[profile.id] || profile.name}
              overlayInnerStyle={{ maxWidth: 240 }}
            >
              <div
                className={`${styles.option} ${isSelected ? styles.selected : ''} ${isTurbo ? styles.turbo : ''}`}
                onClick={() => setSelectedSpeedProfile(profile.id)}
              >
                <div className={styles.optionHeader}>
                  <span className={styles.profileName}>
                    {profile.name}
                  </span>
                  {isHighCost && !isSelected && (
                    <WarningOutlined className={styles.warnIcon} />
                  )}
                </div>
                <div className={styles.optionMeta}>
                  <span className={styles.metaItem}>
                    {profile.maxParallelRequests} 并发
                  </span>
                  <span className={`${styles.costBadge} ${isHighCost ? styles.costHigh : ''}`}>
                    ×{profile.tokenBudgetMultiplier.toFixed(1)}
                  </span>
                </div>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

export default SpeedProfileSelector
