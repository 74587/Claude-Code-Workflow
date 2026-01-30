// ========================================
// useTemplates Hook
// ========================================
// TanStack Query hooks for template API operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FlowTemplate, TemplateInstallRequest, TemplateExportRequest } from '../types/execution';
import type { Flow } from '../types/flow';

// API base URL
const API_BASE = '/api/orchestrator';

// Query keys
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
  categories: () => [...templateKeys.all, 'categories'] as const,
};

// API response types
interface TemplatesListResponse {
  templates: FlowTemplate[];
  total: number;
  categories: string[];
}

interface TemplateDetailResponse extends FlowTemplate {
  flow: Flow;
}

interface InstallTemplateResponse {
  flow: Flow;
  message: string;
}

interface ExportTemplateResponse {
  template: FlowTemplate;
  message: string;
}

// ========== Fetch Functions ==========

async function fetchTemplates(category?: string): Promise<TemplatesListResponse> {
  const url = category
    ? `${API_BASE}/templates?category=${encodeURIComponent(category)}`
    : `${API_BASE}/templates`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.statusText}`);
  }
  return response.json();
}

async function fetchTemplate(id: string): Promise<TemplateDetailResponse> {
  const response = await fetch(`${API_BASE}/templates/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }
  return response.json();
}

async function installTemplate(request: TemplateInstallRequest): Promise<InstallTemplateResponse> {
  const response = await fetch(`${API_BASE}/templates/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to install template: ${response.statusText}`);
  }
  return response.json();
}

async function exportTemplate(request: TemplateExportRequest): Promise<ExportTemplateResponse> {
  const response = await fetch(`${API_BASE}/templates/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to export template: ${response.statusText}`);
  }
  return response.json();
}

async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete template: ${response.statusText}`);
  }
}

// ========== Query Hooks ==========

/**
 * Fetch all templates
 */
export function useTemplates(category?: string) {
  return useQuery({
    queryKey: templateKeys.list({ category }),
    queryFn: () => fetchTemplates(category),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch a single template by ID
 */
export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn: () => fetchTemplate(id!),
    enabled: !!id,
    staleTime: 60000,
  });
}

// ========== Mutation Hooks ==========

/**
 * Install a template as a new flow
 */
export function useInstallTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: installTemplate,
    onSuccess: () => {
      // Invalidate flows list to show the new flow
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
  });
}

/**
 * Export a flow as a template
 */
export function useExportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: exportTemplate,
    onSuccess: (result) => {
      // Add to templates list
      queryClient.setQueryData<TemplatesListResponse>(templateKeys.lists(), (old) => {
        if (!old) return { templates: [result.template], total: 1, categories: [] };
        return {
          ...old,
          templates: [...old.templates, result.template],
          total: old.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Delete a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: templateKeys.detail(deletedId) });
      queryClient.setQueryData<TemplatesListResponse>(templateKeys.lists(), (old) => {
        if (!old) return old;
        return {
          ...old,
          templates: old.templates.filter((t) => t.id !== deletedId),
          total: old.total - 1,
        };
      });
    },
  });
}
