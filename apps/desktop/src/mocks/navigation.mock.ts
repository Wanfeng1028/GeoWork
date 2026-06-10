// GeoWork Mock - Navigation Data

export const navigationGroups = [
  {
    label: '智能体',
    key: 'agent',
    items: [
      { key: 'experts', label: '专家系统', icon: '👥' },
      { key: 'assistant', label: '助理系统', icon: '🤖' },
      { key: 'automation', label: '自动化', icon: '⚡' }
    ]
  },
  {
    label: '扩展能力',
    key: 'extensions',
    items: [
      { key: 'skills', label: '技能', icon: '🎯' },
      { key: 'extensions', label: '扩展 / 插件', icon: '🧩' },
      { key: 'mcp', label: 'MCP', icon: '🔌' },
      { key: 'cron', label: '定时任务', icon: '⏰' }
    ]
  },
  {
    label: '知识资料',
    key: 'knowledge',
    items: [
      { key: 'files', label: '文件系统', icon: '📁' },
      { key: 'papers', label: '论文检索', icon: '📄' },
      { key: 'knowledge', label: '知识库', icon: '📚' }
    ]
  },
  {
    label: '地理空间',
    key: 'geo',
    items: [
      { key: 'map', label: '地图与图层', icon: '🗺️' },
      { key: 'gee', label: 'GEE 平台', icon: '🌍' }
    ]
  }
];

export const bottomTabs = [
  { key: 'tasks', label: '任务' },
  { key: 'channels', label: '频道' }
] as const;

export const userCard = {
  avatar: '👤',
  nickname: 'GeoWork User',
  subscription: 'Free',
  settingsKey: 'settings'
};
