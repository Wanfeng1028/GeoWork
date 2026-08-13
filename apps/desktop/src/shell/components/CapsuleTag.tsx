import { Tag, theme } from 'antd'
import type { TagProps } from 'antd'
import { useMemo } from 'react'

/**
 * CapsuleTag — 胶囊标签
 * 映射 antd Tag，22px 高，状态色 12% 透明度背景，圆角 9999px。
 * 对齐设计系统 §3.4 + §10.1.5
 */
export function CapsuleTag({ color, style, children, ...rest }: TagProps) {
  const { token } = theme.useToken()

  const capsuleStyle = useMemo(
    () => ({
      borderRadius: 9999,
      height: 22,
      lineHeight: '20px',
      paddingInline: 8,
      ...(typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)
        ? { backgroundColor: `${color}1F`, borderColor: `${color}33`, color }
        : {}),
      ...style,
    }),
    [color, style, token.colorPrimary],
  )

  return (
    <Tag style={capsuleStyle} color={color} {...rest}>
      {children}
    </Tag>
  )
}
