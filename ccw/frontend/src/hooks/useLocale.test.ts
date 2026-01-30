// ========================================
// useLocale Hook Tests
// ========================================
// Tests for the useLocale hook

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocale } from './useLocale';
import { useAppStore } from '../stores/appStore';

describe('useLocale Hook', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({ locale: 'en' });
  });

  describe('returns current locale', () => {
    it('should return current locale from store', () => {
      useAppStore.setState({ locale: 'en' });

      const { result } = renderHook(() => useLocale());

      expect(result.current.locale).toBe('en');
    });

    it('should return zh when locale is Chinese', () => {
      useAppStore.setState({ locale: 'zh' });

      const { result } = renderHook(() => useLocale());

      expect(result.current.locale).toBe('zh');
    });
  });

  describe('returns setLocale function', () => {
    it('should provide setLocale function', () => {
      const { result } = renderHook(() => useLocale());

      expect(typeof result.current.setLocale).toBe('function');
    });

    it('should update locale when setLocale is called', () => {
      const { result } = renderHook(() => useLocale());

      act(() => {
        result.current.setLocale('zh');
      });

      expect(result.current.locale).toBe('zh');
    });

    it('should persist locale change to store', () => {
      const { result } = renderHook(() => useLocale());

      act(() => {
        result.current.setLocale('zh');
      });

      const storeLocale = useAppStore.getState().locale;
      expect(storeLocale).toBe('zh');
    });
  });

  describe('returns available locales', () => {
    it('should provide availableLocales object', () => {
      const { result } = renderHook(() => useLocale());

      expect(typeof result.current.availableLocales).toBe('object');
      expect(result.current.availableLocales).toBeDefined();
    });

    it('should include English in available locales', () => {
      const { result } = renderHook(() => useLocale());

      expect(result.current.availableLocales.en).toBe('English');
    });

    it('should include Chinese in available locales', () => {
      const { result } = renderHook(() => useLocale());

      expect(result.current.availableLocales.zh).toBe('中文');
    });
  });

  describe('locale switching behavior', () => {
    it('should switch between en and zh', () => {
      const { result } = renderHook(() => useLocale());

      expect(result.current.locale).toBe('en');

      act(() => {
        result.current.setLocale('zh');
      });

      expect(result.current.locale).toBe('zh');

      act(() => {
        result.current.setLocale('en');
      });

      expect(result.current.locale).toBe('en');
    });
  });

  describe('return type integrity', () => {
    it('should match UseLocaleReturn interface', () => {
      const { result } = renderHook(() => useLocale());

      expect(result.current).toHaveProperty('locale');
      expect(result.current).toHaveProperty('setLocale');
      expect(result.current).toHaveProperty('availableLocales');
    });

    it('should have correct types for properties', () => {
      const { result } = renderHook(() => useLocale());

      // locale should be 'en' or 'zh'
      expect(['en', 'zh']).toContain(result.current.locale);

      // setLocale should be a function
      expect(typeof result.current.setLocale).toBe('function');

      // availableLocales should be a record
      expect(typeof result.current.availableLocales).toBe('object');
    });
  });

  describe('integration with appStore', () => {
    it('should reflect store changes in hook output', () => {
      const { result } = renderHook(() => useLocale());

      act(() => {
        useAppStore.getState().setLocale('zh');
      });

      expect(result.current.locale).toBe('zh');
    });

    it('should update store when setLocale is called', () => {
      const { result } = renderHook(() => useLocale());

      act(() => {
        result.current.setLocale('zh');
      });

      expect(useAppStore.getState().locale).toBe('zh');
    });
  });
});
