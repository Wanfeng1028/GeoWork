import { Segmented, theme } from 'antd'
import type { SegmentedProps } from 'antd'
import { useMemo } from 'react'
import styles from './CapsuleTabs.module.css'

/**
 * CapsuleTabs — 胶囊选项卡
 * 映射 antd Segmented，高 32px，胶囊圆角 9999px。
 * 对齐设计系统 §10.1
 */
export function CapsuleTabs(props: SegmentedProps) {
  const { token } = theme.useToken()

  const capsuleStyle = useMemo(
    () => ({
      borderRadius: 9999,
      padding: 0,
      minHeight: 32,
      '--capsule-track-bg': token.colorBgContainer,
      '--capsule-selected-color': token.colorBgBase === '#0a0f1c' ? '#0a0f1c' : '#ffffff',
    }),
    [token.colorBgContainer, token.colorBgBase],
  )

  return (
    <Segmented
      {...props}
      className={styles.capsule}
      style={{ ...capsuleStyle, ...props.style } as React.CSSProperties}
    />
  )
}
