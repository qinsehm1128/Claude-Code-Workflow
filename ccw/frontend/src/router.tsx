// ========================================
// Router Configuration
// ========================================
// React Router v6 configuration with all dashboard routes

import { createBrowserRouter, RouteObject, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import {
  HomePage,
  SessionsPage,
  FixSessionPage,
  ProjectOverviewPage,
  SessionDetailPage,
  HistoryPage,
  OrchestratorPage,
  LoopMonitorPage,
  IssueHubPage,
  SkillsManagerPage,
  CommandsManagerPage,
  MemoryPage,
  SettingsPage,
  NotFoundPage,
  LiteTasksPage,
  // LiteTaskDetailPage removed - now using TaskDrawer instead
  ReviewSessionPage,
  McpManagerPage,
  EndpointsPage,
  InstallationsPage,
  HookManagerPage,
  RulesManagerPage,
  PromptHistoryPage,
  ExplorerPage,
  GraphExplorerPage,
  CodexLensManagerPage,
  ApiSettingsPage,
  CliViewerPage,
  CliSessionSharePage,
  TeamPage,
} from '@/pages';

/**
 * Route configuration for the dashboard
 * All routes are wrapped in AppShell layout
 */
const routes: RouteObject[] = [
  {
    path: 'cli-sessions/share',
    element: <CliSessionSharePage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'sessions',
        element: <SessionsPage />,
      },
      {
        path: 'sessions/:sessionId',
        element: <SessionDetailPage />,
      },
      {
        path: 'sessions/:sessionId/fix',
        element: <FixSessionPage />,
      },
      {
        path: 'sessions/:sessionId/review',
        element: <ReviewSessionPage />,
      },
      {
        path: 'lite-tasks',
        element: <LiteTasksPage />,
      },
      // /lite-tasks/:sessionId route removed - now using TaskDrawer
      {
        path: 'project',
        element: <ProjectOverviewPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'orchestrator',
        element: <OrchestratorPage />,
      },
      {
        path: 'loops',
        element: <LoopMonitorPage />,
      },
      {
        path: 'cli-viewer',
        element: <CliViewerPage />,
      },
      {
        path: 'issues',
        element: <IssueHubPage />,
      },
      // Legacy routes - redirect to hub with tab parameter
      {
        path: 'issues/queue',
        element: <Navigate to="/issues?tab=queue" replace />,
      },
      {
        path: 'issues/discovery',
        element: <Navigate to="/issues?tab=discovery" replace />,
      },
      {
        path: 'skills',
        element: <SkillsManagerPage />,
      },
      {
        path: 'commands',
        element: <CommandsManagerPage />,
      },
      {
        path: 'memory',
        element: <MemoryPage />,
      },
      {
        path: 'prompts',
        element: <PromptHistoryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'settings/mcp',
        element: <McpManagerPage />,
      },
      {
        path: 'settings/endpoints',
        element: <EndpointsPage />,
      },
      {
        path: 'settings/installations',
        element: <InstallationsPage />,
      },
      {
        path: 'settings/rules',
        element: <RulesManagerPage />,
      },
      {
        path: 'settings/codexlens',
        element: <CodexLensManagerPage />,
      },
      {
        path: 'api-settings',
        element: <ApiSettingsPage />,
      },
      {
        path: 'hooks',
        element: <HookManagerPage />,
      },
      {
        path: 'explorer',
        element: <ExplorerPage />,
      },
      {
        path: 'graph',
        element: <GraphExplorerPage />,
      },
      {
        path: 'teams',
        element: <TeamPage />,
      },
      // Catch-all route for 404
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

/**
 * Create the browser router instance
 * Uses basename from Vite's BASE_URL environment variable
 */
const basename = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export const router = createBrowserRouter(routes, {
  basename,
});

/**
 * Export route paths for type-safe navigation
 */
export const ROUTES = {
  HOME: '/',
  SESSIONS: '/sessions',
  SESSION_DETAIL: '/sessions/:sessionId',
  FIX_SESSION: '/sessions/:sessionId/fix',
  REVIEW_SESSION: '/sessions/:sessionId/review',
  LITE_TASKS: '/lite-tasks',
  // LITE_TASK_DETAIL removed - now using TaskDrawer
  PROJECT: '/project',
  HISTORY: '/history',
  ORCHESTRATOR: '/orchestrator',
  LOOPS: '/loops',
  CLI_VIEWER: '/cli-viewer',
  ISSUES: '/issues',
  // Legacy issue routes - use ISSUES with ?tab parameter instead
  ISSUE_QUEUE: '/issues?tab=queue',
  ISSUE_DISCOVERY: '/issues?tab=discovery',
  SKILLS: '/skills',
  COMMANDS: '/commands',
  MEMORY: '/memory',
  PROMPT_HISTORY: '/prompts',
  SETTINGS: '/settings',
  HOOKS_MANAGER: '/hooks',
  MCP_MANAGER: '/settings/mcp',
  ENDPOINTS: '/settings/endpoints',
  INSTALLATIONS: '/settings/installations',
  SETTINGS_RULES: '/settings/rules',
  CODEXLENS_MANAGER: '/settings/codexlens',
  API_SETTINGS: '/api-settings',
  EXPLORER: '/explorer',
  GRAPH: '/graph',
  TEAMS: '/teams',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
