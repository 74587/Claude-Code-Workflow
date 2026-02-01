// ========================================
// useCommands Hook
// ========================================
// TanStack Query hooks for commands management

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCommands,
  type Command,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

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
  totalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering commands
 */
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
