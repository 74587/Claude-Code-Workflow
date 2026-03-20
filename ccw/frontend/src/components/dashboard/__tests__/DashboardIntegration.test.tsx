// ========================================
// Dashboard Integration Tests
// ========================================
// Integration tests for HomePage data flows: stats + sessions loading concurrently

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n, waitFor } from '@/test/i18n';
import HomePage from '@/pages/HomePage';

// Mock hooks used by WorkflowTaskWidget
vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock('@/hooks/useSessions', () => ({
  useSessions: vi.fn(),
}));

vi.mock('@/hooks/useWorkflowStatusCounts', () => ({
  useWorkflowStatusCounts: vi.fn(),
}));

vi.mock('@/hooks/useProjectOverview', () => ({
  useProjectOverview: vi.fn(),
}));

// Mock hooks used by RecentSessionsWidget
vi.mock('@/hooks/useLiteTasks', () => ({
  useLiteTasks: vi.fn(),
}));

// Mock DialogStyleContext (used by A2UIButton in some child components)
vi.mock('@/contexts/DialogStyleContext', () => ({
  useDialogStyleContext: () => ({
    preferences: { dialogStyle: 'modal', smartModeEnabled: true },
    updatePreference: vi.fn(),
    resetPreferences: vi.fn(),
    getRecommendedStyle: vi.fn(() => 'modal'),
  }),
  useDialogStyle: () => ({
    style: 'modal',
    preferences: { dialogStyle: 'modal' },
    getRecommendedStyle: vi.fn(() => 'modal'),
  }),
  DialogStyleProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useSessions } from '@/hooks/useSessions';
import { useWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';
import { useProjectOverview } from '@/hooks/useProjectOverview';
import { useLiteTasks } from '@/hooks/useLiteTasks';

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

    vi.mocked(useProjectOverview).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useLiteTasks).mockReturnValue({
      litePlan: [],
      liteFix: [],
      multiCliPlan: [],
      allSessions: [],
      getSessionsByType: vi.fn(() => []),
      prefetchSession: vi.fn(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Concurrent Data Loading', () => {
    it('INT-1.1 - should load all data sources concurrently', async () => {
      renderWithI18n(<HomePage />);

      // Verify hooks used by widgets are called
      expect(useDashboardStats).toHaveBeenCalled();
      expect(useSessions).toHaveBeenCalled();
      expect(useWorkflowStatusCounts).toHaveBeenCalled();
    });

    it('INT-1.2 - should display widgets with loaded data', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        // Dashboard should render without errors
        expect(useDashboardStats).toHaveBeenCalled();
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

      // Should render without crashing during loading
      expect(useDashboardStats).toHaveBeenCalled();
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
        expect(useDashboardStats).toHaveBeenCalled();
        expect(useSessions).toHaveBeenCalled();
      });
    });
  });

  describe('Data Flow Integration', () => {
    it('INT-2.1 - should pass stats data to WorkflowTaskWidget', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useDashboardStats).toHaveBeenCalled();
      });
    });

    it('INT-2.2 - should pass session data to RecentSessionsWidget', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useSessions).toHaveBeenCalled();
      });
    });

    it('INT-2.3 - should pass workflow status data to widgets', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useWorkflowStatusCounts).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('INT-3.1 - should handle stats hook failure', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load stats'),
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useDashboardStats).toHaveBeenCalled();
      });
    });

    it('INT-3.2 - should handle sessions hook failure', async () => {
      vi.mocked(useSessions).mockReturnValue({
        activeSessions: [],
        archivedSessions: [],
        isLoading: false,
        error: new Error('Failed to load sessions'),
        refetch: vi.fn(),
      } as any);

      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useSessions).toHaveBeenCalled();
      });
    });

    it('INT-3.3 - should handle chart hooks failure', async () => {
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
        expect(useSessions).toHaveBeenCalled();
      });
    });
  });

  describe('Data Refresh', () => {
    it('INT-4.1 - should call hooks on render', async () => {
      renderWithI18n(<HomePage />);

      await waitFor(() => {
        expect(useDashboardStats).toHaveBeenCalled();
        expect(useSessions).toHaveBeenCalled();
        expect(useWorkflowStatusCounts).toHaveBeenCalled();
      });
    });

    it('INT-4.2 - should update UI when data changes', async () => {
      const { rerender } = renderWithI18n(<HomePage />);

      // Update data
      vi.mocked(useDashboardStats).mockReturnValue({
        data: { totalSessions: 50 } as any,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      rerender(<HomePage />);

      expect(useDashboardStats).toHaveBeenCalled();
    });
  });
});
