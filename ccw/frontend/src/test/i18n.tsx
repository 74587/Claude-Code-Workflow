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
import enMessages from '../locales/en/index';
import zhMessages from '../locales/zh/index';

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
    'common.actions.refresh': 'Refresh',
    'common.actions.resetLayout': 'Reset Layout',
    // Dashboard
    'home.dashboard.title': 'Dashboard',
    'home.dashboard.description': 'Monitor your project activity and metrics',
    'home.dashboard.refreshTooltip': 'Refresh dashboard data',
    // Issues - Queue
    'issues.queue.pageTitle': 'Issue Queue',
    'issues.queue.pageDescription': 'Manage issue execution queue with execution groups',
    'issues.queue.title': 'Queue',
    'issues.queue.stats.totalItems': 'Total Items',
    'issues.queue.stats.groups': 'Groups',
    'issues.queue.stats.tasks': 'Tasks',
    'issues.queue.stats.solutions': 'Solutions',
    'issues.queue.status.active': 'Active',
    'issues.queue.status.inactive': 'Inactive',
    'issues.queue.status.ready': 'Ready',
    'issues.queue.status.pending': 'Pending',
    'issues.queue.items': 'Items',
    'issues.queue.groups': 'Groups',
    'issues.queue.conflicts': 'conflicts',
    'issues.queue.conflicts.title': 'Conflicts Detected',
    'issues.queue.conflicts.description': 'conflicts detected in queue',
    'issues.queue.parallelGroup': 'Parallel',
    'issues.queue.sequentialGroup': 'Sequential',
    'issues.queue.executionGroups': 'Execution Groups',
    'issues.queue.empty': 'No items in queue',
    'issues.queue.emptyState.title': 'No Queue Data',
    'issues.queue.emptyState.description': 'No queue data available',
    'issues.queue.error.title': 'Error Loading Queue',
    'issues.queue.error.message': 'Failed to load queue data',
    'issues.queue.actions.activate': 'Activate',
    'issues.queue.actions.deactivate': 'Deactivate',
    'issues.queue.actions.delete': 'Delete',
    'issues.queue.actions.merge': 'Merge',
    'issues.queue.deleteDialog.title': 'Delete Queue',
    'issues.queue.deleteDialog.description': 'Are you sure you want to delete this queue?',
    'issues.queue.mergeDialog.title': 'Merge Queues',
    'issues.queue.mergeDialog.targetQueueLabel': 'Target Queue',
    'issues.queue.mergeDialog.targetQueuePlaceholder': 'Select target queue',
    'common.actions.openMenu': 'Open menu',
    // Issues - Discovery
    'issues.discovery.title': 'Issue Discovery',
    'issues.discovery.pageTitle': 'Issue Discovery',
    'issues.discovery.description': 'View and manage issue discovery sessions',
    'issues.discovery.totalSessions': 'Total Sessions',
    'issues.discovery.completedSessions': 'Completed',
    'issues.discovery.runningSessions': 'Running',
    'issues.discovery.totalFindings': 'Total Findings',
    'issues.discovery.sessionList': 'Sessions',
    'issues.discovery.findingsDetail': 'Findings Detail',
    'issues.discovery.noSessions': 'No Sessions',
    'issues.discovery.noSessionsDescription': 'No discovery sessions found',
    'issues.discovery.noSessionSelected': 'Select a session to view findings',
    'issues.discovery.status.running': 'Running',
    'issues.discovery.status.completed': 'Completed',
    'issues.discovery.status.failed': 'Failed',
    'issues.discovery.progress': 'Progress',
    'issues.discovery.findings': 'Findings',
    // CodexLens (v2)
    'codexlens.title': 'Search Manager',
    'codexlens.description': 'V2 semantic search index management',
    'codexlens.reindex': 'Reindex',
    'codexlens.reindexing': 'Reindexing...',
    'codexlens.statusError': 'Failed to load search index status',
    'codexlens.indexStatus.title': 'Index Status',
    'codexlens.indexStatus.status': 'Status',
    'codexlens.indexStatus.ready': 'Ready',
    'codexlens.indexStatus.notIndexed': 'Not Indexed',
    'codexlens.indexStatus.files': 'Files',
    'codexlens.indexStatus.dbSize': 'DB Size',
    'codexlens.indexStatus.lastIndexed': 'Last Indexed',
    'codexlens.indexStatus.chunks': 'Chunks',
    'codexlens.indexStatus.vectorDim': 'Vector Dim',
    'codexlens.indexStatus.enabled': 'Enabled',
    'codexlens.indexStatus.disabled': 'Disabled',
    'codexlens.indexStatus.unavailable': 'Index status unavailable',
    'codexlens.searchTest.title': 'Search Test',
    'codexlens.searchTest.placeholder': 'Enter search query...',
    'codexlens.searchTest.button': 'Search',
    'codexlens.searchTest.results': 'results',
    'codexlens.searchTest.noResults': 'No results found',
    // MCP - CCW Tools
    'mcp.ccw.title': 'CCW MCP Server',
    'mcp.ccw.description': 'Configure CCW MCP tools and paths',
    'mcp.ccw.status.installed': 'Installed',
    'mcp.ccw.status.notInstalled': 'Not installed',
    'mcp.ccw.status.special': 'Special',
    'mcp.ccw.actions.enableAll': 'Enable All',
    'mcp.ccw.actions.disableAll': 'Disable All',
    'mcp.ccw.actions.saveConfig': 'Save Configuration',
    'mcp.ccw.actions.saving': 'Saving...',
    'mcp.ccw.actions.installing': 'Installing...',
    'mcp.ccw.actions.uninstall': 'Uninstall',
    'mcp.ccw.actions.uninstalling': 'Uninstalling...',
    'mcp.ccw.actions.uninstallConfirm': 'Are you sure you want to uninstall?',
    'mcp.ccw.actions.uninstallScopeConfirm': 'Are you sure you want to uninstall from this scope?',
    'mcp.ccw.codexNote': 'Codex only supports global installation',
    'mcp.ccw.tools.label': 'Tools',
    'mcp.ccw.tools.hint': 'Install to edit tools',
    'mcp.ccw.tools.core': 'Core',
    'mcp.ccw.tools.write_file.name': 'Write File',
    'mcp.ccw.tools.write_file.desc': 'Write/create files',
    'mcp.ccw.tools.edit_file.name': 'Edit File',
    'mcp.ccw.tools.edit_file.desc': 'Edit/replace content',
    'mcp.ccw.tools.read_file.name': 'Read File',
    'mcp.ccw.tools.read_file.desc': 'Read single file',
    'mcp.ccw.tools.read_many_files.name': 'Read Many Files',
    'mcp.ccw.tools.read_many_files.desc': 'Read multiple files/dirs',
    'mcp.ccw.tools.core_memory.name': 'Core Memory',
    'mcp.ccw.tools.core_memory.desc': 'Core memory management',
    'mcp.ccw.tools.ask_question.name': 'Ask Question',
    'mcp.ccw.tools.ask_question.desc': 'Interactive questions (A2UI)',
    'mcp.ccw.tools.smart_search.name': 'Smart Search',
    'mcp.ccw.tools.smart_search.desc': 'Intelligent code search',
    'mcp.ccw.tools.team_msg.name': 'Team Message',
    'mcp.ccw.tools.team_msg.desc': 'Agent team message bus',
    'mcp.ccw.paths.label': 'Paths',
    'mcp.ccw.paths.projectRoot': 'Project Root',
    'mcp.ccw.paths.projectRootPlaceholder': 'e.g. D:\\path\\to\\project',
    'mcp.ccw.paths.allowedDirs': 'Allowed Directories',
    'mcp.ccw.paths.allowedDirsPlaceholder': 'Comma-separated directories',
    'mcp.ccw.paths.allowedDirsHint': 'Separate multiple directories with commas',
    'mcp.ccw.paths.enableSandbox': 'Enable Sandbox',
    'mcp.ccw.scope.installToGlobal': 'Install to Global',
    'mcp.ccw.scope.installToProject': 'Install to Project',
    'mcp.ccw.scope.uninstallGlobal': 'Uninstall Global',
    'mcp.ccw.scope.uninstallProject': 'Uninstall Project',
    'mcp.ccw.feedback.saveSuccess': 'Configuration saved',
    'mcp.ccw.feedback.saveError': 'Failed to save configuration',
    'navigation.codexlens': 'CodexLens',
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
    'common.actions.refresh': '刷新',
    'common.actions.resetLayout': '重置布局',
    // Dashboard
    'home.dashboard.title': '仪表盘',
    'home.dashboard.description': '监控您的项目活动和指标',
    'home.dashboard.refreshTooltip': '刷新仪表盘数据',
    // Issues - Queue
    'issues.queue.pageTitle': '问题队列',
    'issues.queue.pageDescription': '管理问题执行队列和执行组',
    'issues.queue.title': '队列',
    'issues.queue.stats.totalItems': '总项目',
    'issues.queue.stats.groups': '执行组',
    'issues.queue.stats.tasks': '任务',
    'issues.queue.stats.solutions': '解决方案',
    'issues.queue.status.active': '活跃',
    'issues.queue.status.inactive': '未激活',
    'issues.queue.status.ready': '就绪',
    'issues.queue.status.pending': '等待中',
    'issues.queue.items': '项目',
    'issues.queue.groups': '执行组',
    'issues.queue.conflicts': '冲突',
    'issues.queue.conflicts.title': '检测到冲突',
    'issues.queue.conflicts.description': '队列中检测到冲突',
    'issues.queue.parallelGroup': '并行',
    'issues.queue.sequentialGroup': '顺序',
    'issues.queue.executionGroups': '执行组',
    'issues.queue.empty': '队列中无项目',
    'issues.queue.emptyState.title': '无队列数据',
    'issues.queue.emptyState.description': '无队列数据可用',
    'issues.queue.error.title': '加载队列错误',
    'issues.queue.error.message': '加载队列数据失败',
    'issues.queue.actions.activate': '激活',
    'issues.queue.actions.deactivate': '停用',
    'issues.queue.actions.delete': '删除',
    'issues.queue.actions.merge': '合并',
    'issues.queue.deleteDialog.title': '删除队列',
    'issues.queue.deleteDialog.description': '确定要删除此队列吗？',
    'issues.queue.mergeDialog.title': '合并队列',
    'issues.queue.mergeDialog.targetQueueLabel': '目标队列',
    'issues.queue.mergeDialog.targetQueuePlaceholder': '选择目标队列',
    'common.actions.openMenu': '打开菜单',
    // Issues - Discovery
    'issues.discovery.title': '问题发现',
    'issues.discovery.pageTitle': '问题发现',
    'issues.discovery.description': '查看和管理问题发现会话',
    'issues.discovery.totalSessions': '总会话数',
    'issues.discovery.completedSessions': '已完成',
    'issues.discovery.runningSessions': '运行中',
    'issues.discovery.totalFindings': '总发现数',
    'issues.discovery.sessionList': '会话',
    'issues.discovery.findingsDetail': '发现详情',
    'issues.discovery.noSessions': '无会话',
    'issues.discovery.noSessionsDescription': '未发现发现会话',
    'issues.discovery.noSessionSelected': '选择会话以查看发现',
    'issues.discovery.status.running': '运行中',
    'issues.discovery.status.completed': '已完成',
    'issues.discovery.status.failed': '失败',
    'issues.discovery.progress': '进度',
    'issues.discovery.findings': '发现',
    // CodexLens (v2)
    'codexlens.title': '搜索管理',
    'codexlens.description': 'V2 语义搜索索引管理',
    'codexlens.reindex': '重建索引',
    'codexlens.reindexing': '重建中...',
    'codexlens.statusError': '加载搜索索引状态失败',
    'codexlens.indexStatus.title': '索引状态',
    'codexlens.indexStatus.status': '状态',
    'codexlens.indexStatus.ready': '就绪',
    'codexlens.indexStatus.notIndexed': '未索引',
    'codexlens.indexStatus.files': '文件数',
    'codexlens.indexStatus.dbSize': '数据库大小',
    'codexlens.indexStatus.lastIndexed': '上次索引',
    'codexlens.indexStatus.chunks': '分块数',
    'codexlens.indexStatus.vectorDim': '向量维度',
    'codexlens.indexStatus.enabled': '已启用',
    'codexlens.indexStatus.disabled': '已禁用',
    'codexlens.indexStatus.unavailable': '索引状态不可用',
    'codexlens.searchTest.title': '搜索测试',
    'codexlens.searchTest.placeholder': '输入搜索查询...',
    'codexlens.searchTest.button': '搜索',
    'codexlens.searchTest.results': '个结果',
    'codexlens.searchTest.noResults': '未找到结果',
    // MCP - CCW Tools
    'mcp.ccw.title': 'CCW MCP 服务器',
    'mcp.ccw.description': '配置 CCW MCP 工具与路径',
    'mcp.ccw.status.installed': '已安装',
    'mcp.ccw.status.notInstalled': '未安装',
    'mcp.ccw.status.special': '特殊',
    'mcp.ccw.actions.enableAll': '全选',
    'mcp.ccw.actions.disableAll': '全不选',
    'mcp.ccw.actions.saveConfig': '保存配置',
    'mcp.ccw.actions.saving': '保存中...',
    'mcp.ccw.actions.installing': '安装中...',
    'mcp.ccw.actions.uninstall': '卸载',
    'mcp.ccw.actions.uninstalling': '卸载中...',
    'mcp.ccw.actions.uninstallConfirm': '确定要卸载吗？',
    'mcp.ccw.actions.uninstallScopeConfirm': '确定要从该作用域卸载吗？',
    'mcp.ccw.codexNote': 'Codex 仅支持全局安装',
    'mcp.ccw.tools.label': '工具',
    'mcp.ccw.tools.hint': '安装后可编辑工具',
    'mcp.ccw.tools.core': '核心',
    'mcp.ccw.tools.write_file.name': '写入文件',
    'mcp.ccw.tools.write_file.desc': '写入/创建文件',
    'mcp.ccw.tools.edit_file.name': '编辑文件',
    'mcp.ccw.tools.edit_file.desc': '编辑/替换内容',
    'mcp.ccw.tools.read_file.name': '读取文件',
    'mcp.ccw.tools.read_file.desc': '读取单个文件',
    'mcp.ccw.tools.read_many_files.name': '读取多个文件',
    'mcp.ccw.tools.read_many_files.desc': '读取多个文件/目录',
    'mcp.ccw.tools.core_memory.name': '核心记忆',
    'mcp.ccw.tools.core_memory.desc': '核心记忆管理',
    'mcp.ccw.tools.ask_question.name': '提问',
    'mcp.ccw.tools.ask_question.desc': '交互式问题（A2UI）',
    'mcp.ccw.tools.smart_search.name': '智能搜索',
    'mcp.ccw.tools.smart_search.desc': '智能代码搜索',
    'mcp.ccw.tools.team_msg.name': '团队消息',
    'mcp.ccw.tools.team_msg.desc': '代理团队消息总线',
    'mcp.ccw.paths.label': '路径',
    'mcp.ccw.paths.projectRoot': '项目根目录',
    'mcp.ccw.paths.projectRootPlaceholder': '例如：D:\\path\\to\\project',
    'mcp.ccw.paths.allowedDirs': '允许目录',
    'mcp.ccw.paths.allowedDirsPlaceholder': '用逗号分隔的目录',
    'mcp.ccw.paths.allowedDirsHint': '使用逗号分隔多个目录',
    'mcp.ccw.paths.enableSandbox': '启用沙箱',
    'mcp.ccw.scope.installToGlobal': '安装到全局',
    'mcp.ccw.scope.installToProject': '安装到项目',
    'mcp.ccw.scope.uninstallGlobal': '卸载全局',
    'mcp.ccw.scope.uninstallProject': '卸载项目',
    'mcp.ccw.feedback.saveSuccess': '配置已保存',
    'mcp.ccw.feedback.saveError': '保存配置失败',
    'navigation.codexlens': 'CodexLens',
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

const testMessages: Record<Locale, Record<string, string>> = {
  en: { ...enMessages, ...mockMessages.en },
  zh: { ...zhMessages, ...mockMessages.zh },
};

function handleIntlTestError(error: unknown): void {
  const intlError = error as { code?: string } | undefined;
  if (intlError?.code === 'MISSING_TRANSLATION') {
    return;
  }

  console.error(error);
}

const testRouterFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

function I18nWrapper({ children, locale = 'en' }: I18nWrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <MemoryRouter future={testRouterFutureConfig}>
      <QueryClientProvider client={queryClient}>
        <IntlProvider
          locale={locale}
          messages={testMessages[locale]}
          onError={handleIntlTestError}
        >
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
    messages: testMessages[locale],
    formatMessage: (id: string, values?: Record<string, unknown>) => {
      const message = testMessages[locale][id];
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
