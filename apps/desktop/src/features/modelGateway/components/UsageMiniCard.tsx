// GeoWork Model Gateway - Usage Mini Card
// Compact card showing token usage, request counts, and speed profile breakdown

import useModelGatewayStore from '../modelGatewayStore'
import styles from './UsageMiniCard.module.scss'

export function UsageMiniCard() {
  const { usageSummary } = useModelGatewayStore()

  if (!usageSummary) return null

  const { totalTokens, totalRequests, modelUsage, speedUsage } = usageSummary

  const topModels = Object.entries(modelUsage)
    .sort(([, a], [, b]) => b.tokens - a.tokens)
    .slice(0, 3)

  const speedEntries = Object.entries(speedUsage).filter(([, v]) => v > 0)

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return `${n}`
  }

  return (
    <div className={styles.card}>
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.label}>Tokens</span>
          <span className={styles.value} style={{ color: 'var(--gw-accent)' }}>
            {formatTokens(totalTokens)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>请求</span>
          <span className={styles.value}>{totalRequests}</span>
        </div>
      </div>

      {topModels.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Top 模型</span>
          {topModels.map(([name, data]) => {
            const pct = totalTokens > 0 ? (data.tokens / totalTokens) * 100 : 0
            return (
              <div className={styles.modelRow} key={name}>
                <span className={styles.modelName}>{name}</span>
                <div className={styles.modelBar}>
                  <div
                    className={styles.modelBarFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={styles.modelPct}>{formatTokens(data.tokens)}</span>
              </div>
            )
          })}
        </div>
      )}

      {speedEntries.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>速度配置</span>
          <div className={styles.speedRows}>
            {speedEntries.map(([profile, count]) => (
              <div className={styles.speedRow} key={profile}>
                <span className={styles.speedLabel}>{profile}</span>
                <span className={styles.speedCount}>{count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default UsageMiniCard
