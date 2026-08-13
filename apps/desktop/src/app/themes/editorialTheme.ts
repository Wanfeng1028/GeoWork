import type { ConfigProviderProps } from 'antd'

// 对应 doc/前端设计系统.md 第三节 editorial-light
// 关键：亮色主色用可访问深青 #1d4ed8，不用品牌亮蓝直接怼白底
export function useEditorialTheme(): ConfigProviderProps {
  return {
    theme: {
      token: {
        // ── 品牌/状态色（3.4，亮色可访问变体）──
        colorPrimary: '#1d4ed8',
        colorPrimaryHover: '#3b82f6',
        colorPrimaryActive: '#1e40af',
        colorPrimaryBg: 'rgba(29, 78, 216, 0.06)',
        colorPrimaryBgHover: 'rgba(29, 78, 216, 0.10)',
        colorPrimaryBorder: 'rgba(29, 78, 216, 0.20)',
        colorPrimaryBorderHover: 'rgba(29, 78, 216, 0.35)',
        colorPrimaryText: '#1d4ed8',
        colorPrimaryTextHover: '#3b82f6',
        colorPrimaryTextActive: '#1e40af',

        colorSuccess: '#0f766e',
        colorSuccessBg: 'rgba(15, 118, 110, 0.06)',
        colorSuccessBorder: 'rgba(15, 118, 110, 0.20)',
        colorSuccessText: '#0f766e',

        colorWarning: '#b45309',
        colorWarningBg: 'rgba(180, 83, 9, 0.06)',
        colorWarningBorder: 'rgba(180, 83, 9, 0.20)',
        colorWarningText: '#b45309',

        colorError: '#dc2626',
        colorErrorBg: 'rgba(220, 38, 38, 0.06)',
        colorErrorBorder: 'rgba(220, 38, 38, 0.20)',
        colorErrorText: '#dc2626',

        colorInfo: '#1d4ed8',
        colorInfoBg: 'rgba(29, 78, 216, 0.06)',
        colorInfoText: '#1d4ed8',
        colorLink: '#1d4ed8',
        colorLinkHover: '#3b82f6',
        colorLinkActive: '#1e40af',

        // ── 背景 / 容器 / 文字（3.2 / 3.5）──
        colorBgBase: '#f7f8fa',
        colorBgLayout: '#f7f8fa',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#f1f4f8',
        colorBgSpotlight: '#e8edf4',
        colorFillSecondary: 'rgba(15,23,42,0.03)',
        colorFillTertiary: 'rgba(15,23,42,0.02)',

        colorText: '#0f172a',
        colorTextSecondary: '#475569',
        colorTextTertiary: '#94a3b8',
        colorTextQuaternary: '#cbd5e1',
        colorTextDisabled: '#cbd5e1',

        // ── 边框（3.3）──
        colorBorder: 'rgba(15,23,42,0.08)',
        colorBorderSecondary: 'rgba(15,23,42,0.05)',

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
        boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
      },

      components: {
        // ── 6.1 Button ──
        Button: {
          borderRadius: 9999,
          controlHeight: 34,
          controlHeightLG: 40,
          controlHeightSM: 28,
          paddingContentHorizontal: 14,
          primaryColor: '#ffffff',
          colorPrimary: '#1d4ed8',
          colorPrimaryHover: '#3b82f6',
          colorPrimaryActive: '#1e40af',
          defaultBg: 'rgba(15,23,42,0.04)',
          defaultHoverBg: 'rgba(15,23,42,0.07)',
          defaultActiveBg: 'rgba(15,23,42,0.06)',
          defaultBorderColor: 'transparent',
          defaultColor: '#0f172a',
          textTextColor: '#475569',
          textHoverBg: 'rgba(15,23,42,0.04)',
        },

        // ── 6.2 Menu ──
        Menu: {
          itemHeight: 36,
          itemBorderRadius: 8,
          itemPaddingInline: 12,
          itemColor: '#475569',
          itemHoverBg: 'rgba(15,23,42,0.04)',
          itemHoverColor: '#0f172a',
          itemSelectedBg: 'rgba(29, 78, 216, 0.06)',
          itemSelectedColor: '#0f172a',
          subMenuItemBg: 'transparent',
          iconSize: 16,
        },

        // ── 6.3 Card ──
        Card: {
          borderRadiusLG: 12,
          colorBgContainer: '#ffffff',
          colorBorderSecondary: 'rgba(15,23,42,0.08)',
          boxShadowTertiary: 'none',
          paddingLG: 16,
        },

        // ── 6.4 Input ──
        Input: {
          borderRadius: 8,
          controlHeight: 34,
          colorBgContainer: 'rgba(15,23,42,0.03)',
          colorBorder: 'rgba(15,23,42,0.10)',
          hoverBorderColor: 'rgba(14,116,144,0.25)',
          activeBorderColor: '#1d4ed8',
          activeShadow: '0 0 0 2px rgba(14,116,144,0.12)',
          colorTextPlaceholder: '#94a3b8',
        },

        // ── 6.5 Table ──
        Table: {
          headerBg: 'transparent',
          headerColor: '#475569',
          headerSplitColor: 'rgba(15,23,42,0.08)',
          rowHoverBg: 'rgba(15,23,42,0.02)',
          borderColor: 'rgba(15,23,42,0.05)',
          cellPaddingBlock: 12,
          cellPaddingInline: 16,
        },

        // ── 6.6 Modal / Tooltip / Popover ──
        Modal: {
          borderRadiusLG: 12,
          colorBgElevated: '#ffffff',
        },
        Tooltip: {
          borderRadius: 4,
          colorBgSpotlight: '#1e293b',
          fontSize: 12,
          paddingXS: 8,
        },

        // ── 6.7 Tag ──
        Tag: {
          borderRadiusSM: 4,
          fontSizeSM: 12,
          defaultBg: 'rgba(15,23,42,0.05)',
          defaultColor: '#475569',
        },

        // ── 7.1 Segmented ──
        Segmented: {
          itemColor: '#475569',
          itemHoverBg: 'rgba(15,23,42,0.04)',
          itemSelectedBg: '#ffffff',
          itemSelectedColor: '#0f172a',
          trackBg: '#e8edf4',
          trackPadding: 4,
          borderRadius: 8,
          borderRadiusSM: 6,
        },
      },
    },
  }
}
