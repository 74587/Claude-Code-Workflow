// ========================================
// Store Types
// ========================================
// TypeScript interfaces for all Zustand stores

// ========== App Store Types ==========

export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'en' | 'zh';
export type ViewMode = 'sessions' | 'liteTasks' | 'project-overview' | 'sessionDetail' | 'liteTaskDetail' | 'loop-monitor' | 'issue-manager' | 'orchestrator';
export type SessionFilter = 'all' | 'active' | 'archived';
export type LiteTaskType = 'lite-plan' | 'lite-fix' | null;

export interface AppState {
  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';

  // Locale
  locale: Locale;

  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // View state
  currentView: ViewMode;
  currentFilter: SessionFilter;
  currentLiteType: LiteTaskType;
  currentSessionDetailKey: string | null;

  // Loading and error states
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;
}

export interface AppActions {
  // Theme actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Locale actions
  setLocale: (locale: Locale) => void;

  // Sidebar actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // View actions
  setCurrentView: (view: ViewMode) => void;
  setCurrentFilter: (filter: SessionFilter) => void;
  setCurrentLiteType: (type: LiteTaskType) => void;
  setCurrentSessionDetailKey: (key: string | null) => void;

  // Loading/error actions
  setLoading: (loading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type AppStore = AppState & AppActions;

// ========== Workflow Store Types ==========

/**
 * Frontend session metadata type transformed from backend session data.
 *
 * @remarks
 * This interface is the frontend representation of workflow sessions after transformation
 * from the raw backend `BackendSessionData` type.
 *
 * **Transformation from BackendSessionData:**
 * - `project` field is split into `title` and `description` (separator: ':')
 * - `status: 'active'` is mapped to `status: 'in_progress'`
 * - `location` is added based on which array the session came from ('active' | 'archived')
 *
 * **Field mappings:**
 * | Backend Field | Frontend Field | Notes |
 * |---------------|----------------|-------|
 * | `project` | `title`, `description` | Split on first ':' |
 * | `status: 'active'` | `status: 'in_progress'` | Status enum mapping |
 * | N/A | `location` | Derived from source array |
 *
 * **Transformation function:** `transformBackendSession()` in `api.ts`
 * **Backend type:** {@link BackendSessionData | BackendSessionData} (api.ts)
 *
 * @see {@link https://github.com/claudews/ccw/blob/main/ccw/frontend/src/lib/api.ts | api.ts} for transformation logic
 */
export interface SessionMetadata {
  session_id: string;
  title?: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'archived' | 'paused';
  created_at: string;
  updated_at?: string;
  location: 'active' | 'archived';
  has_plan?: boolean;
  plan_updated_at?: string;
  has_review?: boolean;
  review?: {
    dimensions: string[];
    iterations: string[];
    fixes: string[];
  };
  summaries?: Array<{ task_id: string; content: unknown }>;
  tasks?: TaskData[];
  phase?: string;
}

export interface TaskData {
  task_id: string;
  title?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  created_at?: string;
  updated_at?: string;
  has_summary?: boolean;
  depends_on?: string[];
  estimated_complexity?: string;
}

export interface LiteTaskSession {
  session_id: string;
  type: LiteTaskType;
  status: string;
  created_at: string;
  tasks?: TaskData[];
}

export interface WorkflowData {
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
}

export interface WorkflowFilters {
  status: SessionMetadata['status'][] | null;
  search: string;
  dateRange: { start: Date | null; end: Date | null };
}

export interface WorkflowSorting {
  field: 'created_at' | 'updated_at' | 'title' | 'status';
  direction: 'asc' | 'desc';
}

export interface WorkflowState {
  // Core data
  workflowData: WorkflowData;
  projectPath: string;
  recentPaths: string[];
  serverPlatform: 'win32' | 'darwin' | 'linux';

  // Data stores (maps)
  sessionDataStore: Record<string, SessionMetadata>;
  liteTaskDataStore: Record<string, LiteTaskSession>;
  taskJsonStore: Record<string, unknown>;

  // Active session
  activeSessionId: string | null;

  // Filters and sorting
  filters: WorkflowFilters;
  sorting: WorkflowSorting;
}

export interface WorkflowActions {
  // Session actions
  setSessions: (active: SessionMetadata[], archived: SessionMetadata[]) => void;
  addSession: (session: SessionMetadata) => void;
  updateSession: (sessionId: string, updates: Partial<SessionMetadata>) => void;
  removeSession: (sessionId: string) => void;
  archiveSession: (sessionId: string) => void;

  // Task actions
  addTask: (sessionId: string, task: TaskData) => void;
  updateTask: (sessionId: string, taskId: string, updates: Partial<TaskData>) => void;
  removeTask: (sessionId: string, taskId: string) => void;

  // Lite task actions
  setLiteTaskSession: (key: string, session: LiteTaskSession) => void;
  removeLiteTaskSession: (key: string) => void;

  // Task JSON store
  setTaskJson: (key: string, data: unknown) => void;
  removeTaskJson: (key: string) => void;

  // Active session
  setActiveSessionId: (sessionId: string | null) => void;

  // Project path
  setProjectPath: (path: string) => void;
  addRecentPath: (path: string) => void;
  setServerPlatform: (platform: 'win32' | 'darwin' | 'linux') => void;

  // Filters and sorting
  setFilters: (filters: Partial<WorkflowFilters>) => void;
  setSorting: (sorting: Partial<WorkflowSorting>) => void;
  resetFilters: () => void;

  // Computed selectors
  getActiveSession: () => SessionMetadata | null;
  getFilteredSessions: () => SessionMetadata[];
  getSessionByKey: (key: string) => SessionMetadata | undefined;
}

export type WorkflowStore = WorkflowState & WorkflowActions;

// ========== Config Store Types ==========

export interface CliToolConfig {
  enabled: boolean;
  primaryModel: string;
  secondaryModel: string;
  tags: string[];
  type: 'builtin' | 'cli-wrapper' | 'api-endpoint';
  settingsFile?: string;
}

export interface ApiEndpoints {
  base: string;
  sessions: string;
  tasks: string;
  loops: string;
  issues: string;
  orchestrator: string;
}

export interface UserPreferences {
  autoRefresh: boolean;
  refreshInterval: number; // milliseconds
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  compactView: boolean;
  showCompletedTasks: boolean;
  defaultSessionFilter: SessionFilter;
  defaultSortField: WorkflowSorting['field'];
  defaultSortDirection: WorkflowSorting['direction'];
  locale?: Locale;
}

export interface ConfigState {
  // CLI tools configuration
  cliTools: Record<string, CliToolConfig>;
  defaultCliTool: string;

  // API endpoints
  apiEndpoints: ApiEndpoints;

  // User preferences
  userPreferences: UserPreferences;

  // Feature flags
  featureFlags: Record<string, boolean>;
}

export interface ConfigActions {
  // CLI tools
  setCliTools: (tools: Record<string, CliToolConfig>) => void;
  updateCliTool: (toolId: string, updates: Partial<CliToolConfig>) => void;
  setDefaultCliTool: (toolId: string) => void;

  // API endpoints
  setApiEndpoints: (endpoints: Partial<ApiEndpoints>) => void;

  // User preferences
  setUserPreferences: (prefs: Partial<UserPreferences>) => void;
  resetUserPreferences: () => void;

  // Feature flags
  setFeatureFlag: (flag: string, enabled: boolean) => void;

  // Bulk config
  loadConfig: (config: Partial<ConfigState>) => void;
}

export type ConfigStore = ConfigState & ConfigActions;

// ========== Notification Store Types ==========

export type ToastType = 'info' | 'success' | 'warning' | 'error';
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 = persistent
  timestamp: string;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
  sessionId?: string;
  entityId?: string;
  timestamp?: string;
}

export interface NotificationState {
  // Toast queue
  toasts: Toast[];
  maxToasts: number;

  // WebSocket status
  wsStatus: WebSocketStatus;
  wsLastMessage: WebSocketMessage | null;
  wsReconnectAttempts: number;

  // Notification panel
  isPanelVisible: boolean;

  // Persistent notifications (stored in localStorage)
  persistentNotifications: Toast[];
}

export interface NotificationActions {
  // Toast actions
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // WebSocket status
  setWsStatus: (status: WebSocketStatus) => void;
  setWsLastMessage: (message: WebSocketMessage | null) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;

  // Notification panel
  togglePanel: () => void;
  setPanelVisible: (visible: boolean) => void;

  // Persistent notifications
  addPersistentNotification: (notification: Omit<Toast, 'id' | 'timestamp'>) => void;
  removePersistentNotification: (id: string) => void;
  clearPersistentNotifications: () => void;
  loadPersistentNotifications: () => void;
  savePersistentNotifications: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;
