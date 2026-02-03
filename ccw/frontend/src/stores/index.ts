// ========================================
// Stores Barrel Export
// ========================================
// Re-export all stores for convenient imports

// App Store
export {
  useAppStore,
  selectTheme,
  selectResolvedTheme,
  selectSidebarOpen,
  selectCurrentView,
  selectIsLoading,
  selectError,
} from './appStore';

// Workflow Store
export {
  useWorkflowStore,
  selectWorkflowData,
  selectActiveSessions,
  selectArchivedSessions,
  selectActiveSessionId,
  selectProjectPath,
  selectFilters,
  selectSorting,
} from './workflowStore';

// Config Store
export {
  useConfigStore,
  selectCliTools,
  selectDefaultCliTool,
  selectApiEndpoints,
  selectUserPreferences,
  selectFeatureFlags,
  getFirstEnabledCliTool,
} from './configStore';

// Notification Store
export {
  useNotificationStore,
  selectToasts,
  selectWsStatus,
  selectWsLastMessage,
  selectIsPanelVisible,
  selectPersistentNotifications,
  selectCurrentQuestion,
  toast,
} from './notificationStore';

// Flow Store
export {
  useFlowStore,
  selectCurrentFlow,
  selectNodes,
  selectEdges,
  selectSelectedNodeId,
  selectSelectedEdgeId,
  selectFlows,
  selectIsModified,
  selectIsLoadingFlows,
  selectIsPaletteOpen,
  selectIsPropertyPanelOpen,
} from './flowStore';

// Execution Store
export {
  useExecutionStore,
  selectCurrentExecution,
  selectNodeStates,
  selectLogs,
  selectIsMonitorExpanded,
  selectAutoScrollLogs,
  selectIsExecuting,
  selectNodeStatus,
} from './executionStore';

// Coordinator Store
export {
  useCoordinatorStore,
  useCoordinatorActions,
  selectCoordinatorStatus,
  selectCurrentExecutionId,
  selectCoordinatorLogs,
  selectActiveQuestion,
  selectCommandChain,
  selectCurrentNode,
  selectPipelineDetails,
  selectIsPipelineLoaded,
} from './coordinatorStore';

// Re-export types for convenience
export type {
  // App Store Types
  AppStore,
  AppState,
  AppActions,
  Theme,
  ViewMode,
  SessionFilter,
  LiteTaskType,

  // Workflow Store Types
  WorkflowStore,
  WorkflowState,
  WorkflowActions,
  WorkflowData,
  WorkflowFilters,
  WorkflowSorting,
  SessionMetadata,
  TaskData,
  LiteTaskSession,

  // Config Store Types
  ConfigStore,
  ConfigState,
  ConfigActions,
  CliToolConfig,
  ApiEndpoints,
  UserPreferences,

  // Notification Store Types
  NotificationStore,
  NotificationState,
  NotificationActions,
  Toast,
  ToastType,
  WebSocketStatus,
  WebSocketMessage,
  QuestionType,
  Question,
  AskQuestionPayload,
} from '../types/store';

// Coordinator Store Types
export type {
  CoordinatorState,
  CoordinatorStatus,
  CommandNode,
  CoordinatorLog,
  CoordinatorQuestion,
  PipelineDetails,
} from './coordinatorStore';

// Execution Types
export type {
  ExecutionStatus,
  NodeExecutionStatus,
  LogLevel,
  ExecutionLog,
  NodeExecutionState,
  ExecutionState,
  OrchestratorWebSocketMessage,
  ExecutionStore,
  ExecutionStoreState,
  ExecutionStoreActions,
  FlowTemplate,
  TemplateInstallRequest,
  TemplateExportRequest,
} from '../types/execution';

// Flow Types
export type {
  FlowNodeType,
  SlashCommandNodeData,
  FileOperationNodeData,
  ConditionalNodeData,
  ParallelNodeData,
  NodeData,
  FlowNode,
  FlowEdge,
  FlowEdgeData,
  Flow,
  FlowMetadata,
  FlowState,
  FlowActions,
  FlowStore,
  NodeTypeConfig,
} from '../types/flow';

export { NODE_TYPE_CONFIGS } from '../types/flow';
