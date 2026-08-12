import { Skeleton, theme } from 'antd'
import clsx from 'clsx'

export type PageSkeletonVariant = 'conversation' | 'workspace' | 'list' | 'form'

interface PageSkeletonProps {
  variant: PageSkeletonVariant
  className?: string
}

const { useToken } = theme

function ConversationSkeleton() {
  const { token } = useToken()

  const widths = ['60%', '80%', '70%', '90%']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {widths.map((w, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end',
          }}
        >
          <div
            style={{
              width: w,
              maxWidth: '80%',
              padding: '12px 16px',
              background: token.colorBgContainer,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          </div>
        </div>
      ))}
      <div
        style={{
          marginTop: 8,
          padding: '10px 12px',
          background: token.colorBgElevated,
          borderRadius: token.borderRadius,
          border: `1px solid ${token.colorBorder}`,
        }}
      >
        <Skeleton active paragraph={{ rows: 1 }} title={false} />
      </div>
    </div>
  )
}

function WorkspaceSkeleton() {
  const { token } = useToken()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 32,
              paddingLeft: 12 + (i % 3) * 20,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: token.colorFillSecondary,
                flexShrink: 0,
              }}
            />
            <Skeleton active title={false} paragraph={{ rows: 1, width: `${60 + (i % 4) * 10}%` }} />
          </div>
        ))}
      </div>
      <div
        style={{
          height: 180,
          background: token.colorFillTertiary,
          borderRadius: token.borderRadius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
        }}
      >
        <Skeleton.Image active style={{ width: 140, height: 140 }} />
      </div>
    </div>
  )
}

function ListSkeleton() {
  const { token } = useToken()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div
        style={{
          padding: '16px 0',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Skeleton active title={{ width: '40%' }} paragraph={false} />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: i < 5 ? `1px solid ${token.colorBorderSecondary}` : 'none',
            paddingRight: 16,
          }}
        >
          <Skeleton
            active
            title={false}
            paragraph={{ rows: 1, width: `${50 + (i % 3) * 15}%` }}
            style={{ flex: 1 }}
          />
          <Skeleton
            active
            title={false}
            paragraph={{ rows: 1, width: 60 }}
            style={{ width: 120 }}
          />
        </div>
      ))}
    </div>
  )
}

function FormSkeleton() {
  const { token } = useToken()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Skeleton active title={{ width: 160 }} paragraph={false} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton active title={{ width: `${80 + (i % 3) * 20}px` }} paragraph={false} />
          <div
            style={{
              height: 32,
              background: token.colorFillTertiary,
              borderRadius: token.borderRadius,
            }}
          >
            <Skeleton active title={false} paragraph={{ rows: 1 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton({ variant, className }: PageSkeletonProps) {
  return (
    <div className={clsx('page-skeleton', className)} style={{ padding: 24 }}>
      {variant === 'conversation' && <ConversationSkeleton />}
      {variant === 'workspace' && <WorkspaceSkeleton />}
      {variant === 'list' && <ListSkeleton />}
      {variant === 'form' && <FormSkeleton />}
    </div>
  )
}