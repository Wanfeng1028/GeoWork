import { Segmented, theme } from 'antd'
import type { SegmentedProps } from 'antd'
import { useMemo } from 'react'

/**
 * CapsuleTabs — 胶囊选项卡
 * 映射 antd Segmented，高 32px，padding 0 16px，胶囊圆角 9999px。
 * 对齐设计系统 §10.1.4
 */
export function CapsuleTabs(props: SegmentedProps) {
  const { token } = theme.useToken()

  const capsuleStyle = useMemo(
    () => ({
      borderRadius: 9999,
      padding: 0,
      minHeight: 32,
      '--ant-segmented-item-selected-bg': token.colorPrimary,
    }),
    [token.colorPrimary],
  )

  return <Segmented {...props} style={{ ...capsuleStyle, ...props.style }} />
}
