// ========================================
// NotificationStore A2UI Methods Tests
// ========================================
// Tests for A2UI-related notification store functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationStore } from '../notificationStore';
import type { SurfaceUpdate } from '../../packages/a2ui-runtime/core/A2UITypes';

describe('NotificationStore A2UI Methods', () => {
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

  afterEach(() => {
    // Clean up any listeners
    window.removeEventListener('a2ui-action', vi.fn());
  });

  describe('addA2UINotification()', () => {
    it('should add A2UI notification to persistentNotifications array', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test-surface',
        components: [
          {
            id: 'comp-1',
            component: { Text: { text: { literalString: 'Hello' } } },
          },
        ],
        initialState: { key: 'value' },
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface, 'Test Surface');
      });

      expect(result.current.toasts).toHaveLength(0);
      expect(result.current.persistentNotifications).toHaveLength(1);
      expect(result.current.isPanelVisible).toBe(true);
      expect(result.current.persistentNotifications[0]).toMatchObject({
        type: 'a2ui',
        title: 'Test Surface',
        a2uiSurface: surface,
        a2uiState: { key: 'value' },
        dismissible: true,
        duration: 0, // Persistent by default
        read: false,
      });
    });

    it('should store surface in a2uiSurfaces Map', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'surface-123',
        components: [
          {
            id: 'comp-1',
            component: { Button: { onClick: { actionId: 'click' }, content: { Text: { text: { literalString: 'Click' } } } } },
          },
        ],
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface);
      });

      expect(result.current.a2uiSurfaces.has('surface-123')).toBe(true);
      expect(result.current.a2uiSurfaces.get('surface-123')).toEqual(surface);
    });

    it('should not be constrained by maxToasts (A2UI uses persistentNotifications)', () => {
      const { result } = renderHook(() => useNotificationStore());

      // Set max toasts to 3
      act(() => {
        result.current.maxToasts = 3;
      });

      // Add 4 A2UI notifications
      for (let i = 0; i < 4; i++) {
        act(() => {
          result.current.addA2UINotification({
            surfaceId: `surface-${i}`,
            components: [{ id: `comp-${i}`, component: { Text: { text: { literalString: `Test ${i}` } } } }],
          });
        });
      }

      expect(result.current.toasts).toHaveLength(0);
      expect(result.current.persistentNotifications).toHaveLength(4);
      expect(result.current.persistentNotifications[0].a2uiSurface?.surfaceId).toBe('surface-3');
      expect(result.current.persistentNotifications[3].a2uiSurface?.surfaceId).toBe('surface-0');
    });

    it('should use default title when not provided', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface);
      });

      expect(result.current.persistentNotifications[0].title).toBe('A2UI Surface');
    });

    it('should return notification ID', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
      };

      const { result } = renderHook(() => useNotificationStore());

      let notificationId: string = '';
      act(() => {
        notificationId = result.current.addA2UINotification(surface);
      });

      expect(notificationId).toBeDefined();
      expect(typeof notificationId).toBe('string');
      expect(result.current.persistentNotifications[0].id).toBe(notificationId);
    });

    it('should include initialState in a2uiState', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
        initialState: { counter: 0, user: 'Alice' },
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface);
      });

      expect(result.current.persistentNotifications[0].a2uiState).toEqual({ counter: 0, user: 'Alice' });
    });

    it('should default to empty a2uiState when initialState is not provided', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface);
      });

      expect(result.current.persistentNotifications[0].a2uiState).toEqual({});
    });
  });

  describe('updateA2UIState()', () => {
    it('should update a2uiState for matching notification', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test-surface',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
        initialState: { count: 0 },
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface);
      });

      act(() => {
        result.current.updateA2UIState('test-surface', { count: 5, newField: 'value' });
      });

      expect(result.current.persistentNotifications[0].a2uiState).toEqual({ count: 5, newField: 'value' });
    });

    it('should update surface initialState in a2uiSurfaces Map', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test-surface',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
        initialState: { value: 'initial' },
      };

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification(surface);
      });

      act(() => {
        result.current.updateA2UIState('test-surface', { value: 'updated' });
      });

      const updatedSurface = result.current.a2uiSurfaces.get('test-surface');
      expect(updatedSurface?.initialState).toEqual({ value: 'updated' });
    });

    it('should not affect other notifications with different surface IDs', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification({
          surfaceId: 'surface-1',
          components: [{ id: 'c1', component: { Text: { text: { literalString: 'A' } } } }],
          initialState: { value: 'A' },
        });
        result.current.addA2UINotification({
          surfaceId: 'surface-2',
          components: [{ id: 'c2', component: { Text: { text: { literalString: 'B' } } } }],
          initialState: { value: 'B' },
        });
      });

      act(() => {
        result.current.updateA2UIState('surface-1', { value: 'A-updated' });
      });

      // addA2UINotification prepends, so surface-2 is index 0 and surface-1 is index 1
      expect(result.current.persistentNotifications[0].a2uiState).toEqual({ value: 'B' });
      expect(result.current.persistentNotifications[1].a2uiState).toEqual({ value: 'A-updated' });
    });

    it('should handle updates for non-existent surface gracefully', () => {
      const { result } = renderHook(() => useNotificationStore());

      expect(() => {
        act(() => {
          result.current.updateA2UIState('non-existent', { value: 'test' });
        });
      }).not.toThrow();
    });
  });

  describe('sendA2UIAction()', () => {
    it('should dispatch custom event with action details', () => {
      const { result } = renderHook(() => useNotificationStore());

      const mockListener = vi.fn();
      window.addEventListener('a2ui-action', mockListener);

      act(() => {
        result.current.sendA2UIAction('test-action', 'surface-123', { key: 'value' });
      });

      expect(mockListener).toHaveBeenCalledTimes(1);
      const event = mockListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({
        type: 'a2ui-action',
        actionId: 'test-action',
        surfaceId: 'surface-123',
        parameters: { key: 'value' },
      });

      window.removeEventListener('a2ui-action', mockListener);
    });

    it('should use empty parameters object when not provided', () => {
      const { result } = renderHook(() => useNotificationStore());

      const mockListener = vi.fn();
      window.addEventListener('a2ui-action', mockListener);

      act(() => {
        result.current.sendA2UIAction('action-1', 'surface-1');
      });

      const event = mockListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.parameters).toEqual({});

      window.removeEventListener('a2ui-action', mockListener);
    });

    it('should dispatch event on window object', () => {
      const { result } = renderHook(() => useNotificationStore());

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      act(() => {
        result.current.sendA2UIAction('test', 'surface-1', { data: 'test' });
      });

      expect(dispatchSpy).toHaveBeenCalled();
      expect(dispatchSpy.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
      expect((dispatchSpy.mock.calls[0][0] as CustomEvent).type).toBe('a2ui-action');

      dispatchSpy.mockRestore();
    });
  });

  describe('setCurrentQuestion()', () => {
    it('should set current question state', () => {
      const { result } = renderHook(() => useNotificationStore());

      const mockQuestion = {
        surfaceId: 'question-1',
        title: 'Test Question',
        questions: [
          { id: 'q1', question: 'What is your name?', type: 'text' as const, required: true },
        ],
      };

      act(() => {
        result.current.setCurrentQuestion(mockQuestion);
      });

      expect(result.current.currentQuestion).toEqual(mockQuestion);
    });

    it('should clear question when set to null', () => {
      const { result } = renderHook(() => useNotificationStore());

      const mockQuestion = {
        surfaceId: 'question-1',
        title: 'Test',
        questions: [{ id: 'q1', question: 'Test?', type: 'text' as const, required: true }],
      };

      act(() => {
        result.current.setCurrentQuestion(mockQuestion);
      });
      expect(result.current.currentQuestion).toEqual(mockQuestion);

      act(() => {
        result.current.setCurrentQuestion(null);
      });
      expect(result.current.currentQuestion).toBeNull();
    });
  });

  describe('Integration with persistent notification actions', () => {
    it('should allow removing A2UI notification via removePersistentNotification', () => {
      const surface: SurfaceUpdate = {
        surfaceId: 'test',
        components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
      };

      const { result } = renderHook(() => useNotificationStore());

      let notificationId: string = '';
      act(() => {
        notificationId = result.current.addA2UINotification(surface);
      });

      expect(result.current.persistentNotifications).toHaveLength(1);

      act(() => {
        result.current.removePersistentNotification(notificationId);
      });

      expect(result.current.persistentNotifications).toHaveLength(0);
    });

    it('should clear all A2UI notifications with clearPersistentNotifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification({
          surfaceId: 's1',
          components: [{ id: 'c1', component: { Text: { text: { literalString: 'A' } } } }],
        });
        // Duration 0 avoids auto-timeout side effects in tests
        result.current.addToast({ type: 'info', title: 'Regular toast', duration: 0 });
        result.current.addA2UINotification({
          surfaceId: 's2',
          components: [{ id: 'c2', component: { Text: { text: { literalString: 'B' } } } }],
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.persistentNotifications).toHaveLength(2);

      act(() => {
        result.current.clearPersistentNotifications();
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.persistentNotifications).toHaveLength(0);
    });
  });

  describe('A2UI surfaces Map management', () => {
    it('should maintain separate surfaces Map from persistent notifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addA2UINotification({
          surfaceId: 'surface-1',
          components: [{ id: 'c1', component: { Text: { text: { literalString: 'Test' } } } }],
        });
      });

      expect(result.current.a2uiSurfaces.size).toBe(1);
      expect(result.current.toasts).toHaveLength(0);
      expect(result.current.persistentNotifications).toHaveLength(1);

      act(() => {
        result.current.removePersistentNotification(result.current.persistentNotifications[0].id);
      });

      // Surface should remain in Map even after notification is removed (cleanup happens in NotificationPanel)
      expect(result.current.a2uiSurfaces.size).toBe(1);
      expect(result.current.persistentNotifications).toHaveLength(0);
    });
  });
});
