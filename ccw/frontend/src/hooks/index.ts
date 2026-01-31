// ========================================
// Hooks Barrel Export
// ========================================
// Re-export all custom hooks for convenient imports

export { useTheme } from './useTheme';
export type { UseThemeReturn } from './useTheme';

export { useSession } from './useSession';
export type { UseSessionReturn } from './useSession';

export { useConfig } from './useConfig';
export type { UseConfigReturn } from './useConfig';

export { useNotifications } from './useNotifications';
export type { UseNotificationsReturn, ToastOptions } from './useNotifications';

export { useWebSocketNotifications } from './useWebSocketNotifications';

export { useSystemNotifications } from './useSystemNotifications';
export type { UseSystemNotificationsReturn, SystemNotificationOptions } from './useSystemNotifications';

export { useDashboardStats, usePrefetchDashboardStats, dashboardStatsKeys } from './useDashboardStats';
export type { UseDashboardStatsOptions, UseDashboardStatsReturn } from './useDashboardStats';

export {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useArchiveSession,
  useDeleteSession,
  useSessionMutations,
  usePrefetchSessions,
  sessionsKeys,
} from './useSessions';
export type {
  SessionsFilter,
  UseSessionsOptions,
  UseSessionsReturn,
  UseCreateSessionReturn,
  UseUpdateSessionReturn,
  UseArchiveSessionReturn,
  UseDeleteSessionReturn,
} from './useSessions';

// ========== Loops ==========
export {
  useLoops,
  useLoop,
  useCreateLoop,
  useUpdateLoopStatus,
  useDeleteLoop,
  useLoopMutations,
  loopsKeys,
} from './useLoops';
export type {
  LoopsFilter,
  UseLoopsOptions,
  UseLoopsReturn,
  UseCreateLoopReturn,
  UseUpdateLoopStatusReturn,
  UseDeleteLoopReturn,
} from './useLoops';

// ========== Issues ==========
export {
  useIssues,
  useIssueQueue,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  useIssueMutations,
  issuesKeys,
} from './useIssues';
export type {
  IssuesFilter,
  UseIssuesOptions,
  UseIssuesReturn,
  UseCreateIssueReturn,
  UseUpdateIssueReturn,
  UseDeleteIssueReturn,
} from './useIssues';

// ========== Skills ==========
export {
  useSkills,
  useToggleSkill,
  useSkillMutations,
  skillsKeys,
} from './useSkills';
export type {
  SkillsFilter,
  UseSkillsOptions,
  UseSkillsReturn,
  UseToggleSkillReturn,
} from './useSkills';

// ========== Commands ==========
export {
  useCommands,
  useCommandSearch,
  commandsKeys,
} from './useCommands';
export type {
  CommandsFilter,
  UseCommandsOptions,
  UseCommandsReturn,
} from './useCommands';

// ========== Memory ==========
export {
  useMemory,
  useCreateMemory,
  useUpdateMemory,
  useDeleteMemory,
  useMemoryMutations,
  memoryKeys,
} from './useMemory';
export type {
  MemoryFilter,
  UseMemoryOptions,
  UseMemoryReturn,
  UseCreateMemoryReturn,
  UseUpdateMemoryReturn,
  UseDeleteMemoryReturn,
} from './useMemory';

// ========== MCP Servers ==========
export {
  useMcpServers,
  useUpdateMcpServer,
  useCreateMcpServer,
  useDeleteMcpServer,
  useToggleMcpServer,
  useMcpServerMutations,
  mcpServersKeys,
} from './useMcpServers';
export type {
  UseMcpServersOptions,
  UseMcpServersReturn,
  UseUpdateMcpServerReturn,
  UseCreateMcpServerReturn,
  UseDeleteMcpServerReturn,
  UseToggleMcpServerReturn,
} from './useMcpServers';

// ========== CLI ==========
export {
  useCliEndpoints,
  useToggleCliEndpoint,
  cliEndpointsKeys,
  useCliInstallations,
  useInstallCliTool,
  useUninstallCliTool,
  useUpgradeCliTool,
  cliInstallationsKeys,
  useHooks,
  useToggleHook,
  hooksKeys,
  useRules,
  useToggleRule,
  useCreateRule,
  useDeleteRule,
  rulesKeys,
} from './useCli';
export type {
  UseCliEndpointsOptions,
  UseCliEndpointsReturn,
  UseCliInstallationsOptions,
  UseCliInstallationsReturn,
  UseHooksOptions,
  UseHooksReturn,
  UseRulesOptions,
  UseRulesReturn,
} from './useCli';

// ========== CLI Execution ==========
export {
  useCliExecutionDetail,
  cliExecutionKeys,
} from './useCliExecution';
export type {
  UseCliExecutionOptions,
  UseCliExecutionReturn,
} from './useCliExecution';

// ========== Workspace Query Keys ==========
export {
  useWorkspaceQueryKeys,
} from './useWorkspaceQueryKeys';
export type {
  WorkspaceQueryKeys,
} from './useWorkspaceQueryKeys';