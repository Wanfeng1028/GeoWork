import { cn } from '../../lib/cn'

interface GeoMascotProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  state?: 'idle' | 'thinking' | 'working' | 'celebrating'
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
}

export function GeoMascot({ size = 'md', state = 'idle', className }: GeoMascotProps) {
  const px = sizeMap[size]
  const isThinking = state === 'thinking'
  const isWorking = state === 'working'
  const isCelebrating = state === 'celebrating'

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        isThinking && 'animate-pulse',
        isWorking && 'animate-bounce',
        isCelebrating && 'animate-bounce',
        className,
      )}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 96 96"
        width={px}
        height={px}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Globe body */}
        <circle
          cx="48"
          cy="52"
          r="32"
          fill="var(--gw-bg-active)"
          stroke="var(--gw-accent)"
          strokeWidth="2"
        />

        {/* Longitude lines */}
        <ellipse
          cx="48"
          cy="52"
          rx="16"
          ry="32"
          stroke="var(--gw-accent)"
          strokeWidth="1"
          opacity="0.3"
        />
        <ellipse
          cx="48"
          cy="52"
          rx="28"
          ry="32"
          stroke="var(--gw-accent)"
          strokeWidth="1"
          opacity="0.2"
        />

        {/* Latitude lines */}
        <ellipse
          cx="48"
          cy="40"
          rx="30"
          ry="6"
          stroke="var(--gw-accent)"
          strokeWidth="1"
          opacity="0.3"
        />
        <line
          x1="16"
          y1="52"
          x2="80"
          y2="52"
          stroke="var(--gw-accent)"
          strokeWidth="1"
          opacity="0.3"
        />
        <ellipse
          cx="48"
          cy="64"
          rx="30"
          ry="6"
          stroke="var(--gw-accent)"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* Compass pin on top */}
        <circle cx="48" cy="20" r="6" fill="var(--gw-accent)" />
        <path
          d="M48 14 L50 20 L48 26 L46 20 Z"
          fill="var(--gw-bg)"
        />

        {/* Eyes */}
        <circle
          cx="38"
          cy="48"
          r="4"
          fill="var(--gw-text)"
          className={isThinking ? 'animate-pulse' : ''}
        />
        <circle
          cx="58"
          cy="48"
          r="4"
          fill="var(--gw-text)"
          className={isThinking ? 'animate-pulse' : ''}
        />

        {/* Pupils - move based on state */}
        <circle
          cx={isWorking ? 40 : 38}
          cy={isCelebrating ? 46 : 48}
          r="1.5"
          fill="var(--gw-bg)"
        />
        <circle
          cx={isWorking ? 60 : 58}
          cy={isCelebrating ? 46 : 48}
          r="1.5"
          fill="var(--gw-bg)"
        />

        {/* Mouth */}
        {isCelebrating ? (
          <path
            d="M40 58 Q48 66 56 58"
            stroke="var(--gw-text)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        ) : isThinking ? (
          <circle cx="48" cy="60" r="2" fill="var(--gw-text-tertiary)" />
        ) : (
          <path
            d="M42 58 Q48 62 54 58"
            stroke="var(--gw-text-tertiary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Thinking dots */}
        {isThinking && (
          <>
            <circle cx="72" cy="32" r="2" fill="var(--gw-accent)" opacity="0.8">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="78" cy="24" r="2.5" fill="var(--gw-accent)" opacity="0.6">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="82" cy="14" r="3" fill="var(--gw-accent)" opacity="0.4">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </svg>
    </div>
  )
}
