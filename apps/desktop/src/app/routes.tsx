import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../shell/AppShell'
import { WorkspacePage } from '../pages/Workspace/WorkspacePage'
import { DataCenterPage } from '../pages/DataCenter/DataCenterPage'
import { TasksPage } from '../pages/Tasks/TasksPage'
import { SettingsPage } from '../pages/Settings/SettingsPage'
import { AboutPage } from '../pages/Settings/AboutPage'
import { AgentStudioPage } from '../pages/AgentStudio/AgentStudioPage'
// ThemePreview 仅开发调试用，生产环境下线
// import { ThemePreviewPage } from '../pages/ThemePreview/ThemePreviewPage'
import { NewTaskPage } from '../pages/NewTask/NewTaskPage'
import { ExpertsPage } from '../pages/Extensions/ExpertsPage'
import { SkillsPage } from '../pages/Extensions/SkillsPage'
import { McpPage } from '../pages/Extensions/McpPage'
import { ConnectorsPage } from '../pages/Extensions/ConnectorsPage'
import { MobileControlPage } from '../pages/MobileControl/MobileControlPage'
import { WelcomePage } from '../pages/Welcome'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <WelcomePage /> },
      { path: 'new-task', element: <NewTaskPage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      { path: 'data-center', element: <DataCenterPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'agent-studio', element: <AgentStudioPage /> },
      { path: 'mobile-control', element: <MobileControlPage /> },
      { path: 'extensions/experts', element: <ExpertsPage /> },
      { path: 'extensions/skills', element: <SkillsPage /> },
      { path: 'extensions/mcp', element: <McpPage /> },
      { path: 'extensions/connectors', element: <ConnectorsPage /> },
      // ThemePreview 仅开发调试用，生产环境下线
      // { path: 'theme-preview', element: <ThemePreviewPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
