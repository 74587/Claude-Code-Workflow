// ========================================
// useCommands Hook
// ========================================
// TanStack Query hooks for commands management

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchCommands,
  toggleCommand as toggleCommandApi,
  toggleCommandGroup as toggleCommandGroupApi,
  type Command,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { useNotifications } from './useNotifications';
import { sanitizeErrorMessage } from '@/utils/errorSanitizer';
import { formatMessage } from '@/lib/i18n';

// Query key factory
export const commandsKeys = {
  all: ['commands'] as const,
  lists: () => [...commandsKeys.all, 'list'] as const,
  list: (filters?: CommandsFilter) => [...commandsKeys.lists(), filters] as const,
};

// Default stale time: 10 minutes (commands are static)
const STALE_TIME = 10 * 60 * 1000;

export interface CommandsFilter {
  search?: string;
  category?: string;
  source?: Command['source'];
  group?: string;
  location?: 'project' | 'user';
  showDisabled?: boolean;
}

export interface UseCommandsOptions {
  filter?: CommandsFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseCommandsReturn {
  commands: Command[];
  categories: string[];
  commandsByCategory: Record<string, Command[]>;
  groupedCommands: Record<string, Command[]>;
  groups: string[];
  totalCount: number;
  enabledCount: number;
  disabledCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering commands
 */

export interface UseCommandMutationsReturn {
  toggleCommand: (name: string, enabled: boolean, location: 'project' | 'user') => Promise<any>;
  toggleGroup: (groupName: string, enable: boolean, location: 'project' | 'user') => Promise<any>;
  isToggling: boolean;
}

export function useCommandMutations(): UseCommandMutationsReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { addToast, removeToast, success, error } = useNotifications();

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled, location }: { name: string; enabled: boolean; location: 'project' | 'user' }) =>
      toggleCommandApi(name, enabled, location, projectPath),
    onMutate: (): { loadingId: string } => {
      const loadingId = addToast('info', formatMessage('common.loading'), undefined, { duration: 0 });
      return { loadingId };
    },
    onSuccess: (_, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      success(formatMessage('feedback.commandToggle.success'));
      queryClient.invalidateQueries({ queryKey: commandsKeys.all });
    },
    onError: (err, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      const sanitized = sanitizeErrorMessage(err, 'commandToggle');
      error(formatMessage('common.error'), formatMessage(sanitized.messageKey));
    },
  });

  const toggleGroupMutation = useMutation({
    mutationFn: ({ groupName, enable, location }: { groupName: string; enable: boolean; location: 'project' | 'user' }) =>
      toggleCommandGroupApi(groupName, enable, location, projectPath),
    onMutate: (): { loadingId: string } => {
      const loadingId = addToast('info', formatMessage('common.loading'), undefined, { duration: 0 });
      return { loadingId };
    },
    onSuccess: (_, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      success(formatMessage('feedback.commandToggle.success'));
      queryClient.invalidateQueries({ queryKey: commandsKeys.all });
    },
    onError: (err, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      const sanitized = sanitizeErrorMessage(err, 'commandToggle');
      error(formatMessage('common.error'), formatMessage(sanitized.messageKey));
    },
  });

  return {
    toggleCommand: (name, enabled, location) => toggleMutation.mutateAsync({ name, enabled, location }),
    toggleGroup: (groupName, enable, location) => toggleGroupMutation.mutateAsync({ groupName, enable, location }),
    isToggling: toggleMutation.isPending || toggleGroupMutation.isPending,
  };
}

export function useCommands(options: UseCommandsOptions = {}): UseCommandsReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery({
    queryKey: commandsKeys.list(filter),
    queryFn: () => fetchCommands(projectPath),
    staleTime,
    enabled: enabled, // Remove projectPath requirement
    retry: 2,
  });

  const allCommands = query.data?.commands ?? [];

  // Apply filters
  const filteredCommands = (() => {
    let commands = allCommands;

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      commands = commands.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower) ||
          c.aliases?.some((a) => a.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.category) {
      commands = commands.filter((c) => c.category === filter.category);
    }

    if (filter?.source) {
      commands = commands.filter((c) => c.source === filter.source);
    }

    if (filter?.group) {
      commands = commands.filter((c) => c.group === filter.group);
    }

    if (filter?.location) {
      commands = commands.filter((c) => c.location === filter.location);
    }

    if (filter?.showDisabled === false) {
      commands = commands.filter((c) => c.enabled !== false);
    }

    return commands;
  })();

  // Group by category
  const commandsByCategory: Record<string, Command[]> = {};
  const categories = new Set<string>();

  for (const command of allCommands) {
    const category = command.category || 'Uncategorized';
    categories.add(category);
    if (!commandsByCategory[category]) {
      commandsByCategory[category] = [];
    }
    commandsByCategory[category].push(command);
  }

  // Group by group
  const groupedCommands: Record<string, Command[]> = {};
  const groups = new Set<string>();
  const enabledCount = allCommands.filter(c => c.enabled !== false).length;
  const disabledCount = allCommands.length - enabledCount;

  for (const command of allCommands) {
    const group = command.group || 'other';
    groups.add(group);
    if (!groupedCommands[group]) {
      groupedCommands[group] = [];
    }
    groupedCommands[group].push(command);
  }

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: commandsKeys.all });
  };

  return {
    commands: filteredCommands,
    categories: Array.from(categories).sort(),
    commandsByCategory,
    groupedCommands,
    groups: Array.from(groups).sort(),
    enabledCount,
    disabledCount,
    totalCount: allCommands.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

/**
 * Hook to search commands by name or alias
 */
export function useCommandSearch(searchTerm: string) {
  const { commands } = useCommands({ filter: { search: searchTerm } });
  return commands;
}
