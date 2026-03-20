// ========================================
// UX Tests: Error Handling in Hooks
// ========================================
// Tests for UX feedback patterns: error handling with toast notifications in hooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import * as React from 'react';
import { useCommands } from '../useCommands';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock the API
vi.mock('../../lib/api', () => ({
  fetchCommands: vi.fn(),
  deleteCommand: vi.fn(),
  createCommand: vi.fn(),
  updateCommand: vi.fn(),
}));

// Mock workflowStore to provide projectPath
vi.mock('../../stores/workflowStore', () => ({
  useWorkflowStore: (selector: (state: { projectPath: string }) => string) =>
    selector({ projectPath: '/test/project' }),
  selectProjectPath: (state: { projectPath: string }) => state.projectPath,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(IntlProvider, { locale: 'en', messages: {} }, children)
    );
};

describe('UX Pattern: Error Handling in useCommands Hook', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNotificationStore.setState({
      toasts: [],
      a2uiSurfaces: new Map(),
      currentQuestion: null,
      persistentNotifications: [],
      isPanelVisible: false,
    });
    localStorage.removeItem('ccw_notifications');
    vi.clearAllMocks();
  });

  describe('Error notification on command fetch failure', () => {
    it('should surface error state when fetch fails', async () => {
      const { waitFor } = await import('@testing-library/react');
      const { fetchCommands } = await import('../../lib/api');
      vi.mocked(fetchCommands).mockRejectedValue(new Error('Command fetch failed'));

      const { result } = renderHook(() => useCommands(), { wrapper: createWrapper() });

      // Wait for TanStack Query to settle — error should eventually appear
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should remain functional after fetch error', async () => {
      const { fetchCommands } = await import('../../lib/api');
      vi.mocked(fetchCommands).mockRejectedValueOnce(new Error('Temporary failure'));

      const { result } = renderHook(() => useCommands(), { wrapper: createWrapper() });

      await act(async () => {
        try {
          await result.current.refetch();
        } catch {
          // Expected to throw
        }
      });

      // Hook should still return stable values
      expect(Array.isArray(result.current.commands)).toBe(true);
    });
  });
});
