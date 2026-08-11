import { theme as antTheme } from 'antd'
import type { ConfigProviderProps } from 'antd'

// 对应 doc/前端设计系统.md 第三节 editorial-dark
// 关键：显式覆写所有派生 token，不依赖 antd 6 自动派生（避免高饱和青发灰）
export function useEditorialDarkTheme(): ConfigProviderProps {
  return {
    theme: {
      algorithm: antTheme.darkAlgorithm,
      token: {
        // ── 品牌/状态色（3.4）──
        colorPrimary: '#3186ff',
        colorPrimaryHover: '#4f9dff',
        colorPrimaryActive: '#2673e6',
        colorPrimaryBg: 'rgba(49, 134, 255, 0.10)',
        colorPrimaryBgHover: 'rgba(49, 134, 255, 0.16)',
        colorPrimaryBorder: 'rgba(49, 134, 255, 0.25)',
        colorPrimaryBorderHover: 'rgba(49, 134, 255, 0.40)',
        colorPrimaryText: '#3186ff',
        colorPrimaryTextHover: '#4f9dff',
        colorPrimaryTextActive: '#2673e6',

        colorSuccess: '#8BFFE2',
        colorSuccessBg: 'rgba(139, 255, 226, 0.08)',
        colorSuccessBorder: 'rgba(139, 255, 226, 0.25)',
        colorSuccessText: '#8BFFE2',

        colorWarning: '#F4D77E',
        colorWarningBg: 'rgba(244, 215, 126, 0.08)',
        colorWarningBorder: 'rgba(244, 215, 126, 0.25)',
        colorWarningText: '#F4D77E',

        colorError: '#ff6b6b',
        colorErrorBg: 'rgba(255, 107, 107, 0.08)',
        colorErrorBorder: 'rgba(255, 107, 107, 0.25)',
        colorErrorText: '#ff6b6b',

        colorInfo: '#3186ff',
        colorInfoBg: 'rgba(58, 217, 255, 0.08)',
        colorInfoText: '#3186ff',
        colorLink: '#3186ff',
        colorLinkHover: '#4f9dff',
        colorLinkActive: '#2673e6',

        // ── 背景 / 容器 / 文字（3.2 / 3.5）──
        colorBgBase: '#0a0f1c',
        colorBgLayout: '#0a0f1c',
        colorBgContainer: '#121829',
        colorBgElevated: '#1b2338',
        colorBgSpotlight: '#232d45',
        colorFillSecondary: 'rgba(255,255,255,0.04)',
        colorFillTertiary: 'rgba(255,255,255,0.03)',

        colorText: 'rgba(255,255,255,0.90)',
        colorTextSecondary: 'rgba(255,255,255,0.60)',
        colorTextTertiary: 'rgba(255,255,255,0.35)',
        colorTextQuaternary: 'rgba(255,255,255,0.20)',
        colorTextDisabled: 'rgba(255,255,255,0.20)',

        // ── 边框（3.3）──
        colorBorder: 'rgba(255,255,255,0.06)',
        colorBorderSecondary: 'rgba(255,255,255,0.04)',

        // ── 圆角 / 间距 / 高度（4）──
        borderRadius: 8,
        borderRadiusLG: 12,
        borderRadiusSM: 4,
        borderRadiusXS: 4,
        borderRadiusOuter: 8,
        controlHeight: 34,
        controlHeightLG: 40,
        controlHeightSM: 28,

        // ── 字体（5）──
        fontFamily: "'Inter', 'MiSans', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
        fontFamilyCode: "'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace",
        fontSize: 13,
        fontSizeLG: 14,
        fontSizeSM: 12,

        // ── 线宽 / 阴影（3.3）──
        lineWidth: 1,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      },

      components: {
        // ── 6.1 Button ──
        Button: {
          borderRadius: 8,
          controlHeight: 34,
          controlHeightLG: 40,
          controlHeightSM: 28,
          paddingContentHorizontal: 14,
          primaryColor: '#0a0f1c', // 主按钮深字
          colorPrimary: '#3186ff',
          colorPrimaryHover: '#4f9dff',
          colorPrimaryActive: '#2673e6',
          defaultBg: 'rgba(255,255,255,0.06)',
          defaultHoverBg: 'rgba(255,255,255,0.10)',
          defaultActiveBg: 'rgba(255,255,255,0.08)',
          defaultBorderColor: 'transparent',
          defaultColor: 'rgba(255,255,255,0.90)',
          textTextColor: 'rgba(255,255,255,0.60)',
          textHoverBg: 'rgba(255,255,255,0.05)',
        },

        // ── 6.2 Menu ──
        Menu: {
          itemHeight: 36,
          itemBorderRadius: 8,
          itemPaddingInline: 12,
          itemColor: 'rgba(255,255,255,0.60)',
          itemHoverBg: 'rgba(255,255,255,0.05)',
          itemHoverColor: 'rgba(255,255,255,0.90)',
          itemSelectedBg: 'rgba(49, 134, 255, 0.10)',
          itemSelectedColor: 'rgba(255,255,255,0.90)',
          subMenuItemBg: 'transparent',
          iconSize: 16,
        },

        // ── 6.3 Card ──
        Card: {
          borderRadiusLG: 12,
          colorBgContainer: '#121829',
          colorBorderSecondary: 'rgba(255,255,255,0.06)',
          boxShadowTertiary: 'none',
          paddingLG: 16,
        },

        // ── 6.4 Input ──
        Input: {
          borderRadius: 8,
          controlHeight: 34,
          colorBgContainer: 'rgba(255,255,255,0.04)',
          colorBorder: 'rgba(255,255,255,0.08)',
          hoverBorderColor: 'rgba(49, 134, 255, 0.25)',
          activeBorderColor: '#3186ff',
          activeShadow: '0 0 0 2px rgba(49, 134, 255, 0.15)',
          colorTextPlaceholder: 'rgba(255,255,255,0.35)',
        },

        // ── 6.5 Table ──
        Table: {
          headerBg: 'transparent',
          headerColor: 'rgba(255,255,255,0.60)',
          headerSplitColor: 'rgba(255,255,255,0.06)',
          rowHoverBg: 'rgba(255,255,255,0.03)',
          borderColor: 'rgba(255,255,255,0.04)',
          cellPaddingBlock: 12,
          cellPaddingInline: 16,
        },

        // ── 6.6 Modal / Tooltip / Popover ──
        Modal: {
          borderRadiusLG: 12,
          colorBgElevated: '#1b2338',
        },
        Tooltip: {
          borderRadius: 4,
          colorBgSpotlight: '#232d45',
          fontSize: 12,
          paddingXS: 8,
        },

        // ── 6.7 Tag ──
        Tag: {
          borderRadiusSM: 4,
          fontSizeSM: 12,
          defaultBg: 'rgba(255,255,255,0.06)',
          defaultColor: 'rgba(255,255,255,0.60)',
        },

        // ── 7.1 Segmented ──
        Segmented: {
          itemColor: 'rgba(255,255,255,0.60)',
          itemHoverBg: 'rgba(255,255,255,0.05)',
          itemSelectedBg: '#121829',
          itemSelectedColor: 'rgba(255,255,255,0.90)',
          trackBg: '#232d45',
          trackPadding: 4,
          borderRadius: 8,
          borderRadiusSM: 6,
        },
      },
    },
  }
}
