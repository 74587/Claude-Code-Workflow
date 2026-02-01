// ========================================
// CliStreamMonitor Component Exports
// ========================================

// Main components
export { CliStreamMonitorNew as CliStreamMonitor } from './CliStreamMonitorNew';
export type { CliStreamMonitorNewProps as CliStreamMonitorProps } from './CliStreamMonitorNew';

export { default as CliStreamMonitorLegacy } from '../CliStreamMonitorLegacy';
export type { CliStreamMonitorProps as CliStreamMonitorLegacyProps } from '../CliStreamMonitorLegacy';

// Layout components (new design)
export { MonitorHeader } from './MonitorHeader';
export type { MonitorHeaderProps } from './MonitorHeader';

export { MonitorToolbar } from './MonitorToolbar';
export type { MonitorToolbarProps, FilterType, ViewMode } from './MonitorToolbar';

export { MonitorBody } from './MonitorBody';
export type { MonitorBodyProps, MonitorBodyRef } from './MonitorBody';

// Message type components (new design)
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

// Message renderer (new design)
export { MessageRenderer } from './MessageRenderer';
export type { MessageRendererProps } from './MessageRenderer';

// Utility components for Tab + JSON Cards (v3 design)
export { ExecutionTab } from './components/ExecutionTab';
export type { ExecutionTabProps } from './components/ExecutionTab';

export { JsonCard } from './components/JsonCard';
export type { JsonCardProps } from './components/JsonCard';

export { JsonField } from './components/JsonField';
export type { JsonFieldProps } from './components/JsonField';

export { OutputLine } from './components/OutputLine';
export type { OutputLineProps } from './components/OutputLine';

// Utilities
export { detectJsonInLine } from './utils/jsonDetector';
export type { JsonDetectionResult } from './utils/jsonDetector';
