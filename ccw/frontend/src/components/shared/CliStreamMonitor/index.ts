// ========================================
// CliStreamMonitor Component Exports
// ========================================
// New layout exports for the redesigned CLI Stream Monitor

// Main component (new layout)
export { CliStreamMonitorNew as CliStreamMonitor } from './CliStreamMonitorNew';
export type { CliStreamMonitorNewProps as CliStreamMonitorProps } from './CliStreamMonitorNew';

// Layout components
export { MonitorHeader } from './MonitorHeader';
export type { MonitorHeaderProps } from './MonitorHeader';

export { MonitorToolbar } from './MonitorToolbar';
export type { MonitorToolbarProps, FilterType, ViewMode } from './MonitorToolbar';

export { MonitorBody } from './MonitorBody';
export type { MonitorBodyProps, MonitorBodyRef } from './MonitorBody';

// Message type components
export {
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ErrorMessage,
} from './messages';
export type {
  SystemMessageProps,
  UserMessageProps,
  AssistantMessageProps,
  ErrorMessageProps,
} from './messages';

// Message renderer
export { MessageRenderer } from './MessageRenderer';
export type { MessageRendererProps } from './MessageRenderer';
