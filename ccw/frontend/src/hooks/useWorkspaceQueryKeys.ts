// ========================================
// useWorkspaceQueryKeys Hook
// ========================================
// Returns workspace-aware query keys factory with current projectPath

import { useMemo } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import { selectProjectPath } from '../stores/workflowStore';
import { workspaceQueryKeys } from '../lib/queryKeys';

/**
 * Hook that returns workspace-aware query keys factory
 * All keys are memoized and update when projectPath changes
 *
 * @example
 * ```tsx
 * const queryKeys = useWorkspaceQueryKeys();
 * const { data } = useQuery({
 *   queryKey: queryKeys.sessionsList(),
 *   queryFn: fetchSessions,
 * });
 * ```
 */
export function useWorkspaceQueryKeys() {
  const projectPath = useWorkflowStore(selectProjectPath);

  // Memoize all key factory functions to recreate only when projectPath changes
  const keys = useMemo(() => {
    const pk = projectPath || '';

    return {
      // Base keys
      all: workspaceQueryKeys.all(pk),

      // Sessions
      sessionsList: workspaceQueryKeys.sessionsList(pk),
      sessionDetail: (sessionId: string) => workspaceQueryKeys.sessionDetail(pk, sessionId),

      // Tasks
      tasksList: (sessionId: string) => workspaceQueryKeys.tasksList(pk, sessionId),
      taskDetail: (taskId: string) => workspaceQueryKeys.taskDetail(pk, taskId),

      // Loops
      loopsList: workspaceQueryKeys.loopsList(pk),
      loopDetail: (loopId: string) => workspaceQueryKeys.loopDetail(pk, loopId),

      // Issues
      issuesList: workspaceQueryKeys.issuesList(pk),
      issuesHistory: workspaceQueryKeys.issuesHistory(pk),
      issueQueue: workspaceQueryKeys.issueQueue(pk),

      // Memory
      memoryList: workspaceQueryKeys.memoryList(pk),
      memoryDetail: (memoryId: string) => workspaceQueryKeys.memoryDetail(pk, memoryId),

      // Project Overview
      projectOverviewDetail: workspaceQueryKeys.projectOverviewDetail(pk),

      // Lite Tasks
      liteTasksList: (type?: 'lite-plan' | 'lite-fix' | 'multi-cli-plan') =>
        workspaceQueryKeys.liteTasksList(pk, type),
      liteTaskDetail: (sessionId: string) => workspaceQueryKeys.liteTaskDetail(pk, sessionId),

      // Review Sessions
      reviewSessionsList: workspaceQueryKeys.reviewSessionsList(pk),
      reviewSessionDetail: (sessionId: string) => workspaceQueryKeys.reviewSessionDetail(pk, sessionId),

      // Rules
      rulesList: workspaceQueryKeys.rulesList(pk),

      // Prompts
      promptsList: workspaceQueryKeys.promptsList(pk),
      promptsInsights: workspaceQueryKeys.promptsInsights(pk),

      // Index
      indexStatus: workspaceQueryKeys.indexStatus(pk),

      // File Explorer
      explorerTree: (rootPath?: string) => workspaceQueryKeys.explorerTree(pk, rootPath),
      explorerFile: (filePath?: string) => workspaceQueryKeys.explorerFile(pk, filePath),

      // Graph Explorer
      graphDependencies: (options?: { maxDepth?: number }) =>
        workspaceQueryKeys.graphDependencies(pk, options),
      graphImpact: (nodeId: string) => workspaceQueryKeys.graphImpact(pk, nodeId),

      // CLI History
      cliHistoryList: workspaceQueryKeys.cliHistoryList(pk),
      cliExecutionDetail: (executionId: string) =>
        workspaceQueryKeys.cliExecutionDetail(pk, executionId),
    };
  }, [projectPath]);

  return keys;
}

/**
 * Type for the return value of useWorkspaceQueryKeys
 */
export type WorkspaceQueryKeys = ReturnType<typeof useWorkspaceQueryKeys>;
