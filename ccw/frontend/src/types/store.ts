// ========================================
// Store Types
// ========================================
// TypeScript interfaces for all Zustand stores

// ========== App Store Types ==========

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'blue' | 'green' | 'orange' | 'purple';
export type Locale = 'en' | 'zh';
export type ViewMode = 'sessions' | 'liteTasks' | 'project-overview' | 'sessionDetail' | 'liteTaskDetail' | 'loop-monitor' | 'issue-manager' | 'orchestrator';
export type SessionFilter = 'all' | 'active' | 'archived';
export type LiteTaskType = 'lite-plan' | 'lite-fix' | null;

export interface AppState {
  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  colorScheme: ColorScheme; // New: 4 color scheme options (blue/green/orange/purple)

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
  setColorScheme: (scheme: ColorScheme) => void; // New: set color scheme

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
  path?: string; // Full filesystem path to session directory (from backend)
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

  // Query invalidation callback (internal)
  _invalidateQueriesCallback?: () => void;
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
  switchWorkspace: (path: string) => Promise<void>;
  removeRecentPath: (path: string) => Promise<void>;
  refreshRecentPaths: () => Promise<void>;
  registerQueryInvalidator: (callback: () => void) => void;

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

// ========== A2UI Types Import ==========

// Import A2UI types for notification store integration
import type { SurfaceUpdate } from '../packages/a2ui-runtime/core/A2UITypes';

// ========== Notification Store Types ==========

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'a2ui';
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 = persistent
  timestamp: string;
  dismissible?: boolean;
  read?: boolean; // Track read status for persistent notifications
  action?: {
    label: string;
    onClick: () => void;
  };
  // A2UI fields
  a2uiSurface?: SurfaceUpdate; // A2UI surface data for type='a2ui'
  a2uiState?: Record<string, unknown>; // A2UI component state
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

  // A2UI surfaces (Map of surfaceId to SurfaceUpdate)
  a2uiSurfaces: Map<string, SurfaceUpdate>;
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
  markAllAsRead: () => void;

  // A2UI actions
  addA2UINotification: (surface: SurfaceUpdate, title?: string) => string;
  updateA2UIState: (surfaceId: string, state: Record<string, unknown>) => void;
  sendA2UIAction: (actionId: string, surfaceId: string, parameters?: Record<string, unknown>) => void;
}

export type NotificationStore = NotificationState & NotificationActions;

// ========== Index Manager Types ==========

/**
 * Index status information from backend
 */
export interface IndexStatus {
  /** Total number of files indexed */
  totalFiles: number;
  /** Last index timestamp (ISO string) */
  lastUpdated: string;
  /** Time taken for last index build (ms) */
  buildTime: number;
  /** Current index status */
  status: 'idle' | 'building' | 'completed' | 'failed';
  /** Progress percentage (0-100) when building */
  progress?: number;
  /** Current file being indexed */
  currentFile?: string;
  /** Error message if status is failed */
  error?: string;
}

/**
 * Request body for index rebuild operation
 */
export interface IndexRebuildRequest {
  /** Force full rebuild (default: false) */
  force?: boolean;
  /** Specific paths to index (empty = all) */
  paths?: string[];
}

// ========== Rule Types ==========

/**
 * Rule configuration for Claude Code memory
 */
export interface Rule {
  /** Unique rule identifier */
  id: string;
  /** Rule name (display name) */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Rule category (e.g., coding, testing, security) */
  category?: string;
  /** File pattern for conditional rules */
  pattern?: string;
  /** Severity level for rule violations */
  severity?: 'error' | 'warning' | 'info';
  /** Rule file path (filesystem location) */
  path?: string;
  /** Rule location: project or user */
  location?: 'project' | 'user';
  /** Subdirectory path (if rule is in subdirectory) */
  subdirectory?: string | null;
}

/**
 * Input for creating a new rule
 */
export interface RuleCreateInput {
  /** Rule name (display name) */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled */
  enabled?: boolean;
  /** Rule category */
  category?: string;
  /** File pattern */
  pattern?: string;
  /** Severity level */
  severity?: 'error' | 'warning' | 'info';
  /** Rule content (markdown) */
  content?: string;
  /** File name (with .md extension) */
  fileName: string;
  /** Rule location */
  location: 'project' | 'user';
  /** Subdirectory path */
  subdirectory?: string;
  /** Paths for conditional rules */
  paths?: string[];
}

/**
 * Input for updating an existing rule
 */
export interface RuleUpdateInput {
  /** Rule name */
  name?: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled */
  enabled?: boolean;
  /** Rule category */
  category?: string;
  /** File pattern */
  pattern?: string;
  /** Severity level */
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Response from rules list API
 */
export interface RulesResponse {
  rules: Rule[];
}

// ========== Prompt Assistant Types ==========

/**
 * Prompt template with AI-generated insights
 *
 * @example
 * ```typescript
 * const prompt: Prompt = {
 *   id: 'fix-bug',
 *   title: 'Fix Bug',
 *   content: 'PURPOSE: Fix bug in...',
 *   category: 'bug-fix',
 *   tags: ['bug', 'fix']
 * };
 * ```
 */
export interface Prompt {
  /** Unique prompt identifier */
  id: string;
  /** Prompt title */
  title: string;
  /** Prompt content/template */
  content: string;
  /** Category for organization */
  category?: string;
  /** Search tags */
  tags?: string[];
  /** Usage count */
  useCount?: number;
  /** Last used timestamp */
  lastUsed?: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * AI-generated insight for a prompt
 *
 * @example
 * ```typescript
 * const insight: PromptInsight = {
 *   id: 'insight-1',
 *   promptId: 'fix-bug',
 *   type: 'suggestion',
 *   content: 'Consider adding error handling',
 *   confidence: 0.85
 * };
 * ```
 */
export interface PromptInsight {
  /** Unique insight identifier */
  id: string;
  /** Associated prompt ID */
  promptId: string;
  /** Insight type */
  type: 'suggestion' | 'optimization' | 'warning';
  /** Insight content */
  content: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Generated timestamp */
  timestamp: string;
}

/**
 * Code pattern detected by AI analysis
 *
 * @example
 * ```typescript
 * const pattern: Pattern = {
 *   id: 'react-use-effect-deps',
 *   name: 'React useEffect Dependencies',
 *   description: 'Missing dependencies in useEffect',
 *   example: 'useEffect(() => { ... }, [count])',
 *   severity: 'warning'
 * };
 * ```
 */
export interface Pattern {
  /** Unique pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Code example */
  example?: string;
  /** Severity level */
  severity?: 'error' | 'warning' | 'info';
  /** Related patterns */
  relatedPatterns?: string[];
  /** Applicable file extensions */
  fileTypes?: string[];
}

/**
 * AI-generated suggestion for code improvement
 *
 * @example
 * ```typescript
 * const suggestion: Suggestion = {
 *   id: 'sugg-1',
 *   type: 'refactor',
 *   title: 'Extract to function',
 *   description: 'This logic can be extracted into a reusable function',
 *   code: 'function extractLogic() { ... }',
 *   filePath: 'src/app.ts',
 *   lineRange: { start: 10, end: 25 }
 * };
 * ```
 */
export interface Suggestion {
  /** Unique suggestion identifier */
  id: string;
  /** Suggestion type */
  type: 'refactor' | 'optimize' | 'fix' | 'document';
  /** Suggestion title */
  title: string;
  /** Detailed description */
  description: string;
  /** Suggested code replacement */
  code?: string;
  /** Target file path */
  filePath?: string;
  /** Line range for the suggestion */
  lineRange?: { start: number; end: number };
  /** Confidence score (0-1) */
  confidence?: number;
  /** Estimated effort (low/medium/high) */
  effort?: 'low' | 'medium' | 'high';
  /** Generated timestamp */
  timestamp: string;
  /** Whether suggestion was applied */
  applied?: boolean;
}
