// ========================================
// Chart Hooks Integration Tests
// ========================================
// Integration tests for TanStack Query hooks: useWorkflowStatusCounts, useActivityTimeline, useTaskTypeCounts with workspace scoping

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';
import { useActivityTimeline } from '@/hooks/useActivityTimeline';
import { useTaskTypeCounts } from '@/hooks/useTaskTypeCounts';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock workflowStore to provide projectPath
vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: (selector: (state: { projectPath: string }) => string) =>
    selector({ projectPath: '/test/project' }),
  selectProjectPath: (state: { projectPath: string }) => state.projectPath,
}));

/** Helper to create a mock Response */
function mockResponse(data: unknown, ok = true) {
  return new Response(JSON.stringify(data), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Chart Hooks Integration Tests', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useWorkflowStatusCounts', () => {
    it('CHI-1.1 - should fetch workflow status counts successfully', async () => {
      const mockData = [
        { status: 'completed', count: 30, percentage: 60 },
        { status: 'in_progress', count: 10, percentage: 20 },
        { status: 'pending', count: 10, percentage: 20 },
      ];

      mockFetch.mockResolvedValue(mockResponse(mockData));

      const { result } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/workflow-status-counts')
      );
    });

    it('CHI-1.3 - should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue(mockResponse({ error: 'fail' }, false));

      const { result } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.data).toBeUndefined();
    });

    it('CHI-1.4 - should cache results with TanStack Query', async () => {
      const mockData = [{ status: 'completed', count: 10, percentage: 100 }];
      mockFetch.mockResolvedValue(mockResponse(mockData));

      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      await waitFor(() => expect(result1.current.isLoading).toBe(false));

      // Second render should use cache
      const { result: result2 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // API should only be called once (cached)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.current.data).toEqual(mockData);
    });

    it('CHI-1.5 - should support manual refetch', async () => {
      const mockData = [{ status: 'completed', count: 10, percentage: 100 }];
      mockFetch.mockResolvedValue(mockResponse(mockData));

      const { result } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Refetch
      await result.current.refetch();

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('useActivityTimeline', () => {
    it('CHI-2.1 - should fetch activity timeline with default date range', async () => {
      const mockData = [
        { date: '2026-02-01', sessions: 5, tasks: 20 },
        { date: '2026-02-02', sessions: 8, tasks: 35 },
      ];

      mockFetch.mockResolvedValue(mockResponse(mockData));

      const { result } = renderHook(() => useActivityTimeline(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/activity-timeline')
      );
    });

    it('CHI-2.3 - should handle empty timeline data', async () => {
      mockFetch.mockResolvedValue(mockResponse([]));

      const { result } = renderHook(() => useActivityTimeline(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useTaskTypeCounts', () => {
    it('CHI-3.1 - should fetch task type counts successfully', async () => {
      const mockData = [
        { type: 'feature', count: 45 },
        { type: 'bugfix', count: 30 },
        { type: 'refactor', count: 15 },
      ];

      mockFetch.mockResolvedValue(mockResponse(mockData));

      const { result } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/task-type-counts')
      );
    });

    it('CHI-3.3 - should handle zero counts', async () => {
      const mockData = [
        { type: 'feature', count: 0 },
        { type: 'bugfix', count: 0 },
      ];

      mockFetch.mockResolvedValue(mockResponse(mockData));

      const { result } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('Multi-Hook Integration', () => {
    it('CHI-4.1 - should load all chart hooks concurrently', async () => {
      mockFetch.mockImplementation((url: string) => {
        const data: Record<string, unknown> = {
          '/api/workflow-status-counts': [{ status: 'completed', count: 10, percentage: 100 }],
          '/api/activity-timeline': [{ date: '2026-02-01', sessions: 5, tasks: 20 }],
          '/api/task-type-counts': [{ type: 'feature', count: 15 }],
        };
        // Match URL path (ignore query params)
        const matchedKey = Object.keys(data).find(key => url.includes(key));
        return Promise.resolve(mockResponse(matchedKey ? data[matchedKey] : []));
      });

      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      const { result: result2 } = renderHook(() => useActivityTimeline(), { wrapper });
      const { result: result3 } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
        expect(result3.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('CHI-4.2 - should handle partial failures gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/workflow-status-counts')) {
          return Promise.resolve(mockResponse({ error: 'fail' }, false));
        }
        const data: Record<string, unknown> = {
          '/api/activity-timeline': [{ date: '2026-02-01', sessions: 5, tasks: 20 }],
          '/api/task-type-counts': [{ type: 'feature', count: 15 }],
        };
        const matchedKey = Object.keys(data).find(key => url.includes(key));
        return Promise.resolve(mockResponse(matchedKey ? data[matchedKey] : []));
      });

      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      const { result: result2 } = renderHook(() => useActivityTimeline(), { wrapper });
      const { result: result3 } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result1.current.error).toBeDefined();
        expect(result2.current.isLoading).toBe(false);
        expect(result3.current.isLoading).toBe(false);
      });
    });

    it('CHI-4.3 - should share cache across multiple components', async () => {
      const mockData = [{ status: 'completed', count: 10, percentage: 100 }];
      mockFetch.mockResolvedValue(mockResponse(mockData));

      // First component
      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      await waitFor(() => expect(result1.current.isLoading).toBe(false));

      // Second component should use cache
      const { result: result2 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Only one API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.current.data).toEqual(result2.current.data);
    });
  });
});
