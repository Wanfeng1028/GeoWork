import { Button, theme } from 'antd'
import type { ButtonProps } from 'antd'
import { useMemo } from 'react'

/**
 * CapsuleGhost — 胶囊幽灵按钮
 * 映射 antd Button ghost + shape="round"，透明底 + 1px colorBorder。
 * 对齐设计系统 §10.1.3
 */
export function CapsuleGhost({
  shape = 'round',
  size,
  style,
  children,
  ...rest
}: ButtonProps) {
  const { token } = theme.useToken()

  const ghostStyle = useMemo(
    () => ({
      borderRadius: 9999,
      background: 'transparent',
      border: `1px solid ${token.colorBorder}`,
      color: token.colorText,
      ...style,
    }),
    [token.colorBorder, token.colorText, style],
  )

  return (
    <Button shape={shape} size={size} style={ghostStyle} {...rest}>
      {children}
    </Button>
  )
}
