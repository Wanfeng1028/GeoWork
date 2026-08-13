import { Empty, theme } from 'antd'
import type { ReactNode } from 'react'

export type EmptyStateSize = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  size?: EmptyStateSize
}

const SIZE_CONFIG: Record<
  EmptyStateSize,
  { iconSize: number; titleSize: number; descSize: number }
> = {
  sm: { iconSize: 80, titleSize: 14, descSize: 12 },
  md: { iconSize: 120, titleSize: 16, descSize: 13 },
  lg: { iconSize: 160, titleSize: 20, descSize: 14 },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  const { token } = theme.useToken()
  const config = SIZE_CONFIG[size]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        width: '100%',
        height: '100%',
        minHeight: 200,
      }}
    >
      <Empty
        image={
          icon ? (
            <div style={{ fontSize: config.iconSize, color: token.colorFill }}>
              {icon}
            </div>
          ) : (
            <div style={{ height: config.iconSize, opacity: 0.6 }}>
              {Empty.PRESENTED_IMAGE_SIMPLE}
            </div>
          )
        }
        imageStyle={{
          height: config.iconSize,
          marginBottom: 16,
        }}
        description={
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: config.titleSize,
                fontWeight: 500,
                color: token.colorTextHeading,
                marginBottom: description ? 4 : 0,
              }}
            >
              {title}
            </div>
            {description && (
              <div
                style={{
                  fontSize: config.descSize,
                  color: token.colorTextDescription,
                  lineHeight: 1.6,
                }}
              >
                {description}
              </div>
            )}
          </div>
        }
      >
        {action && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            {action}
          </div>
        )}
      </Empty>
    </div>
  )
}