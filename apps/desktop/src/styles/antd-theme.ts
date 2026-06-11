import { theme, type ThemeConfig } from 'antd'

export const geoworkTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: { colorPrimary: '#1677ff', borderRadius: 10, fontFamily: 'Microsoft YaHei, Segoe UI, system-ui, sans-serif' },
  components: { Layout: { bodyBg: '#f5f7fb', headerBg: '#ffffff', siderBg: '#ffffff' }, Table: { headerBg: '#f8fafc' } }
}

export const antdTheme = geoworkTheme
