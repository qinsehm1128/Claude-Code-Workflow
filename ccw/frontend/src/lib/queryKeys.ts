// ========================================
// Workspace-Aware Query Keys Factory
// ========================================
// TanStack Query key factory with projectPath prefix for cache isolation

/**
 * Workspace-aware query keys factory
 * All keys include projectPath for cache isolation between workspaces
 */
export const workspaceQueryKeys = {
  // Base key that includes projectPath
  all: (projectPath: string) => ['workspace', projectPath] as const,

  // ========== Sessions ==========
  sessions: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'sessions'] as const,
  sessionsList: (projectPath: string) => [...workspaceQueryKeys.sessions(projectPath), 'list'] as const,
  sessionDetail: (projectPath: string, sessionId: string) =>
    [...workspaceQueryKeys.sessions(projectPath), 'detail', sessionId] as const,

  // ========== Tasks ==========
  tasks: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'tasks'] as const,
  tasksList: (projectPath: string, sessionId: string) =>
    [...workspaceQueryKeys.tasks(projectPath), 'list', sessionId] as const,
  taskDetail: (projectPath: string, taskId: string) =>
    [...workspaceQueryKeys.tasks(projectPath), 'detail', taskId] as const,

  // ========== Loops ==========
  loops: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'loops'] as const,
  loopsList: (projectPath: string) => [...workspaceQueryKeys.loops(projectPath), 'list'] as const,
  loopDetail: (projectPath: string, loopId: string) =>
    [...workspaceQueryKeys.loops(projectPath), 'detail', loopId] as const,

  // ========== Issues ==========
  issues: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'issues'] as const,
  issuesList: (projectPath: string) => [...workspaceQueryKeys.issues(projectPath), 'list'] as const,
  issuesHistory: (projectPath: string) => [...workspaceQueryKeys.issues(projectPath), 'history'] as const,
  issueQueue: (projectPath: string) => [...workspaceQueryKeys.issues(projectPath), 'queue'] as const,
  issueQueueById: (projectPath: string, queueId: string) =>
    [...workspaceQueryKeys.issues(projectPath), 'queueById', queueId] as const,
  issueQueueHistory: (projectPath: string) => [...workspaceQueryKeys.issues(projectPath), 'queueHistory'] as const,

  // ========== Discoveries ==========
  discoveries: (projectPath: string) => ['workspace', projectPath, 'discoveries'] as const,

  // ========== Memory ==========
  memory: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'memory'] as const,
  memoryList: (projectPath: string) => [...workspaceQueryKeys.memory(projectPath), 'list'] as const,
  memoryDetail: (projectPath: string, memoryId: string) =>
    [...workspaceQueryKeys.memory(projectPath), 'detail', memoryId] as const,

  // ========== Skills ==========
  skills: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'skills'] as const,
  skillsList: (projectPath: string) => [...workspaceQueryKeys.skills(projectPath), 'list'] as const,
  codexSkills: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'codexSkills'] as const,
  codexSkillsList: (projectPath: string) => [...workspaceQueryKeys.codexSkills(projectPath), 'list'] as const,

  // ========== Commands ==========
  commands: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'commands'] as const,
  commandsList: (projectPath: string) => [...workspaceQueryKeys.commands(projectPath), 'list'] as const,

  // ========== Hooks ==========
  hooks: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'hooks'] as const,
  hooksList: (projectPath: string) => [...workspaceQueryKeys.hooks(projectPath), 'list'] as const,

  // ========== MCP Servers ==========
  mcpServers: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'mcpServers'] as const,
  mcpServersList: (projectPath: string) => [...workspaceQueryKeys.mcpServers(projectPath), 'list'] as const,

  // ========== Project Overview ==========
  projectOverview: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'projectOverview'] as const,
  projectOverviewDetail: (projectPath: string) =>
    [...workspaceQueryKeys.projectOverview(projectPath), 'detail'] as const,

  // ========== Lite Tasks ==========
  liteTasks: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'liteTasks'] as const,
  liteTasksList: (projectPath: string, type?: 'lite-plan' | 'lite-fix' | 'multi-cli-plan') =>
    [...workspaceQueryKeys.liteTasks(projectPath), 'list', type] as const,
  liteTaskDetail: (projectPath: string, sessionId: string) =>
    [...workspaceQueryKeys.liteTasks(projectPath), 'detail', sessionId] as const,

  // ========== Review Sessions ==========
  reviewSessions: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'reviewSessions'] as const,
  reviewSessionsList: (projectPath: string) => [...workspaceQueryKeys.reviewSessions(projectPath), 'list'] as const,
  reviewSessionDetail: (projectPath: string, sessionId: string) =>
    [...workspaceQueryKeys.reviewSessions(projectPath), 'detail', sessionId] as const,

  // ========== Rules ==========
  rules: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'rules'] as const,
  rulesList: (projectPath: string) => [...workspaceQueryKeys.rules(projectPath), 'list'] as const,

  // ========== Prompts ==========
  prompts: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'prompts'] as const,
  promptsList: (projectPath: string) => [...workspaceQueryKeys.prompts(projectPath), 'list'] as const,
  promptsInsights: (projectPath: string) => [...workspaceQueryKeys.prompts(projectPath), 'insights'] as const,
  promptsInsightsHistory: (projectPath: string) => [...workspaceQueryKeys.prompts(projectPath), 'insightsHistory'] as const,

  // ========== Index ==========
  index: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'index'] as const,
  indexStatus: (projectPath: string) => [...workspaceQueryKeys.index(projectPath), 'status'] as const,

  // ========== File Explorer ==========
  explorer: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'explorer'] as const,
  explorerTree: (projectPath: string, rootPath?: string) =>
    [...workspaceQueryKeys.explorer(projectPath), 'tree', rootPath] as const,
  explorerFile: (projectPath: string, filePath?: string) =>
    [...workspaceQueryKeys.explorer(projectPath), 'file', filePath] as const,

  // ========== Graph Explorer ==========
  graph: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'graph'] as const,
  graphDependencies: (projectPath: string, options?: { maxDepth?: number }) =>
    [...workspaceQueryKeys.graph(projectPath), 'dependencies', options] as const,
  graphImpact: (projectPath: string, nodeId: string) =>
    [...workspaceQueryKeys.graph(projectPath), 'impact', nodeId] as const,

  // ========== CLI History ==========
  cliHistory: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'cliHistory'] as const,
  cliHistoryList: (projectPath: string) => [...workspaceQueryKeys.cliHistory(projectPath), 'list'] as const,
  cliExecutionDetail: (projectPath: string, executionId: string) =>
    [...workspaceQueryKeys.cliHistory(projectPath), 'detail', executionId] as const,

  // ========== Audit ==========
  audit: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'audit'] as const,
  cliSessionAudit: (
    projectPath: string,
    options?: {
      sessionKey?: string;
      type?: string;
      q?: string;
      limit?: number;
      offset?: number;
    }
  ) => [...workspaceQueryKeys.audit(projectPath), 'cliSessions', options] as const,

  // ========== Unified Memory ==========
  unifiedMemory: (projectPath: string) => [...workspaceQueryKeys.all(projectPath), 'unifiedMemory'] as const,
  unifiedSearch: (projectPath: string, query: string, categories?: string) =>
    [...workspaceQueryKeys.unifiedMemory(projectPath), 'search', query, categories] as const,
  unifiedStats: (projectPath: string) =>
    [...workspaceQueryKeys.unifiedMemory(projectPath), 'stats'] as const,
  unifiedRecommendations: (projectPath: string, memoryId: string) =>
    [...workspaceQueryKeys.unifiedMemory(projectPath), 'recommendations', memoryId] as const,
};

// ========== API Settings Keys ==========
/**
 * API Settings query keys (global, not workspace-specific)
 */
export const apiSettingsKeys = {
  all: ['apiSettings'] as const,
  providers: () => [...apiSettingsKeys.all, 'providers'] as const,
  provider: (id: string) => [...apiSettingsKeys.providers(), id] as const,
  endpoints: () => [...apiSettingsKeys.all, 'endpoints'] as const,
  endpoint: (id: string) => [...apiSettingsKeys.endpoints(), id] as const,
  cache: () => [...apiSettingsKeys.all, 'cache'] as const,
  modelPools: () => [...apiSettingsKeys.all, 'modelPools'] as const,
  modelPool: (id: string) => [...apiSettingsKeys.modelPools(), id] as const,
  ccwLitellm: () => [...apiSettingsKeys.all, 'ccwLitellm'] as const,
};
