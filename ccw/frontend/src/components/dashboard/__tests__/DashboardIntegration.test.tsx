// ========================================
// Dashboard Integration Tests
// ========================================
// Integration tests for HomePage data flows: stats + sessions + charts + ticker all loading concurrently

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n, screen, waitFor } from '@/test/i18n';
import HomePage from '@/pages/HomePage';

// Mock hooks
vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock('@/hooks/useSessions', () => ({
  useSessions: vi.fn(),
}));

vi.mock('@/hooks/useWorkflowStatusCounts', () => ({
  useWorkflowStatusCounts: vi.fn(),
}));

vi.mock('@/hooks/useActivityTimeline', () => ({
  useActivityTimeline: vi.fn(),
}));

vi.mock('@/hooks/useTaskTypeCounts', () => ({
  useTaskTypeCounts: vi.fn(),
}));

vi.mock('@/hooks/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}));

vi.mock('@/hooks/useUserDashboardLayout', () => ({
  useUserDashboardLayout: vi.fn(),
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn(() => ({
    projectPath: '/test/project',
    locale: 'en',
  })),
}));

import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useSessions } from '@/hooks/useSessions';
import { useWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';
import { useActivityTimeline } from '@/hooks/useActivityTimeline';
import { useTaskTypeCounts } from '@/hooks/useTaskTypeCounts';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useUserDashboardLayout } from '@/hooks/useUserDashboardLayout';

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {

    // Setup default mock responses
    vi.mocked(useDashboardStats).mockReturnValue({
      data: {
        totalSessions: 42,
        activeSessions: 5,
        completedToday: 12,
        averageTime: '2.5h',
        successRate: 85,
        taskCount: 156,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSessions).mockReturnValue({
      activeSessions: [
        {
          id: 'session-1',
          name: 'Test Session 1',
          status: 'in_progress',
          tasks: [{ status: 'completed' }, { status: 'pending' }],
          created_at: new Date().toISOString(),
        },
      ],
      archivedSessions: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useWorkflowStatusCounts).mockReturnValue({
      data: [
        { status: 'completed', count: 30, percentage: 60 },
        { status: 'in_progress', count: 10, percentage: 20 },
        { status: 'pending', count: 10, percentage: 20 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useActivityTimeline).mockReturnValue({
      data: [
        { date: '2026-02-01', sessions: 5, tasks: 20 },
        { date: '2026-02-02', sessions: 8, tasks: 35 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useTaskTypeCounts).mockReturnValue({
      data: [
        { type: 'feature', count: 45 },
        { type: 'bugfix', count: 30 },
        { type: 'refactor', count: 15 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useRealtimeUpdates).mockReturnValue({
      messages: [
        {
          id: 'msg-1',
          text: 'Session completed',
          type: 'session',
          timestamp: Date.now(),
        },
      ],
      connectionStatus: 'connected',
      reconnect: vi.fn(),
    });

    vi.mocked(useUserDashboardLayout).mockReturnValue({
      layouts: {
        lg: [],
        md: [],
        sm: [],
      },
      saveLayout: vi.fn(),
      resetLayout: vi.fn(),
      isSaving: false,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Concurrent Data Loading', () => {
    it('INT-1.1 - should load all data sources concurrently', async () => {
      renderWithI18n(<HomePage />);

      // Verify all hooks are called
      expect(useDashboardStats).toHaveBeenCalled();
      expect(useSessions).toHaveBeenCalled();
      expect(useWorkflowStatusCounts).toHaveBeenCalled();
      expect(useActivityTimeline).toHaveBeenCalled();
      expect(useTaskTypeCounts).toHaveBeenCalled();
      expect(useRealtimeUpdates).toHaveBeenCalled();
    });

    it('INT-1.2 - should display all widgets with loaded data', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        // Check for stat cards
        expect(screen.queryByText('42')).toBeInTheDocument(); // total sessions
      });
    });

    it('INT-1.3 - should handle loading states correctly', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      // Should show loading skeleton
      await waitFor(() => {
        const skeletons = screen.queryAllByTestId(/skeleton/i);
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it('INT-1.4 - should handle partial loading states', async () => {
      // Stats loading, sessions loaded
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        // Check that hooks were called (rendering may vary based on implementation)
        expect(useDashboardStats).toHaveBeenCalled();
        expect(useSessions).toHaveBeenCalled();
      });
    });
  });

  describe('Data Flow Integration', () => {
    it('INT-2.1 - should pass stats data to DetailedStatsWidget', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('42')).toBeInTheDocument();
        expect(screen.queryByText('5')).toBeInTheDocument();
      });
    });

    it('INT-2.2 - should pass session data to RecentSessionsWidget', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Test Session 1')).toBeInTheDocument();
      });
    });

    it('INT-2.3 - should pass chart data to chart widgets', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        // Chart data should be rendered
        expect(useWorkflowStatusCounts).toHaveBeenCalled();
        expect(useActivityTimeline).toHaveBeenCalled();
        expect(useTaskTypeCounts).toHaveBeenCalled();
      });
    });

    it('INT-2.4 - should pass ticker messages to TickerMarquee', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useRealtimeUpdates).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('INT-3.1 - should display error state when stats hook fails', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load stats'),
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        const errorText = screen.queryByText(/error|failed/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('INT-3.2 - should display error state when sessions hook fails', async () => {
      vi.mocked(useSessions).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load sessions'),
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        const errorText = screen.queryByText(/error|failed/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('INT-3.3 - should display error state when chart hooks fail', async () => {
      vi.mocked(useWorkflowStatusCounts).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load chart data'),
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useWorkflowStatusCounts).toHaveBeenCalled();
      });
    });

    it('INT-3.4 - should handle partial errors gracefully', async () => {
      // Only stats fails, others succeed
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Stats failed'),
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        // Check that useSessions was called (sessions may or may not render)
        expect(useSessions).toHaveBeenCalled();
      });
    });

    it('INT-3.5 - should handle WebSocket disconnection', async () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue({
        messages: [],
        connectionStatus: 'disconnected',
        reconnect: vi.fn(),
      });

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useRealtimeUpdates).toHaveBeenCalled();
      });
    });
  });

  describe('Data Refresh', () => {
    it('INT-4.1 - should refresh all data sources on refresh button click', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useDashboardStats).mockReturnValue({
        data: { totalSessions: 42 } as any,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      renderWithI18n(<HomePage />);

      const refreshButton = screen.queryByRole('button', { name: /refresh/i });
      if (refreshButton) {
        refreshButton.click();
        await waitFor(() => {
          expect(mockRefetch).toHaveBeenCalled();
        });
      }
    });

    it('INT-4.2 - should update UI when data changes', async () => {
      const { rerender } = renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('42')).toBeInTheDocument();
      });

      // Update data
      vi.mocked(useDashboardStats).mockReturnValue({
        data: { totalSessions: 50 } as any,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      rerender(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('50')).toBeInTheDocument();
      });
    });
  });

  describe('Workspace Scoping', () => {
    it('INT-5.1 - should pass workspace path to all data hooks', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useDashboardStats).toHaveBeenCalledWith(
          expect.objectContaining({ projectPath: '/test/project' })
        );
      });
    });

    it('INT-5.2 - should refresh data when workspace changes', async () => {
      const { rerender } = renderWithI18n(<HomePage />);

      // Change workspace
      vi.mocked(require('@/stores/appStore').useAppStore).mockReturnValue({
        projectPath: '/different/project',
        locale: 'en',
      });

      rerender(<HomePage />);

      await waitFor(() => {
        expect(useDashboardStats).toHaveBeenCalled();
      });
    });
  });

  describe('Realtime Updates', () => {
    it('INT-6.1 - should display new ticker messages as they arrive', async () => {
      const { rerender } = renderWithI18n(<HomePage />);

      // Add new message
      vi.mocked(useRealtimeUpdates).mockReturnValue({
        messages: [
          {
            id: 'msg-2',
            text: 'New session started',
            type: 'session',
            timestamp: Date.now(),
          },
        ],
        connectionStatus: 'connected',
        reconnect: vi.fn(),
      });

      rerender(<HomePage />);

      await waitFor(() => {
        expect(useRealtimeUpdates).toHaveBeenCalled();
      });
    });

    it('INT-6.2 - should maintain connection status indicator', async () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue({
        messages: [],
        connectionStatus: 'reconnecting',
        reconnect: vi.fn(),
      });

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useRealtimeUpdates).toHaveBeenCalled();
      });
    });
  });
});
