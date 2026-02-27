// ========================================
// useNativeSessions Hook
// ========================================
// TanStack Query hook for native CLI sessions list

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchNativeSessions,
  type NativeSessionListItem,
  type NativeSessionsListResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// ========== Constants ==========

const STALE_TIME = 30 * 1000;
const GC_TIME = 5 * 60 * 1000;

// ========== Types ==========

export type NativeTool = 'gemini' | 'qwen' | 'codex' | 'claude' | 'opencode';

export interface UseNativeSessionsOptions {
  /** Filter by tool type */
  tool?: NativeTool;
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Override default gc time (ms) */
  gcTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface ByToolRecord {
  [tool: string]: NativeSessionListItem[];
}

export interface UseNativeSessionsReturn {
  /** All sessions data */
  sessions: NativeSessionListItem[];
  /** Sessions grouped by tool */
  byTool: ByToolRecord;
  /** Total count from API */
  count: number;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

// ========== Helper Functions ==========

/**
 * Group sessions by tool type
 */
function groupByTool(sessions: NativeSessionListItem[]): ByToolRecord {
  return sessions.reduce<ByToolRecord>((acc, session) => {
    const tool = session.tool;
    if (!acc[tool]) {
      acc[tool] = [];
    }
    acc[tool].push(session);
    return acc;
  }, {});
}

// ========== Hook ==========

/**
 * Hook for fetching native CLI sessions list
 *
 * @example
 * ```tsx
 * const { sessions, byTool, isLoading } = useNativeSessions();
 * const geminiSessions = byTool['gemini'] ?? [];
 * ```
 *
 * @example
 * ```tsx
 * // Filter by tool
 * const { sessions } = useNativeSessions({ tool: 'gemini' });
 * ```
 */
export function useNativeSessions(
  options: UseNativeSessionsOptions = {}
): UseNativeSessionsReturn {
  const { tool, staleTime = STALE_TIME, gcTime = GC_TIME, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery<NativeSessionsListResponse>({
    queryKey: workspaceQueryKeys.nativeSessionsList(projectPath, tool),
    queryFn: () => fetchNativeSessions(tool, projectPath),
    staleTime,
    gcTime,
    enabled,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Memoize sessions and byTool calculations
  const { sessions, byTool } = React.useMemo(() => {
    const sessions = query.data?.sessions ?? [];
    const byTool = groupByTool(sessions);
    return { sessions, byTool };
  }, [query.data]);

  const refetch = async () => {
    await query.refetch();
  };

  return {
    sessions,
    byTool,
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}
