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
    // CodexLens
    'codexlens.title': 'CodexLens',
    'codexlens.description': 'Semantic code search engine',
    'codexlens.bootstrap': 'Bootstrap',
    'codexlens.bootstrapping': 'Bootstrapping...',
    'codexlens.uninstall': 'Uninstall',
    'codexlens.uninstalling': 'Uninstalling...',
    'codexlens.confirmUninstall': 'Are you sure you want to uninstall CodexLens?',
    'codexlens.notInstalled': 'CodexLens is not installed',
    'codexlens.comingSoon': 'Coming Soon',
    'codexlens.tabs.overview': 'Overview',
    'codexlens.tabs.settings': 'Settings',
    'codexlens.tabs.models': 'Models',
    'codexlens.tabs.advanced': 'Advanced',
    'codexlens.overview.status.installation': 'Installation Status',
    'codexlens.overview.status.ready': 'Ready',
    'codexlens.overview.status.notReady': 'Not Ready',
    'codexlens.overview.status.version': 'Version',
    'codexlens.overview.status.indexPath': 'Index Path',
    'codexlens.overview.status.indexCount': 'Index Count',
    'codexlens.overview.notInstalled.title': 'CodexLens Not Installed',
    'codexlens.overview.notInstalled.message': 'Please install CodexLens to use semantic code search features.',
    'codexlens.overview.actions.title': 'Quick Actions',
    'codexlens.overview.actions.ftsFull': 'FTS Full',
    'codexlens.overview.actions.ftsFullDesc': 'Rebuild full-text index',
    'codexlens.overview.actions.ftsIncremental': 'FTS Incremental',
    'codexlens.overview.actions.ftsIncrementalDesc': 'Incremental update full-text index',
    'codexlens.overview.actions.vectorFull': 'Vector Full',
    'codexlens.overview.actions.vectorFullDesc': 'Rebuild vector index',
    'codexlens.overview.actions.vectorIncremental': 'Vector Incremental',
    'codexlens.overview.actions.vectorIncrementalDesc': 'Incremental update vector index',
    'codexlens.overview.venv.title': 'Python Virtual Environment Details',
    'codexlens.overview.venv.pythonVersion': 'Python Version',
    'codexlens.overview.venv.venvPath': 'Virtual Environment Path',
    'codexlens.overview.venv.lastCheck': 'Last Check Time',
    'codexlens.settings.currentCount': 'Current Index Count',
    'codexlens.settings.currentWorkers': 'Current Workers',
    'codexlens.settings.currentBatchSize': 'Current Batch Size',
    'codexlens.settings.configTitle': 'Basic Configuration',
    'codexlens.settings.indexDir.label': 'Index Directory',
    'codexlens.settings.indexDir.placeholder': '~/.codexlens/indexes',
    'codexlens.settings.indexDir.hint': 'Directory path for storing code indexes',
    'codexlens.settings.maxWorkers.label': 'Max Workers',
    'codexlens.settings.maxWorkers.hint': 'API concurrent processing threads (1-32)',
    'codexlens.settings.batchSize.label': 'Batch Size',
    'codexlens.settings.batchSize.hint': 'Number of files processed per batch (1-64)',
    'codexlens.settings.validation.indexDirRequired': 'Index directory is required',
    'codexlens.settings.validation.maxWorkersRange': 'Workers must be between 1 and 32',
    'codexlens.settings.validation.batchSizeRange': 'Batch size must be between 1 and 64',
    'codexlens.settings.save': 'Save',
    'codexlens.settings.saving': 'Saving...',
    'codexlens.settings.reset': 'Reset',
    'codexlens.settings.saveSuccess': 'Configuration saved',
    'codexlens.settings.saveFailed': 'Save failed',
    'codexlens.settings.configUpdated': 'Configuration updated successfully',
    'codexlens.settings.saveError': 'Error saving configuration',
    'codexlens.settings.unknownError': 'An unknown error occurred',
    'codexlens.models.title': 'Model Management',
    'codexlens.models.searchPlaceholder': 'Search models...',
    'codexlens.models.downloading': 'Downloading...',
    'codexlens.models.status.downloaded': 'Downloaded',
    'codexlens.models.status.available': 'Available',
    'codexlens.models.types.embedding': 'Embedding Models',
    'codexlens.models.types.reranker': 'Reranker Models',
    'codexlens.models.filters.label': 'Filter',
    'codexlens.models.filters.all': 'All',
    'codexlens.models.actions.download': 'Download',
    'codexlens.models.actions.delete': 'Delete',
    'codexlens.models.actions.cancel': 'Cancel',
    'codexlens.models.custom.title': 'Custom Model',
    'codexlens.models.custom.placeholder': 'HuggingFace model name (e.g., BAAI/bge-small-zh-v1.5)',
    'codexlens.models.custom.description': 'Download custom models from HuggingFace. Ensure the model name is correct.',
    'codexlens.models.deleteConfirm': 'Are you sure you want to delete model {modelName}?',
    'codexlens.models.notInstalled.title': 'CodexLens Not Installed',
    'codexlens.models.notInstalled.description': 'Please install CodexLens to use model management features.',
    'codexlens.models.empty.title': 'No models found',
    'codexlens.models.empty.description': 'Try adjusting your search or filter criteria',
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
    // CodexLens
    'codexlens.title': 'CodexLens',
    'codexlens.description': '语义代码搜索引擎',
    'codexlens.bootstrap': '引导安装',
    'codexlens.bootstrapping': '安装中...',
    'codexlens.uninstall': '卸载',
    'codexlens.uninstalling': '卸载中...',
    'codexlens.confirmUninstall': '确定要卸载 CodexLens 吗？',
    'codexlens.notInstalled': 'CodexLens 尚未安装',
    'codexlens.comingSoon': '即将推出',
    'codexlens.tabs.overview': '概览',
    'codexlens.tabs.settings': '设置',
    'codexlens.tabs.models': '模型',
    'codexlens.tabs.advanced': '高级',
    'codexlens.overview.status.installation': '安装状态',
    'codexlens.overview.status.ready': '就绪',
    'codexlens.overview.status.notReady': '未就绪',
    'codexlens.overview.status.version': '版本',
    'codexlens.overview.status.indexPath': '索引路径',
    'codexlens.overview.status.indexCount': '索引数量',
    'codexlens.overview.notInstalled.title': 'CodexLens 未安装',
    'codexlens.overview.notInstalled.message': '请先安装 CodexLens 以使用语义代码搜索功能。',
    'codexlens.overview.actions.title': '快速操作',
    'codexlens.overview.actions.ftsFull': 'FTS 全量',
    'codexlens.overview.actions.ftsFullDesc': '重建全文索引',
    'codexlens.overview.actions.ftsIncremental': 'FTS 增量',
    'codexlens.overview.actions.ftsIncrementalDesc': '增量更新全文索引',
    'codexlens.overview.actions.vectorFull': '向量全量',
    'codexlens.overview.actions.vectorFullDesc': '重建向量索引',
    'codexlens.overview.actions.vectorIncremental': '向量增量',
    'codexlens.overview.actions.vectorIncrementalDesc': '增量更新向量索引',
    'codexlens.overview.venv.title': 'Python 虚拟环境详情',
    'codexlens.overview.venv.pythonVersion': 'Python 版本',
    'codexlens.overview.venv.venvPath': '虚拟环境路径',
    'codexlens.overview.venv.lastCheck': '最后检查时间',
    'codexlens.settings.currentCount': '当前索引数量',
    'codexlens.settings.currentWorkers': '当前工作线程',
    'codexlens.settings.currentBatchSize': '当前批次大小',
    'codexlens.settings.configTitle': '基本配置',
    'codexlens.settings.indexDir.label': '索引目录',
    'codexlens.settings.indexDir.placeholder': '~/.codexlens/indexes',
    'codexlens.settings.indexDir.hint': '存储代码索引的目录路径',
    'codexlens.settings.maxWorkers.label': '最大工作线程',
    'codexlens.settings.maxWorkers.hint': 'API 并发处理线程数 (1-32)',
    'codexlens.settings.batchSize.label': '批次大小',
    'codexlens.settings.batchSize.hint': '每次批量处理的文件数量 (1-64)',
    'codexlens.settings.validation.indexDirRequired': '索引目录不能为空',
    'codexlens.settings.validation.maxWorkersRange': '工作线程数必须在 1-32 之间',
    'codexlens.settings.validation.batchSizeRange': '批次大小必须在 1-64 之间',
    'codexlens.settings.save': '保存',
    'codexlens.settings.saving': '保存中...',
    'codexlens.settings.reset': '重置',
    'codexlens.settings.saveSuccess': '配置已保存',
    'codexlens.settings.saveFailed': '保存失败',
    'codexlens.settings.configUpdated': '配置更新成功',
    'codexlens.settings.saveError': '保存配置时出错',
    'codexlens.settings.unknownError': '发生未知错误',
    'codexlens.models.title': '模型管理',
    'codexlens.models.searchPlaceholder': '搜索模型...',
    'codexlens.models.downloading': '下载中...',
    'codexlens.models.status.downloaded': '已下载',
    'codexlens.models.status.available': '可用',
    'codexlens.models.types.embedding': '嵌入模型',
    'codexlens.models.types.reranker': '重排序模型',
    'codexlens.models.filters.label': '筛选',
    'codexlens.models.filters.all': '全部',
    'codexlens.models.actions.download': '下载',
    'codexlens.models.actions.delete': '删除',
    'codexlens.models.actions.cancel': '取消',
    'codexlens.models.custom.title': '自定义模型',
    'codexlens.models.custom.placeholder': 'HuggingFace 模型名称 (如: BAAI/bge-small-zh-v1.5)',
    'codexlens.models.custom.description': '从 HuggingFace 下载自定义模型。请确保模型名称正确。',
    'codexlens.models.deleteConfirm': '确定要删除模型 {modelName} 吗？',
    'codexlens.models.notInstalled.title': 'CodexLens 未安装',
    'codexlens.models.notInstalled.description': '请先安装 CodexLens 以使用模型管理功能。',
    'codexlens.models.empty.title': '没有找到模型',
    'codexlens.models.empty.description': '尝试调整搜索或筛选条件',
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
