// ========================================
// i18n Test Helpers
// ========================================
// Test utilities for internationalization

import { render as originalRender, type RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Locale } from '../types/store';

// Mock translation messages for testing
const mockMessages: Record<Locale, Record<string, string>> = {
  en: {
    // Common
    'common.appName': 'CCW',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.actions.cancel': 'Cancel',
    'common.actions.submit': 'Submit',
    'common.actions.close': 'Close',
    // Aria labels
    'common.aria.toggleNavigation': 'Toggle navigation',
    'common.aria.switchToDarkMode': 'Switch to dark mode',
    'common.aria.switchToLightMode': 'Switch to light mode',
    'common.aria.refreshWorkspace': 'Refresh workspace',
    'common.aria.userMenu': 'User menu',
    // Navigation - Header
    'navigation.header.brand': 'CCW Dashboard',
    'navigation.header.brandShort': 'CCW',
    'navigation.header.noProject': 'No project selected',
    'navigation.header.settings': 'Settings',
    'navigation.header.logout': 'Logout',
    // Navigation - Sidebar
    'navigation.home': 'Home',
    'navigation.sessions': 'Sessions',
    'navigation.issues': 'Issues',
    'navigation.orchestrator': 'Orchestrator',
    'navigation.settings': 'Settings',
    // Workspace selector
    'workspace.selector.noWorkspace': 'No workspace selected',
    'workspace.selector.recentPaths': 'Recent Projects',
    'workspace.selector.noRecentPaths': 'No recent projects',
    'workspace.selector.current': 'Current',
    'workspace.selector.browse': 'Select Folder...',
    'workspace.selector.removePath': 'Remove from recent',
    'workspace.selector.ariaLabel': 'Workspace selector',
    'workspace.selector.dialog.title': 'Select Project Folder',
    'workspace.selector.dialog.placeholder': 'Enter project path...',
    // Notifications
    'common.aria.notifications': 'Notifications',
  },
  zh: {
    // Common
    'common.appName': 'CCW',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.close': '关闭',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.actions.cancel': '取消',
    'common.actions.submit': '提交',
    'common.actions.close': '关闭',
    // Aria labels
    'common.aria.toggleNavigation': '切换导航',
    'common.aria.switchToDarkMode': '切换到深色模式',
    'common.aria.switchToLightMode': '切换到浅色模式',
    'common.aria.refreshWorkspace': '刷新工作区',
    'common.aria.userMenu': '用户菜单',
    // Navigation - Header
    'navigation.header.brand': 'CCW 控制台',
    'navigation.header.brandShort': 'CCW',
    'navigation.header.noProject': '未选择项目',
    'navigation.header.settings': '设置',
    'navigation.header.logout': '退出登录',
    // Navigation - Sidebar
    'navigation.home': '首页',
    'navigation.sessions': '会话',
    'navigation.issues': '问题',
    'navigation.orchestrator': '编排器',
    'navigation.settings': '设置',
    // Workspace selector
    'workspace.selector.noWorkspace': '未选择工作空间',
    'workspace.selector.recentPaths': '最近的项目',
    'workspace.selector.noRecentPaths': '没有最近的项目',
    'workspace.selector.current': '当前',
    'workspace.selector.browse': '选择文件夹...',
    'workspace.selector.removePath': '从最近记录中移除',
    'workspace.selector.ariaLabel': '工作空间选择器',
    'workspace.selector.dialog.title': '选择项目文件夹',
    'workspace.selector.dialog.placeholder': '输入项目路径...',
    // Notifications
    'common.aria.notifications': '通知',
  },
};

/**
 * Create a test QueryClient
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

/**
 * Wrapper component that includes i18n providers
 */
interface I18nWrapperProps {
  children: React.ReactNode;
  locale?: Locale;
}

function I18nWrapper({ children, locale = 'en' }: I18nWrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale={locale} messages={mockMessages[locale]}>
          {children}
        </IntlProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

/**
 * Custom render function with i18n support
 */
interface RenderWithI18nOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
}

export function renderWithI18n(
  ui: ReactElement,
  { locale = 'en', ...renderOptions }: RenderWithI18nOptions = {}
) {
  return originalRender(ui, {
    wrapper: ({ children }) => <I18nWrapper locale={locale}>{children}</I18nWrapper>,
    ...renderOptions,
  });
}

/**
 * Mock locale utilities
 */
export const mockLocaleUtils = {
  getInitialLocale: (locale: Locale = 'en'): Locale => locale,
  updateIntl: vi.fn(),
  getIntl: vi.fn(() => ({
    formatMessage: ({ id }: { id: string }) => id,
  })),
  formatMessage: (id: string) => id,
};

/**
 * Create a mock i18n context
 */
export function mockI18nContext(locale: Locale = 'en') {
  return {
    locale,
    messages: mockMessages[locale],
    formatMessage: (id: string, values?: Record<string, unknown>) => {
      const message = mockMessages[locale][id];
      if (!message) return id;
      if (!values) return message;

      // Simple placeholder replacement
      return message.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? key));
    },
  };
}

/**
 * Re-export commonly used testing utilities
 */
export {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  fireEvent,
} from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Export renderWithI18n as the default render for convenience
export { renderWithI18n as render };
