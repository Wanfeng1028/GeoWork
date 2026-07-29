import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../shell/AppShell'
import { WorkspacePage } from '../pages/Workspace/WorkspacePage'
import { DataCenterPage } from '../pages/DataCenter/DataCenterPage'
import { TasksPage } from '../pages/Tasks/TasksPage'
import { SettingsPage } from '../pages/Settings/SettingsPage'
import { AgentStudioPage } from '../pages/AgentStudio/AgentStudioPage'
import { ThemePreviewPage } from '../pages/ThemePreview/ThemePreviewPage'
import { NewTaskPage } from '../pages/NewTask/NewTaskPage'
import { ExpertsPage } from '../pages/Extensions/ExpertsPage'
import { SkillsPage } from '../pages/Extensions/SkillsPage'
import { McpPage } from '../pages/Extensions/McpPage'
import { ConnectorsPage } from '../pages/Extensions/ConnectorsPage'
import { MobileControlPage } from '../pages/MobileControl/MobileControlPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/new-task" replace /> },
      { path: 'new-task', element: <NewTaskPage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      { path: 'data-center', element: <DataCenterPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'agent-studio', element: <AgentStudioPage /> },
      { path: 'mobile-control', element: <MobileControlPage /> },
      { path: 'extensions/experts', element: <ExpertsPage /> },
      { path: 'extensions/skills', element: <SkillsPage /> },
      { path: 'extensions/mcp', element: <McpPage /> },
      { path: 'extensions/connectors', element: <ConnectorsPage /> },
      { path: 'theme-preview', element: <ThemePreviewPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
