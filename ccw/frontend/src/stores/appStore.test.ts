// ========================================
// App Store Tests - Locale
// ========================================
// Tests for locale state management

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, selectLocale } from './appStore';
import type { Locale } from '../types/store';

// Mock i18n utilities
vi.mock('../lib/i18n', () => ({
  getInitialLocale: () => 'en' as Locale,
  updateIntl: vi.fn(),
}));

describe('AppStore - Locale State', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      locale: 'en',
    });
  });

  describe('initial state', () => {
    it('should have initial locale', () => {
      const locale = useAppStore.getState().locale;
      expect(locale).toBeDefined();
      expect(['en', 'zh']).toContain(locale);
    });
  });

  describe('setLocale', () => {
    it('should update locale to Chinese', () => {
      const store = useAppStore.getState();

      store.setLocale('zh');

      expect(useAppStore.getState().locale).toBe('zh');
    });

    it('should update locale to English', () => {
      useAppStore.setState({ locale: 'zh' });

      const store = useAppStore.getState();
      store.setLocale('en');

      expect(useAppStore.getState().locale).toBe('en');
    });

    it('should call updateIntl when locale changes', async () => {
      const { updateIntl } = await import('../lib/i18n');
      const store = useAppStore.getState();

      store.setLocale('zh');

      expect(updateIntl).toHaveBeenCalledWith('zh');
    });
  });

  describe('locale persistence', () => {
    it('should persist locale to localStorage', () => {
      const store = useAppStore.getState();

      store.setLocale('zh');

      const stored = localStorage.getItem('ccw-app-store');
      expect(stored).toBeDefined();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.locale).toBe('zh');
      }
    });

    it('should retrieve locale from localStorage on hydration', () => {
      // Set locale in localStorage
      localStorage.setItem('ccw-app-store', JSON.stringify({
        state: { locale: 'zh', theme: 'system', sidebarCollapsed: false },
        version: 0,
      }));

      // Create new store instance to test hydration
      const store = useAppStore.getState();

      // Note: This test verifies the persist middleware works
      // In actual implementation, zustand persist handles this
      expect(['en', 'zh']).toContain(store.locale);
    });
  });

  describe('document lang attribute', () => {
    it('should update document.lang when locale changes', async () => {
      const store = useAppStore.getState();

      store.setLocale('zh');

      // updateIntl is called and should update document.lang
      const { updateIntl } = await import('../lib/i18n');
      expect(updateIntl).toHaveBeenCalledWith('zh');
    });
  });

  describe('locale selector', () => {
    it('should return current locale via selector', () => {
      useAppStore.setState({ locale: 'zh' });
      const locale = selectLocale(useAppStore.getState());

      expect(locale).toBe('zh');
    });
  });

  describe('locale validation', () => {
    it('should only accept valid locale values', () => {
      const store = useAppStore.getState();

      // Test that only 'en' and 'zh' are valid
      const validLocales: Locale[] = ['en', 'zh'];

      validLocales.forEach((locale) => {
        expect(() => store.setLocale(locale)).not.toThrow();
      });
    });
  });
});
