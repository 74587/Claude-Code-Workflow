// ========================================
// API Client
// ========================================
// Typed fetch functions for API communication with CSRF token handling

import type { SessionMetadata, TaskData } from '../types/store';

// ========== Types ==========

/**
 * Raw backend session data structure matching the backend API response.
 *
 * @remarks
 * This interface represents the exact schema returned by the backend `/api/data` endpoint.
 * It is used internally during transformation to `SessionMetadata` in the frontend.
 *
 * **Field mappings to frontend SessionMetadata:**
 * - `project` → `title` and `description` (split on ':' separator)
 * - `status: 'active'` → `status: 'in_progress'` (other statuses remain unchanged)
 * - `location` is added based on which array (activeSessions/archivedSessions) the data comes from
 *
 * **Backend schema location:** `ccw/src/data-aggregator.ts`
 * **Transformation function:** {@link transformBackendSession}
 * **Frontend type:** {@link SessionMetadata}
 *
 * @warning If backend schema changes, update this interface AND the transformation logic in {@link transformBackendSession}
 */
interface BackendSessionData {
  session_id: string;
  project?: string;
  status: 'active' | 'completed' | 'archived' | 'planning' | 'paused';
  type?: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Dashboard statistics mapped from backend statistics response.
 *
 * @remarks
 * This interface represents the frontend statistics type displayed on the dashboard.
 * The data is extracted from the backend `/api/data` response's `statistics` field.
 *
 * **Backend response structure:**
 * ```json
 * {
 *   "statistics": {
 *     "totalSessions": number,
 *     "activeSessions": number,
 *     "archivedSessions": number,
 *     "totalTasks": number,
 *     "completedTasks": number,
 *     "pendingTasks": number,
 *     "failedTasks": number,
 *     "todayActivity": number
 *   }
 * }
 * ```
 *
 * **Mapping function:** {@link fetchDashboardStats}
 * **Fallback:** Returns zero-initialized stats on error via {@link getEmptyDashboardStats}
 *
 * @see {@link fetchDashboardStats} for the transformation logic
 */
export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  todayActivity: number;
}

export interface SessionsResponse {
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
}

export interface CreateSessionInput {
  session_id: string;
  title?: string;
  description?: string;
  type?: 'workflow' | 'review' | 'lite-plan' | 'lite-fix';
}

export interface UpdateSessionInput {
  title?: string;
  description?: string;
  status?: SessionMetadata['status'];
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// ========== CSRF Token Handling ==========

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ========== Base Fetch Wrapper ==========

/**
 * Base fetch wrapper with CSRF token and error handling
 */
async function fetchApi<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  // Add CSRF token for mutating requests
  if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  // Set content type for JSON requests
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const error: ApiError = {
      message: response.statusText || 'Request failed',
      status: response.status,
    };

    try {
      const body = await response.json();
      if (body.message) error.message = body.message;
      if (body.code) error.code = body.code;
    } catch (parseError) {
      // Log parse errors instead of silently ignoring
      console.warn('[API] Failed to parse error response:', parseError);
    }

    throw error;
  }

  // Handle no-content responses
  if (response.status === 204) {
    return undefined as T;
  }

  // Wrap response.json() with try-catch for better error messages
  try {
    return await response.json();
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Unknown error';
    throw new Error(`Failed to parse JSON response: ${message}`);
  }
}

// ========== Transformation Helpers ==========

/**
 * Transform backend session data to frontend SessionMetadata interface
 * Maps backend schema (project, status: 'active') to frontend schema (title, description, status: 'in_progress', location)
 *
 * @param backendSession - Raw session data from backend
 * @param location - Whether this session is from active or archived list
 * @returns Transformed SessionMetadata object
 */
function transformBackendSession(
  backendSession: BackendSessionData,
  location: 'active' | 'archived'
): SessionMetadata {
  // Map backend 'active' status to frontend 'in_progress'
  // Other statuses remain the same
  const statusMap: Record<string, SessionMetadata['status']> = {
    'active': 'in_progress',
    'completed': 'completed',
    'archived': 'archived',
    'planning': 'planning',
    'paused': 'paused',
  };

  const transformedStatus = statusMap[backendSession.status] || backendSession.status as SessionMetadata['status'];

  // Extract title and description from project field
  // Backend sends 'project' as a string, frontend expects 'title' and optional 'description'
  let title = backendSession.project || backendSession.session_id;
  let description: string | undefined;

  if (backendSession.project && backendSession.project.includes(':')) {
    const parts = backendSession.project.split(':');
    title = parts[0].trim();
    description = parts.slice(1).join(':').trim();
  }

  return {
    session_id: backendSession.session_id,
    title,
    description,
    status: transformedStatus,
    created_at: backendSession.created_at,
    updated_at: backendSession.updated_at,
    location,
    // Preserve additional fields if they exist
    has_plan: (backendSession as unknown as { has_plan?: boolean }).has_plan,
    plan_updated_at: (backendSession as unknown as { plan_updated_at?: string }).plan_updated_at,
    has_review: (backendSession as unknown as { has_review?: boolean }).has_review,
    review: (backendSession as unknown as { review?: SessionMetadata['review'] }).review,
    summaries: (backendSession as unknown as { summaries?: SessionMetadata['summaries'] }).summaries,
    tasks: (backendSession as unknown as { tasks?: TaskData[] }).tasks,
  };
}

// ========== Dashboard API ==========

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const data = await fetchApi<{ statistics?: DashboardStats }>('/api/data');

    // Validate response structure
    if (!data) {
      console.warn('[API] No data received from /api/data for dashboard stats');
      return getEmptyDashboardStats();
    }

    // Extract statistics from response, with defaults
    return {
      totalSessions: data.statistics?.totalSessions ?? 0,
      activeSessions: data.statistics?.activeSessions ?? 0,
      archivedSessions: data.statistics?.archivedSessions ?? 0,
      totalTasks: data.statistics?.totalTasks ?? 0,
      completedTasks: data.statistics?.completedTasks ?? 0,
      pendingTasks: data.statistics?.pendingTasks ?? 0,
      failedTasks: data.statistics?.failedTasks ?? 0,
      todayActivity: data.statistics?.todayActivity ?? 0,
    };
  } catch (error) {
    console.error('[API] Failed to fetch dashboard stats:', error);
    return getEmptyDashboardStats();
  }
}

/**
 * Get empty dashboard stats with zero values
 */
function getEmptyDashboardStats(): DashboardStats {
  return {
    totalSessions: 0,
    activeSessions: 0,
    archivedSessions: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    failedTasks: 0,
    todayActivity: 0,
  };
}

// ========== Sessions API ==========

/**
 * Fetch all sessions (active and archived)
 * Applies transformation layer to map backend data to frontend SessionMetadata interface
 */
export async function fetchSessions(): Promise<SessionsResponse> {
  try {
    const data = await fetchApi<{
      activeSessions?: BackendSessionData[];
      archivedSessions?: BackendSessionData[];
    }>('/api/data');

    // Validate response structure
    if (!data) {
      console.warn('[API] No data received from /api/data for sessions');
      return { activeSessions: [], archivedSessions: [] };
    }

    // Transform active sessions with location = 'active'
    const activeSessions = (data.activeSessions ?? []).map((session) => {
      try {
        return transformBackendSession(session, 'active');
      } catch (error) {
        console.error('[API] Failed to transform active session:', session, error);
        // Return a minimal valid session to prevent crashes
        return {
          session_id: session.session_id,
          title: session.project || session.session_id,
          status: 'in_progress' as const,
          created_at: session.created_at,
          location: 'active' as const,
        };
      }
    });

    // Transform archived sessions with location = 'archived'
    const archivedSessions = (data.archivedSessions ?? []).map((session) => {
      try {
        return transformBackendSession(session, 'archived');
      } catch (error) {
        console.error('[API] Failed to transform archived session:', session, error);
        // Return a minimal valid session to prevent crashes
        return {
          session_id: session.session_id,
          title: session.project || session.session_id,
          status: session.status === 'active' ? 'in_progress' : session.status as SessionMetadata['status'],
          created_at: session.created_at,
          location: 'archived' as const,
        };
      }
    });

    return { activeSessions, archivedSessions };
  } catch (error) {
    console.error('[API] Failed to fetch sessions:', error);
    // Return empty arrays on error to prevent crashes
    return { activeSessions: [], archivedSessions: [] };
  }
}

/**
 * Fetch a single session by ID
 */
export async function fetchSession(sessionId: string): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Create a new session
 */
export async function createSession(input: CreateSessionInput): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a session
 */
export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput
): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Archive a session
 */
export async function archiveSession(sessionId: string): Promise<SessionMetadata> {
  return fetchApi<SessionMetadata>(`/api/sessions/${encodeURIComponent(sessionId)}/archive`, {
    method: 'POST',
  });
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  return fetchApi<void>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}

// ========== Tasks API ==========

/**
 * Fetch tasks for a session
 */
export async function fetchSessionTasks(sessionId: string): Promise<TaskData[]> {
  return fetchApi<TaskData[]>(`/api/sessions/${encodeURIComponent(sessionId)}/tasks`);
}

/**
 * Update a task status
 */
export async function updateTask(
  sessionId: string,
  taskId: string,
  updates: Partial<TaskData>
): Promise<TaskData> {
  return fetchApi<TaskData>(
    `/api/sessions/${encodeURIComponent(sessionId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
}

// ========== Path Management API ==========

/**
 * Fetch recent paths
 */
export async function fetchRecentPaths(): Promise<string[]> {
  const data = await fetchApi<{ paths?: string[] }>('/api/recent-paths');
  return data.paths ?? [];
}

/**
 * Remove a recent path
 */
export async function removeRecentPath(path: string): Promise<string[]> {
  const data = await fetchApi<{ paths: string[] }>('/api/remove-recent-path', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
  return data.paths;
}

/**
 * Switch to a different project path and load its data
 */
export async function loadDashboardData(path: string): Promise<{
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
  statistics: DashboardStats;
  projectPath: string;
  recentPaths: string[];
}> {
  return fetchApi(`/api/data?path=${encodeURIComponent(path)}`);
}

// ========== Loops API ==========

export interface Loop {
  id: string;
  name?: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  prompt?: string;
  tool?: string;
  error?: string;
  context?: {
    workingDir?: string;
    mode?: string;
  };
}

export interface LoopsResponse {
  loops: Loop[];
  total: number;
}

/**
 * Fetch all loops
 */
export async function fetchLoops(): Promise<LoopsResponse> {
  const data = await fetchApi<{ loops?: Loop[] }>('/api/loops');
  return {
    loops: data.loops ?? [],
    total: data.loops?.length ?? 0,
  };
}

/**
 * Fetch a single loop by ID
 */
export async function fetchLoop(loopId: string): Promise<Loop> {
  return fetchApi<Loop>(`/api/loops/${encodeURIComponent(loopId)}`);
}

/**
 * Create a new loop
 */
export async function createLoop(input: {
  prompt: string;
  tool?: string;
  mode?: string;
}): Promise<Loop> {
  return fetchApi<Loop>('/api/loops', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a loop's status (pause, resume, stop)
 */
export async function updateLoopStatus(
  loopId: string,
  action: 'pause' | 'resume' | 'stop'
): Promise<Loop> {
  return fetchApi<Loop>(`/api/loops/${encodeURIComponent(loopId)}/${action}`, {
    method: 'POST',
  });
}

/**
 * Delete a loop
 */
export async function deleteLoop(loopId: string): Promise<void> {
  return fetchApi<void>(`/api/loops/${encodeURIComponent(loopId)}`, {
    method: 'DELETE',
  });
}

// ========== Issues API ==========

export interface IssueSolution {
  id: string;
  description: string;
  approach?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  estimatedEffort?: string;
}

export interface Issue {
  id: string;
  title: string;
  context?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt?: string;
  solutions?: IssueSolution[];
  labels?: string[];
  assignee?: string;
}

export interface IssueQueue {
  tasks: string[];
  solutions: string[];
  conflicts: string[];
  execution_groups: string[];
  grouped_items: Record<string, string[]>;
}

export interface IssuesResponse {
  issues: Issue[];
}

/**
 * Fetch all issues
 */
export async function fetchIssues(projectPath?: string): Promise<IssuesResponse> {
  const url = projectPath
    ? `/api/issues?path=${encodeURIComponent(projectPath)}`
    : '/api/issues';
  const data = await fetchApi<{ issues?: Issue[] }>(url);
  return {
    issues: data.issues ?? [],
  };
}

/**
 * Fetch issue history
 */
export async function fetchIssueHistory(projectPath?: string): Promise<IssuesResponse> {
  const url = projectPath
    ? `/api/issues/history?path=${encodeURIComponent(projectPath)}`
    : '/api/issues/history';
  const data = await fetchApi<{ issues?: Issue[] }>(url);
  return {
    issues: data.issues ?? [],
  };
}

/**
 * Fetch issue queue
 */
export async function fetchIssueQueue(projectPath?: string): Promise<IssueQueue> {
  const url = projectPath
    ? `/api/queue?path=${encodeURIComponent(projectPath)}`
    : '/api/queue';
  return fetchApi<IssueQueue>(url);
}

/**
 * Create a new issue
 */
export async function createIssue(input: {
  title: string;
  context?: string;
  priority?: Issue['priority'];
}): Promise<Issue> {
  return fetchApi<Issue>('/api/issues', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update an issue
 */
export async function updateIssue(
  issueId: string,
  input: Partial<Issue>
): Promise<Issue> {
  return fetchApi<Issue>(`/api/issues/${encodeURIComponent(issueId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Delete an issue
 */
export async function deleteIssue(issueId: string): Promise<void> {
  return fetchApi<void>(`/api/issues/${encodeURIComponent(issueId)}`, {
    method: 'DELETE',
  });
}

// ========== Skills API ==========

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  triggers: string[];
  category?: string;
  source?: 'builtin' | 'custom' | 'community';
  version?: string;
  author?: string;
}

export interface SkillsResponse {
  skills: Skill[];
}

/**
 * Fetch all skills
 */
export async function fetchSkills(): Promise<SkillsResponse> {
  const data = await fetchApi<{ skills?: Skill[] }>('/api/skills');
  return {
    skills: data.skills ?? [],
  };
}

/**
 * Toggle skill enabled status
 */
export async function toggleSkill(skillName: string, enabled: boolean): Promise<Skill> {
  return fetchApi<Skill>(`/api/skills/${encodeURIComponent(skillName)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

// ========== Commands API ==========

export interface Command {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
  category?: string;
  aliases?: string[];
  source?: 'builtin' | 'custom';
}

export interface CommandsResponse {
  commands: Command[];
}

/**
 * Fetch all commands
 */
export async function fetchCommands(): Promise<CommandsResponse> {
  const data = await fetchApi<{ commands?: Command[] }>('/api/commands');
  return {
    commands: data.commands ?? [],
  };
}

// ========== Memory API ==========

export interface CoreMemory {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  source?: string;
  tags?: string[];
  size?: number;
}

export interface MemoryResponse {
  memories: CoreMemory[];
  totalSize: number;
  claudeMdCount: number;
}

/**
 * Fetch all memories
 */
export async function fetchMemories(): Promise<MemoryResponse> {
  const data = await fetchApi<{
    memories?: CoreMemory[];
    totalSize?: number;
    claudeMdCount?: number;
  }>('/api/memory');
  return {
    memories: data.memories ?? [],
    totalSize: data.totalSize ?? 0,
    claudeMdCount: data.claudeMdCount ?? 0,
  };
}

/**
 * Create a new memory entry
 */
export async function createMemory(input: {
  content: string;
  tags?: string[];
}): Promise<CoreMemory> {
  return fetchApi<CoreMemory>('/api/memory', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a memory entry
 */
export async function updateMemory(
  memoryId: string,
  input: Partial<CoreMemory>
): Promise<CoreMemory> {
  return fetchApi<CoreMemory>(`/api/memory/${encodeURIComponent(memoryId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Delete a memory entry
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  return fetchApi<void>(`/api/memory/${encodeURIComponent(memoryId)}`, {
    method: 'DELETE',
  });
}

// ========== Project Overview API ==========

export interface TechnologyStack {
  languages: Array<{ name: string; file_count: number; primary?: boolean }>;
  frameworks: string[];
  build_tools: string[];
  test_frameworks?: string[];
}

export interface Architecture {
  style: string;
  layers: string[];
  patterns: string[];
}

export interface KeyComponent {
  name: string;
  description?: string;
  importance: 'high' | 'medium' | 'low';
  responsibility?: string[];
  path?: string;
}

export interface DevelopmentIndexEntry {
  title: string;
  description?: string;
  sessionId?: string;
  sub_feature?: string;
  status?: string;
  tags?: string[];
  archivedAt?: string;
  date?: string;
  implemented_at?: string;
}

export interface GuidelineEntry {
  rule: string;
  scope: string;
  enforced_by?: string;
}

export interface LearningEntry {
  insight: string;
  category?: string;
  session_id?: string;
  context?: string;
  date: string;
}

export interface ProjectGuidelines {
  conventions?: Record<string, string[]>;
  constraints?: Record<string, string[]>;
  quality_rules?: GuidelineEntry[];
  learnings?: LearningEntry[];
}

export interface ProjectOverviewMetadata {
  analysis_mode?: string;
  [key: string]: unknown;
}

export interface ProjectOverview {
  projectName: string;
  description?: string;
  initializedAt: string;
  technologyStack: TechnologyStack;
  architecture: Architecture;
  keyComponents: KeyComponent[];
  developmentIndex?: {
    feature?: DevelopmentIndexEntry[];
    enhancement?: DevelopmentIndexEntry[];
    bugfix?: DevelopmentIndexEntry[];
    refactor?: DevelopmentIndexEntry[];
    docs?: DevelopmentIndexEntry[];
    [key: string]: DevelopmentIndexEntry[] | undefined;
  };
  guidelines?: ProjectGuidelines;
  metadata?: ProjectOverviewMetadata;
}

/**
 * Fetch project overview
 */
export async function fetchProjectOverview(): Promise<ProjectOverview | null> {
  const data = await fetchApi<{ projectOverview?: ProjectOverview }>('/api/ccw');
  return data.projectOverview ?? null;
}

// ========== Session Detail API ==========

export interface SessionDetailContext {
  requirements?: string[];
  focus_paths?: string[];
  artifacts?: string[];
  shared_context?: {
    tech_stack?: string[];
    conventions?: string[];
  };
}

export interface SessionDetailResponse {
  session: SessionMetadata;
  context?: SessionDetailContext;
  summary?: string;
  implPlan?: unknown;
  conflicts?: unknown[];
  review?: unknown;
}

/**
 * Fetch session detail
 */
export async function fetchSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  return fetchApi<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/detail`);
}

// ========== History / CLI Execution API ==========

export interface CliExecution {
  id: string;
  tool: 'gemini' | 'qwen' | 'codex' | string;
  mode?: string;
  status: 'success' | 'error' | 'timeout';
  prompt_preview: string;
  timestamp: string;
  duration_ms: number;
  sourceDir?: string;
  turn_count?: number;
}

export interface HistoryResponse {
  executions: CliExecution[];
}

/**
 * Fetch CLI execution history
 */
export async function fetchHistory(): Promise<HistoryResponse> {
  const data = await fetchApi<{ executions?: CliExecution[] }>('/api/cli/history');
  return {
    executions: data.executions ?? [],
  };
}

/**
 * Delete a CLI execution record
 */
export async function deleteExecution(executionId: string): Promise<void> {
  await fetchApi<void>(`/api/cli/history/${encodeURIComponent(executionId)}`, {
    method: 'DELETE',
  });
}

/**
 * Delete CLI executions by tool
 */
export async function deleteExecutionsByTool(tool: string): Promise<void> {
  await fetchApi<void>(`/api/cli/history/tool/${encodeURIComponent(tool)}`, {
    method: 'DELETE',
  });
}

/**
 * Delete all CLI execution history
 */
export async function deleteAllHistory(): Promise<void> {
  await fetchApi<void>('/api/cli/history', {
    method: 'DELETE',
  });
}

// ========== CLI Tools Config API ==========

export interface CliToolsConfigResponse {
  version: string;
  tools: Record<string, {
    enabled: boolean;
    primaryModel: string;
    secondaryModel: string;
    tags: string[];
    type: string;
  }>;
}

/**
 * Fetch CLI tools configuration
 */
export async function fetchCliToolsConfig(): Promise<CliToolsConfigResponse> {
  return fetchApi<CliToolsConfigResponse>('/api/cli/tools-config');
}

/**
 * Update CLI tools configuration
 */
export async function updateCliToolsConfig(
  config: Partial<CliToolsConfigResponse>
): Promise<CliToolsConfigResponse> {
  return fetchApi<CliToolsConfigResponse>('/api/cli/tools-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ========== Lite Tasks API ==========

export interface ImplementationStep {
  step: number;
  title?: string;
  description?: string;
  modification_points?: string[];
  logic_flow?: string[];
  depends_on?: number[];
  output?: string;
}

export interface FlowControl {
  pre_analysis?: Array<{
    step: string;
    action: string;
    commands?: string[];
    output_to: string;
    on_error?: 'fail' | 'continue' | 'skip';
  }>;
  implementation_approach?: ImplementationStep[];
  target_files?: string[];
}

export interface LiteTask {
  id: string;
  task_id?: string;
  title?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  priority?: string;
  flow_control?: FlowControl;
  meta?: {
    type?: string;
    scope?: string;
  };
  context?: {
    focus_paths?: string[];
    acceptance?: string[];
    depends_on?: string[];
  };
  created_at?: string;
  updated_at?: string;
}

export interface LiteTaskSession {
  id: string;
  session_id?: string;
  type: 'lite-plan' | 'lite-fix' | 'multi-cli-plan';
  title?: string;
  description?: string;
  tasks?: LiteTask[];
  metadata?: Record<string, unknown>;
  latestSynthesis?: {
    title?: string | { en?: string; zh?: string };
    status?: string;
  };
  roundCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiteTasksResponse {
  litePlan?: LiteTaskSession[];
  liteFix?: LiteTaskSession[];
  multiCliPlan?: LiteTaskSession[];
}

/**
 * Fetch all lite tasks sessions
 */
export async function fetchLiteTasks(): Promise<LiteTasksResponse> {
  const data = await fetchApi<{ liteTasks?: LiteTasksResponse }>('/api/data');
  return data.liteTasks || {};
}

/**
 * Fetch a single lite task session by ID
 */
export async function fetchLiteTaskSession(
  sessionId: string,
  type: 'lite-plan' | 'lite-fix' | 'multi-cli-plan'
): Promise<LiteTaskSession | null> {
  const data = await fetchLiteTasks();
  const sessions = type === 'lite-plan' ? (data.litePlan || []) :
    type === 'lite-fix' ? (data.liteFix || []) :
    (data.multiCliPlan || []);
  return sessions.find(s => s.id === sessionId || s.session_id === sessionId) || null;
}

// ========== Review Session API ==========

export interface ReviewFinding {
  id?: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
  file?: string;
  line?: string;
  code_context?: string;
  snippet?: string;
  recommendations?: string[];
  recommendation?: string;
  root_cause?: string;
  impact?: string;
  references?: string[];
  metadata?: Record<string, unknown>;
  fix_status?: string | null;
}

export interface ReviewDimension {
  name: string;
  findings: ReviewFinding[];
}

export interface ReviewSession {
  session_id: string;
  title?: string;
  description?: string;
  type: 'review';
  phase?: string;
  reviewDimensions?: ReviewDimension[];
  _isActive?: boolean;
  created_at?: string;
  updated_at?: string;
  status?: string;
}

export interface ReviewSessionsResponse {
  reviewSessions?: ReviewSession[];
}

/**
 * Fetch all review sessions
 */
export async function fetchReviewSessions(): Promise<ReviewSession[]> {
  const data = await fetchApi<ReviewSessionsResponse>('/api/data');
  return data.reviewSessions || [];
}

/**
 * Fetch a single review session by ID
 */
export async function fetchReviewSession(sessionId: string): Promise<ReviewSession | null> {
  const sessions = await fetchReviewSessions();
  return sessions.find(s => s.session_id === sessionId) || null;
}

// ========== MCP API ==========

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  scope: 'project' | 'global';
}

export interface McpServersResponse {
  project: McpServer[];
  global: McpServer[];
}

/**
 * Fetch all MCP servers (project and global scope)
 */
export async function fetchMcpServers(): Promise<McpServersResponse> {
  const data = await fetchApi<{ project?: McpServer[]; global?: McpServer[] }>('/api/mcp/servers');
  return {
    project: data.project ?? [],
    global: data.global ?? [],
  };
}

/**
 * Update MCP server configuration
 */
export async function updateMcpServer(
  serverName: string,
  config: Partial<McpServer>
): Promise<McpServer> {
  return fetchApi<McpServer>(`/api/mcp/servers/${encodeURIComponent(serverName)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Create a new MCP server
 */
export async function createMcpServer(
  server: Omit<McpServer, 'name'>
): Promise<McpServer> {
  return fetchApi<McpServer>('/api/mcp/servers', {
    method: 'POST',
    body: JSON.stringify(server),
  });
}

/**
 * Delete an MCP server
 */
export async function deleteMcpServer(serverName: string): Promise<void> {
  await fetchApi<void>(`/api/mcp/servers/${encodeURIComponent(serverName)}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle MCP server enabled status
 */
export async function toggleMcpServer(
  serverName: string,
  enabled: boolean
): Promise<McpServer> {
  return fetchApi<McpServer>(`/api/mcp/servers/${encodeURIComponent(serverName)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// ========== CLI Endpoints API ==========

export interface CliEndpoint {
  id: string;
  name: string;
  type: 'litellm' | 'custom' | 'wrapper';
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface CliEndpointsResponse {
  endpoints: CliEndpoint[];
}

/**
 * Fetch all CLI endpoints
 */
export async function fetchCliEndpoints(): Promise<CliEndpointsResponse> {
  const data = await fetchApi<{ endpoints?: CliEndpoint[] }>('/api/cli/endpoints');
  return {
    endpoints: data.endpoints ?? [],
  };
}

/**
 * Update CLI endpoint configuration
 */
export async function updateCliEndpoint(
  endpointId: string,
  config: Partial<CliEndpoint>
): Promise<CliEndpoint> {
  return fetchApi<CliEndpoint>(`/api/cli/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Create a new CLI endpoint
 */
export async function createCliEndpoint(
  endpoint: Omit<CliEndpoint, 'id'>
): Promise<CliEndpoint> {
  return fetchApi<CliEndpoint>('/api/cli/endpoints', {
    method: 'POST',
    body: JSON.stringify(endpoint),
  });
}

/**
 * Delete a CLI endpoint
 */
export async function deleteCliEndpoint(endpointId: string): Promise<void> {
  await fetchApi<void>(`/api/cli/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle CLI endpoint enabled status
 */
export async function toggleCliEndpoint(
  endpointId: string,
  enabled: boolean
): Promise<CliEndpoint> {
  return fetchApi<CliEndpoint>(`/api/cli/endpoints/${encodeURIComponent(endpointId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// ========== CLI Installations API ==========

export interface CliInstallation {
  name: string;
  version: string;
  installed: boolean;
  path?: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked?: string;
}

export interface CliInstallationsResponse {
  tools: CliInstallation[];
}

/**
 * Fetch all CLI tool installations
 */
export async function fetchCliInstallations(): Promise<CliInstallationsResponse> {
  const data = await fetchApi<{ tools?: CliInstallation[] }>('/api/cli/installations');
  return {
    tools: data.tools ?? [],
  };
}

/**
 * Install a CLI tool
 */
export async function installCliTool(toolName: string): Promise<CliInstallation> {
  return fetchApi<CliInstallation>(`/api/cli/installations/${encodeURIComponent(toolName)}/install`, {
    method: 'POST',
  });
}

/**
 * Uninstall a CLI tool
 */
export async function uninstallCliTool(toolName: string): Promise<void> {
  await fetchApi<void>(`/api/cli/installations/${encodeURIComponent(toolName)}/uninstall`, {
    method: 'POST',
  });
}

/**
 * Upgrade a CLI tool
 */
export async function upgradeCliTool(toolName: string): Promise<CliInstallation> {
  return fetchApi<CliInstallation>(`/api/cli/installations/${encodeURIComponent(toolName)}/upgrade`, {
    method: 'POST',
  });
}

/**
 * Check CLI tool installation status
 */
export async function checkCliToolStatus(toolName: string): Promise<CliInstallation> {
  return fetchApi<CliInstallation>(`/api/cli/installations/${encodeURIComponent(toolName)}/check`, {
    method: 'POST',
  });
}

// ========== Hooks API ==========

export interface Hook {
  name: string;
  description?: string;
  enabled: boolean;
  script?: string;
  trigger: 'pre-commit' | 'post-commit' | 'pre-push' | 'custom';
}

export interface HooksResponse {
  hooks: Hook[];
}

/**
 * Fetch all hooks
 */
export async function fetchHooks(): Promise<HooksResponse> {
  const data = await fetchApi<{ hooks?: Hook[] }>('/api/hooks');
  return {
    hooks: data.hooks ?? [],
  };
}

/**
 * Update hook configuration
 */
export async function updateHook(
  hookName: string,
  config: Partial<Hook>
): Promise<Hook> {
  return fetchApi<Hook>(`/api/hooks/${encodeURIComponent(hookName)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Toggle hook enabled status
 */
export async function toggleHook(
  hookName: string,
  enabled: boolean
): Promise<Hook> {
  return fetchApi<Hook>(`/api/hooks/${encodeURIComponent(hookName)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// ========== Rules API ==========

export interface Rule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category?: string;
  pattern?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface RulesResponse {
  rules: Rule[];
}

/**
 * Fetch all rules
 */
export async function fetchRules(): Promise<RulesResponse> {
  const data = await fetchApi<{ rules?: Rule[] }>('/api/rules');
  return {
    rules: data.rules ?? [],
  };
}

/**
 * Update rule configuration
 */
export async function updateRule(
  ruleId: string,
  config: Partial<Rule>
): Promise<Rule> {
  return fetchApi<Rule>(`/api/rules/${encodeURIComponent(ruleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Toggle rule enabled status
 */
export async function toggleRule(
  ruleId: string,
  enabled: boolean
): Promise<Rule> {
  return fetchApi<Rule>(`/api/rules/${encodeURIComponent(ruleId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}
