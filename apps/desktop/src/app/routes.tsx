import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../shell/AppShell'
// ThemePreview 仅开发调试用，生产环境下线
// import { ThemePreviewPage } from '../pages/ThemePreview/ThemePreviewPage'

/* A5（doc/23）：路由级代码分割——每个页面独立 chunk，按需加载。
 * AppShell 保持静态导入（所有路由共享的壳）；页面经 react-router lazy
 * 在首次导航时拉取，主包不再携带全部页面代码。 */

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('../pages/Welcome')).WelcomePage }),
      },
      {
        path: 'new-task',
        lazy: async () => ({
          Component: (await import('../pages/NewTask/NewTaskPage')).NewTaskPage,
        }),
      },
      {
        path: 'workspace',
        lazy: async () => ({
          Component: (await import('../pages/Workspace/WorkspacePage')).WorkspacePage,
        }),
      },
      {
        path: 'data-center',
        lazy: async () => ({
          Component: (await import('../pages/DataCenter/DataCenterPage')).DataCenterPage,
        }),
      },
      {
        path: 'tasks',
        lazy: async () => ({ Component: (await import('../pages/Tasks/TasksPage')).TasksPage }),
      },
      {
        path: 'settings',
        lazy: async () => ({
          Component: (await import('../pages/Settings/SettingsPage')).SettingsPage,
        }),
      },
      {
        path: 'about',
        lazy: async () => ({ Component: (await import('../pages/Settings/AboutPage')).AboutPage }),
      },
      {
        path: 'agent-studio',
        lazy: async () => ({
          Component: (await import('../pages/AgentStudio/AgentStudioPage')).AgentStudioPage,
        }),
      },
      {
        path: 'mobile-control',
        lazy: async () => ({
          Component: (await import('../pages/MobileControl/MobileControlPage')).MobileControlPage,
        }),
      },
      {
        path: 'extensions/experts',
        lazy: async () => ({
          Component: (await import('../pages/Extensions/ExpertsPage')).ExpertsPage,
        }),
      },
      {
        path: 'extensions/skills',
        lazy: async () => ({
          Component: (await import('../pages/Extensions/SkillsPage')).SkillsPage,
        }),
      },
      {
        path: 'extensions/mcp',
        lazy: async () => ({ Component: (await import('../pages/Extensions/McpPage')).McpPage }),
      },
      {
        path: 'extensions/connectors',
        lazy: async () => ({
          Component: (await import('../pages/Extensions/ConnectorsPage')).ConnectorsPage,
        }),
      },
      // ThemePreview 仅开发调试用，生产环境下线
      // { path: 'theme-preview', element: <ThemePreviewPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
