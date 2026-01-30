// ========================================
// useFlows Hook
// ========================================
// TanStack Query hooks for flow API operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Flow } from '../types/flow';

// API base URL
const API_BASE = '/api/orchestrator';

// Query keys
export const flowKeys = {
  all: ['flows'] as const,
  lists: () => [...flowKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...flowKeys.lists(), filters] as const,
  details: () => [...flowKeys.all, 'detail'] as const,
  detail: (id: string) => [...flowKeys.details(), id] as const,
};

// API response types
interface FlowsListResponse {
  flows: Flow[];
  total: number;
}

interface ExecutionStartResponse {
  execId: string;
  flowId: string;
  status: 'running';
  startedAt: string;
}

interface ExecutionControlResponse {
  execId: string;
  status: 'paused' | 'running' | 'stopped';
  message: string;
}

// ========== Fetch Functions ==========

async function fetchFlows(): Promise<FlowsListResponse> {
  const response = await fetch(`${API_BASE}/flows`);
  if (!response.ok) {
    throw new Error(`Failed to fetch flows: ${response.statusText}`);
  }
  return response.json();
}

async function fetchFlow(id: string): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch flow: ${response.statusText}`);
  }
  return response.json();
}

async function createFlow(flow: Omit<Flow, 'id' | 'created_at' | 'updated_at'>): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  });
  if (!response.ok) {
    throw new Error(`Failed to create flow: ${response.statusText}`);
  }
  return response.json();
}

async function updateFlow(id: string, flow: Partial<Flow>): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  });
  if (!response.ok) {
    throw new Error(`Failed to update flow: ${response.statusText}`);
  }
  return response.json();
}

async function deleteFlow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/flows/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete flow: ${response.statusText}`);
  }
}

async function duplicateFlow(id: string): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows/${id}/duplicate`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to duplicate flow: ${response.statusText}`);
  }
  return response.json();
}

// ========== Execution Functions ==========

async function executeFlow(flowId: string): Promise<ExecutionStartResponse> {
  const response = await fetch(`${API_BASE}/flows/${flowId}/execute`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to execute flow: ${response.statusText}`);
  }
  return response.json();
}

async function pauseExecution(execId: string): Promise<ExecutionControlResponse> {
  const response = await fetch(`${API_BASE}/executions/${execId}/pause`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to pause execution: ${response.statusText}`);
  }
  return response.json();
}

async function resumeExecution(execId: string): Promise<ExecutionControlResponse> {
  const response = await fetch(`${API_BASE}/executions/${execId}/resume`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to resume execution: ${response.statusText}`);
  }
  return response.json();
}

async function stopExecution(execId: string): Promise<ExecutionControlResponse> {
  const response = await fetch(`${API_BASE}/executions/${execId}/stop`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to stop execution: ${response.statusText}`);
  }
  return response.json();
}

// ========== Query Hooks ==========

/**
 * Fetch all flows
 */
export function useFlows() {
  return useQuery({
    queryKey: flowKeys.lists(),
    queryFn: fetchFlows,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch a single flow by ID
 */
export function useFlow(id: string | null) {
  return useQuery({
    queryKey: flowKeys.detail(id ?? ''),
    queryFn: () => fetchFlow(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

// ========== Mutation Hooks ==========

/**
 * Create a new flow
 */
export function useCreateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFlow,
    onSuccess: (newFlow) => {
      // Optimistically add to list
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return { flows: [newFlow], total: 1 };
        return {
          flows: [...old.flows, newFlow],
          total: old.total + 1,
        };
      });
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: flowKeys.lists() });
    },
  });
}

/**
 * Update an existing flow
 */
export function useUpdateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, flow }: { id: string; flow: Partial<Flow> }) => updateFlow(id, flow),
    onSuccess: (updatedFlow) => {
      // Update in cache
      queryClient.setQueryData<Flow>(flowKeys.detail(updatedFlow.id), updatedFlow);
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return old;
        return {
          ...old,
          flows: old.flows.map((f) => (f.id === updatedFlow.id ? updatedFlow : f)),
        };
      });
    },
  });
}

/**
 * Delete a flow
 */
export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFlow,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: flowKeys.detail(deletedId) });
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return old;
        return {
          flows: old.flows.filter((f) => f.id !== deletedId),
          total: old.total - 1,
        };
      });
    },
  });
}

/**
 * Duplicate a flow
 */
export function useDuplicateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateFlow,
    onSuccess: (newFlow) => {
      // Add to list
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return { flows: [newFlow], total: 1 };
        return {
          flows: [...old.flows, newFlow],
          total: old.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: flowKeys.lists() });
    },
  });
}

// ========== Execution Mutation Hooks ==========

/**
 * Execute a flow
 */
export function useExecuteFlow() {
  return useMutation({
    mutationFn: executeFlow,
  });
}

/**
 * Pause execution
 */
export function usePauseExecution() {
  return useMutation({
    mutationFn: pauseExecution,
  });
}

/**
 * Resume execution
 */
export function useResumeExecution() {
  return useMutation({
    mutationFn: resumeExecution,
  });
}

/**
 * Stop execution
 */
export function useStopExecution() {
  return useMutation({
    mutationFn: stopExecution,
  });
}
