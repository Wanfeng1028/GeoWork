import { Button, theme } from 'antd'
import type { ButtonProps } from 'antd'
import { useMemo } from 'react'

/**
 * CapsuleButton — 胶囊主按钮
 * 映射 antd Button + shape="round"，直接引用 token.colorPrimary 系，不硬编码色值。
 * 对齐设计系统 §10.1.3
 */
export function CapsuleButton({
  type = 'primary',
  shape = 'round',
  size,
  style,
  children,
  ...rest
}: ButtonProps) {
  const { token } = theme.useToken()

  const capsuleStyle = useMemo(
    () => ({
      borderRadius: 9999,
      ...(type === 'primary'
        ? {
            color: token.colorTextLightSolid,
          }
        : {}),
      ...style,
    }),
    [token.colorTextLightSolid, type, style],
  )

  return (
    <Button type={type} shape={shape} size={size} style={capsuleStyle} {...rest}>
      {children}
    </Button>
  )
}
