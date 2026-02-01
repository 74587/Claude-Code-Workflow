// ========================================
// useSkills Hook
// ========================================
// TanStack Query hooks for skills management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSkills,
  enableSkill,
  disableSkill,
  type Skill,
  type SkillsResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Query key factory
export const skillsKeys = {
  all: ['skills'] as const,
  lists: () => [...skillsKeys.all, 'list'] as const,
  list: (filters?: SkillsFilter) => [...skillsKeys.lists(), filters] as const,
};

// Default stale time: 5 minutes (skills don't change frequently)
const STALE_TIME = 5 * 60 * 1000;

export interface SkillsFilter {
  search?: string;
  category?: string;
  source?: Skill['source'];
  enabledOnly?: boolean;
  location?: 'project' | 'user';
}

export interface UseSkillsOptions {
  filter?: SkillsFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseSkillsReturn {
  skills: Skill[];
  enabledSkills: Skill[];
  categories: string[];
  skillsByCategory: Record<string, Skill[]>;
  totalCount: number;
  enabledCount: number;
  projectSkills: Skill[];
  userSkills: Skill[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering skills
 */
export function useSkills(options: UseSkillsOptions = {}): UseSkillsReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery({
    queryKey: workspaceQueryKeys.skillsList(projectPath),
    queryFn: () => fetchSkills(projectPath),
    staleTime,
    enabled: enabled, // Remove projectPath requirement - API works without it
    retry: 2,
  });

  const allSkills = query.data?.skills ?? [];

  // Separate by location
  const projectSkills = allSkills.filter(s => s.location === 'project');
  const userSkills = allSkills.filter(s => s.location === 'user');

  // Apply filters
  const filteredSkills = (() => {
    let skills = allSkills;

    if (filter?.location) {
      skills = skills.filter((s) => s.location === filter.location);
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.triggers.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.category) {
      skills = skills.filter((s) => s.category === filter.category);
    }

    if (filter?.source) {
      skills = skills.filter((s) => s.source === filter.source);
    }

    if (filter?.enabledOnly) {
      skills = skills.filter((s) => s.enabled);
    }

    return skills;
  })();

  // Group by category
  const skillsByCategory: Record<string, Skill[]> = {};
  const categories = new Set<string>();

  for (const skill of allSkills) {
    const category = skill.category || 'Uncategorized';
    categories.add(category);
    if (!skillsByCategory[category]) {
      skillsByCategory[category] = [];
    }
    skillsByCategory[category].push(skill);
  }

  const enabledSkills = allSkills.filter((s) => s.enabled);

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.skills(projectPath) });
    }
  };

  return {
    skills: filteredSkills,
    enabledSkills,
    categories: Array.from(categories).sort(),
    skillsByCategory,
    totalCount: allSkills.length,
    enabledCount: enabledSkills.length,
    projectSkills,
    userSkills,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseToggleSkillReturn {
  toggleSkill: (skillName: string, enabled: boolean, location: 'project' | 'user') => Promise<Skill>;
  isToggling: boolean;
  error: Error | null;
}

export function useToggleSkill(): UseToggleSkillReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ skillName, enabled, location }: { skillName: string; enabled: boolean; location: 'project' | 'user' }) =>
      enabled
        ? enableSkill(skillName, location, projectPath)
        : disableSkill(skillName, location, projectPath),
    onSuccess: () => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.skills(projectPath) : ['skills'] });
    },
  });

  return {
    toggleSkill: (skillName, enabled, location) => mutation.mutateAsync({ skillName, enabled, location }),
    isToggling: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all skill mutations
 */
export function useSkillMutations() {
  const toggle = useToggleSkill();

  return {
    toggleSkill: toggle.toggleSkill,
    isToggling: toggle.isToggling,
    isMutating: toggle.isToggling,
  };
}
