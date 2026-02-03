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

// Mock API
const mockApi = {
  get: vi.fn(),
};

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApi.get(...args),
  },
}));

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

    mockApi.get.mockReset();
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

      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockApi.get).toHaveBeenCalledWith('/api/session-status-counts');
    });

    it('CHI-1.2 - should apply workspace scoping to query', async () => {
      const mockData = [{ status: 'completed', count: 5, percentage: 100 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useWorkflowStatusCounts({ projectPath: '/test/workspace' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/session-status-counts', {
        params: { workspace: '/test/workspace' },
      });
    });

    it('CHI-1.3 - should handle API errors gracefully', async () => {
      mockApi.get.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it('CHI-1.4 - should cache results with TanStack Query', async () => {
      const mockData = [{ status: 'completed', count: 10, percentage: 100 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      // Second render should use cache
      const { result: result2 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // API should only be called once (cached)
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(result2.current.data).toEqual(mockData);
    });

    it('CHI-1.5 - should support manual refetch', async () => {
      const mockData = [{ status: 'completed', count: 10, percentage: 100 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Refetch
      await result.current.refetch();

      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('useActivityTimeline', () => {
    it('CHI-2.1 - should fetch activity timeline with default date range', async () => {
      const mockData = [
        { date: '2026-02-01', sessions: 5, tasks: 20 },
        { date: '2026-02-02', sessions: 8, tasks: 35 },
      ];

      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useActivityTimeline(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockApi.get).toHaveBeenCalledWith('/api/activity-timeline');
    });

    it('CHI-2.2 - should accept custom date range parameters', async () => {
      const mockData = [{ date: '2026-01-01', sessions: 3, tasks: 10 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const dateRange = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
      };

      const { result } = renderHook(() => useActivityTimeline(dateRange), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/activity-timeline', {
        params: {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        },
      });
    });

    it('CHI-2.3 - should handle empty timeline data', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useActivityTimeline(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('CHI-2.4 - should apply workspace scoping', async () => {
      const mockData = [{ date: '2026-02-01', sessions: 2, tasks: 8 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useActivityTimeline(undefined, '/test/workspace'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/activity-timeline', {
        params: { workspace: '/test/workspace' },
      });
    });

    it('CHI-2.5 - should invalidate cache on workspace change', async () => {
      const mockData1 = [{ date: '2026-02-01', sessions: 5, tasks: 20 }];
      const mockData2 = [{ date: '2026-02-01', sessions: 3, tasks: 10 }];

      mockApi.get.mockResolvedValueOnce({ data: mockData1 });

      const { result, rerender } = renderHook(
        ({ workspace }: { workspace?: string }) => useActivityTimeline(undefined, workspace),
        { wrapper, initialProps: { workspace: '/workspace1' } }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData1);

      // Change workspace
      mockApi.get.mockResolvedValueOnce({ data: mockData2 });
      rerender({ workspace: '/workspace2' });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData2);
      });

      expect(mockApi.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('useTaskTypeCounts', () => {
    it('CHI-3.1 - should fetch task type counts successfully', async () => {
      const mockData = [
        { type: 'feature', count: 45 },
        { type: 'bugfix', count: 30 },
        { type: 'refactor', count: 15 },
      ];

      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockApi.get).toHaveBeenCalledWith('/api/task-type-counts');
    });

    it('CHI-3.2 - should apply workspace scoping', async () => {
      const mockData = [{ type: 'feature', count: 10 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useTaskTypeCounts({ projectPath: '/test/workspace' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/task-type-counts', {
        params: { workspace: '/test/workspace' },
      });
    });

    it('CHI-3.3 - should handle zero counts', async () => {
      const mockData = [
        { type: 'feature', count: 0 },
        { type: 'bugfix', count: 0 },
      ];

      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });

    it('CHI-3.4 - should support staleTime configuration', async () => {
      const mockData = [{ type: 'feature', count: 5 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      const { result } = renderHook(
        () => useTaskTypeCounts({ staleTime: 30000 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should be fresh for 30s
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('Multi-Hook Integration', () => {
    it('CHI-4.1 - should load all chart hooks concurrently', async () => {
      mockApi.get.mockImplementation((url: string) => {
        const data: Record<string, any> = {
          '/api/session-status-counts': [{ status: 'completed', count: 10, percentage: 100 }],
          '/api/activity-timeline': [{ date: '2026-02-01', sessions: 5, tasks: 20 }],
          '/api/task-type-counts': [{ type: 'feature', count: 15 }],
        };
        return Promise.resolve({ data: data[url] });
      });

      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      const { result: result2 } = renderHook(() => useActivityTimeline(), { wrapper });
      const { result: result3 } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
        expect(result3.current.isSuccess).toBe(true);
      });

      expect(mockApi.get).toHaveBeenCalledTimes(3);
    });

    it('CHI-4.2 - should handle partial failures gracefully', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/api/session-status-counts') {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({
          data: url === '/api/activity-timeline'
            ? [{ date: '2026-02-01', sessions: 5, tasks: 20 }]
            : [{ type: 'feature', count: 15 }],
        });
      });

      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      const { result: result2 } = renderHook(() => useActivityTimeline(), { wrapper });
      const { result: result3 } = renderHook(() => useTaskTypeCounts(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isError).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
        expect(result3.current.isSuccess).toBe(true);
      });
    });

    it('CHI-4.3 - should share cache across multiple components', async () => {
      const mockData = [{ status: 'completed', count: 10, percentage: 100 }];
      mockApi.get.mockResolvedValue({ data: mockData });

      // First component
      const { result: result1 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      // Second component should use cache
      const { result: result2 } = renderHook(() => useWorkflowStatusCounts(), { wrapper });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Only one API call
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(result1.current.data).toEqual(result2.current.data);
    });
  });
});
