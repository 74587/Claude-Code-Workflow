// ========================================
// API Client
// ========================================
// Typed fetch functions for API communication with CSRF token handling

import type { SessionMetadata, TaskData, IndexStatus, IndexRebuildRequest, Rule, RuleCreateInput, RulesResponse, Prompt, PromptInsight, Pattern, Suggestion } from '../types/store';

// Re-export types for backward compatibility
export type { IndexStatus, IndexRebuildRequest, Rule, RuleCreateInput, RulesResponse, Prompt, PromptInsight, Pattern, Suggestion };


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
    path: (backendSession as unknown as { path?: string }).path,
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
 * Fetch dashboard statistics for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchDashboardStats(projectPath?: string): Promise<DashboardStats> {
  try {
    const url = projectPath ? `/api/data?path=${encodeURIComponent(projectPath)}` : '/api/data';
    const data = await fetchApi<{ statistics?: DashboardStats }>(url);

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
 * Fetch all sessions (active and archived) for a specific workspace
 * Applies transformation layer to map backend data to frontend SessionMetadata interface
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchSessions(projectPath?: string): Promise<SessionsResponse> {
  try {
    const url = projectPath ? `/api/data?path=${encodeURIComponent(projectPath)}` : '/api/data';
    const data = await fetchApi<{
      activeSessions?: BackendSessionData[];
      archivedSessions?: BackendSessionData[];
    }>(url);

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
 * Switch workspace response
 */
export interface SwitchWorkspaceResponse {
  projectPath: string;
  recentPaths: string[];
  activeSessions: SessionMetadata[];
  archivedSessions: SessionMetadata[];
  statistics: DashboardStats;
}

/**
 * Remove recent path response
 */
export interface RemoveRecentPathResponse {
  paths: string[];
}

/**
 * Fetch data for path response
 */
export interface FetchDataForPathResponse {
  projectOverview?: ProjectOverview | null;
  sessions?: SessionsResponse;
  statistics?: DashboardStats;
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

/**
 * Switch workspace to a different project path
 */
export async function switchWorkspace(path: string): Promise<SwitchWorkspaceResponse> {
  return fetchApi<SwitchWorkspaceResponse>(`/api/switch-path?path=${encodeURIComponent(path)}`);
}

/**
 * Fetch data for a specific path
 */
export async function fetchDataForPath(path: string): Promise<FetchDataForPathResponse> {
  return fetchApi<FetchDataForPathResponse>(`/api/data?path=${encodeURIComponent(path)}`);
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
 * Fetch all loops for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLoops(projectPath?: string): Promise<LoopsResponse> {
  const url = projectPath ? `/api/loops?path=${encodeURIComponent(projectPath)}` : '/api/loops';
  const data = await fetchApi<{ loops?: Loop[] }>(url);
  return {
    loops: data.loops ?? [],
    total: data.loops?.length ?? 0,
  };
}

/**
 * Fetch a single loop by ID for a specific workspace
 * @param loopId - The loop ID to fetch
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLoop(loopId: string, projectPath?: string): Promise<Loop> {
  const url = projectPath
    ? `/api/loops/${encodeURIComponent(loopId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/loops/${encodeURIComponent(loopId)}`;
  return fetchApi<Loop>(url);
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

/**
 * Activate a queue
 */
export async function activateQueue(queueId: string, projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/${encodeURIComponent(queueId)}/activate?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
  });
}

/**
 * Deactivate the current queue
 */
export async function deactivateQueue(projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/deactivate?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
  });
}

/**
 * Delete a queue
 */
export async function deleteQueue(queueId: string, projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/${encodeURIComponent(queueId)}?path=${encodeURIComponent(projectPath)}`, {
    method: 'DELETE',
  });
}

/**
 * Merge queues
 */
export async function mergeQueues(sourceId: string, targetId: string, projectPath: string): Promise<void> {
  return fetchApi<void>(`/api/queue/merge?path=${encodeURIComponent(projectPath)}`, {
    method: 'POST',
    body: JSON.stringify({ sourceId, targetId }),
  });
}

// ========== Discovery API ==========

export interface DiscoverySession {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  findings_count: number;
  created_at: string;
  completed_at?: string;
}

export interface Finding {
  id: string;
  sessionId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  code_snippet?: string;
  created_at: string;
}

export async function fetchDiscoveries(projectPath?: string): Promise<DiscoverySession[]> {
  const url = projectPath
    ? `/api/discoveries?path=${encodeURIComponent(projectPath)}`
    : '/api/discoveries';
  const data = await fetchApi<{ sessions?: DiscoverySession[] }>(url);
  return data.sessions ?? [];
}

export async function fetchDiscoveryDetail(
  sessionId: string,
  projectPath?: string
): Promise<DiscoverySession> {
  const url = projectPath
    ? `/api/discoveries/${encodeURIComponent(sessionId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/discoveries/${encodeURIComponent(sessionId)}`;
  return fetchApi<DiscoverySession>(url);
}

export async function fetchDiscoveryFindings(
  sessionId: string,
  projectPath?: string
): Promise<Finding[]> {
  const url = projectPath
    ? `/api/discoveries/${encodeURIComponent(sessionId)}/findings?path=${encodeURIComponent(projectPath)}`
    : `/api/discoveries/${encodeURIComponent(sessionId)}/findings`;
  const data = await fetchApi<{ findings?: Finding[] }>(url);
  return data.findings ?? [];
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
 * Fetch all skills for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchSkills(projectPath?: string): Promise<SkillsResponse> {
  const url = projectPath ? `/api/skills?path=${encodeURIComponent(projectPath)}` : '/api/skills';
  const data = await fetchApi<{ skills?: Skill[] }>(url);
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
 * Fetch all commands for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchCommands(projectPath?: string): Promise<CommandsResponse> {
  const url = projectPath ? `/api/commands?path=${encodeURIComponent(projectPath)}` : '/api/commands';
  const data = await fetchApi<{ commands?: Command[] }>(url);
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
 * Fetch all memories for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchMemories(projectPath?: string): Promise<MemoryResponse> {
  const url = projectPath ? `/api/memory?path=${encodeURIComponent(projectPath)}` : '/api/memory';
  const data = await fetchApi<{
    memories?: CoreMemory[];
    totalSize?: number;
    claudeMdCount?: number;
  }>(url);
  return {
    memories: data.memories ?? [],
    totalSize: data.totalSize ?? 0,
    claudeMdCount: data.claudeMdCount ?? 0,
  };
}

/**
 * Create a new memory entry for a specific workspace
 * @param input - Memory input data
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function createMemory(input: {
  content: string;
  tags?: string[];
}, projectPath?: string): Promise<CoreMemory> {
  const url = projectPath ? `/api/memory?path=${encodeURIComponent(projectPath)}` : '/api/memory';
  return fetchApi<CoreMemory>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a memory entry for a specific workspace
 * @param memoryId - Memory ID to update
 * @param input - Partial memory data
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function updateMemory(
  memoryId: string,
  input: Partial<CoreMemory>,
  projectPath?: string
): Promise<CoreMemory> {
  const url = projectPath
    ? `/api/memory/${encodeURIComponent(memoryId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/memory/${encodeURIComponent(memoryId)}`;
  return fetchApi<CoreMemory>(url, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Delete a memory entry for a specific workspace
 * @param memoryId - Memory ID to delete
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function deleteMemory(memoryId: string, projectPath?: string): Promise<void> {
  const url = projectPath
    ? `/api/memory/${encodeURIComponent(memoryId)}?path=${encodeURIComponent(projectPath)}`
    : `/api/memory/${encodeURIComponent(memoryId)}`;
  return fetchApi<void>(url, {
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
 * Fetch project overview for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchProjectOverview(projectPath?: string): Promise<ProjectOverview | null> {
  const url = projectPath ? `/api/ccw?path=${encodeURIComponent(projectPath)}` : '/api/ccw';
  const data = await fetchApi<{ projectOverview?: ProjectOverview }>(url);
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
 * Fetch session detail for a specific workspace
 * First fetches session list to get the session path, then fetches detail data
 * @param sessionId - Session ID to fetch details for
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchSessionDetail(sessionId: string, projectPath?: string): Promise<SessionDetailResponse> {
  // Step 1: Fetch all sessions to get the session path
  const sessionsData = await fetchSessions(projectPath);
  const allSessions = [...sessionsData.activeSessions, ...sessionsData.archivedSessions];
  const session = allSessions.find(s => s.session_id === sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Step 2: Use the session path to fetch detail data from the correct endpoint
  // Backend expects path parameter, not sessionId
  const sessionPath = (session as any).path || session.session_id;
  const pathParam = projectPath || sessionPath;
  const detailData = await fetchApi<any>(`/api/session-detail?path=${encodeURIComponent(pathParam)}&type=all`);

  // Step 3: Transform the response to match SessionDetailResponse interface
  return {
    session,
    context: detailData.context,
    summary: detailData.summary,
    implPlan: detailData.implPlan,
    conflicts: detailData.conflicts,
    review: detailData.review,
  };
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
 * Fetch CLI execution history for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchHistory(projectPath?: string): Promise<HistoryResponse> {
  const url = projectPath ? `/api/cli/history?path=${encodeURIComponent(projectPath)}` : '/api/cli/history';
  const data = await fetchApi<{ executions?: CliExecution[] }>(url);
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

/**
 * Fetch CLI execution detail (conversation records)
 */
export async function fetchExecutionDetail(
  executionId: string,
  sourceDir?: string
): Promise<ConversationRecord> {
  const params = new URLSearchParams({ id: executionId });
  if (sourceDir) params.set('path', sourceDir);

  const data = await fetchApi<ConversationRecord>(
    `/api/cli/execution?${params.toString()}`
  );
  return data;
}

// ========== CLI Execution Types ==========

/**
 * Conversation record for a CLI execution
 * Contains the full conversation history between user and CLI tool
 */
export interface ConversationRecord {
  id: string;
  tool: string;
  mode?: string;
  turns: ConversationTurn[];
  turn_count: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Single turn in a CLI conversation
 */
export interface ConversationTurn {
  turn: number;
  prompt: string;
  output: {
    stdout: string;
    stderr?: string;
    truncated?: boolean;
    structured?: unknown[];
  };
  timestamp: string;
  duration_ms: number;
  status?: 'success' | 'error' | 'timeout';
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
  step?: number | string;
  phase?: string;
  title?: string;
  action?: string;
  description?: string;
  modification_points?: string[] | Array<{ file: string; target: string; change: string }>;
  logic_flow?: string[];
  depends_on?: number[] | string[];
  output?: string;
  output_to?: string;
  commands?: string[];
  steps?: string[];
  test_patterns?: string;
  [key: string]: unknown;
}

export interface PreAnalysisStep {
  step?: string;
  action?: string;
  output_to?: string;
  commands?: string[];
}

export interface FlowControl {
  pre_analysis?: PreAnalysisStep[];
  implementation_approach?: (ImplementationStep | string)[];
  target_files?: Array<{ path: string; name?: string }>;
  [key: string]: unknown;
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
 * Fetch all lite tasks sessions for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLiteTasks(projectPath?: string): Promise<LiteTasksResponse> {
  const url = projectPath ? `/api/data?path=${encodeURIComponent(projectPath)}` : '/api/data';
  const data = await fetchApi<{ liteTasks?: LiteTasksResponse }>(url);
  return data.liteTasks || {};
}

/**
 * Fetch a single lite task session by ID for a specific workspace
 * @param sessionId - Session ID to fetch
 * @param type - Type of lite task
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchLiteTaskSession(
  sessionId: string,
  type: 'lite-plan' | 'lite-fix' | 'multi-cli-plan',
  projectPath?: string
): Promise<LiteTaskSession | null> {
  const data = await fetchLiteTasks(projectPath);
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
 * Fetch all MCP servers (project and global scope) for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchMcpServers(projectPath?: string): Promise<McpServersResponse> {
  const url = projectPath ? `/api/mcp/servers?path=${encodeURIComponent(projectPath)}` : '/api/mcp/servers';
  const data = await fetchApi<{ project?: McpServer[]; global?: McpServer[] }>(url);
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

// ========== Codex MCP API ==========
/**
 * Codex MCP Server - Read-only server with config path
 * Extends McpServer with optional configPath field
 */
export interface CodexMcpServer extends McpServer {
  configPath?: string;
}

export interface CodexMcpServersResponse {
  servers: CodexMcpServer[];
  configPath: string;
}

/**
 * Fetch Codex MCP servers from config.toml
 * Codex MCP servers are read-only (managed via config file)
 */
export async function fetchCodexMcpServers(): Promise<CodexMcpServersResponse> {
  return fetchApi<CodexMcpServersResponse>('/api/mcp/codex-servers');
}

/**
 * Add a new MCP server to Codex config
 * Note: This requires write access to Codex config.toml
 */
export async function addCodexMcpServer(server: Omit<McpServer, 'name'>): Promise<CodexMcpServer> {
  return fetchApi<CodexMcpServer>('/api/mcp/codex-add', {
    method: 'POST',
    body: JSON.stringify(server),
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
  command?: string;
  trigger: string;
  matcher?: string;
}

export interface HooksResponse {
  hooks: Hook[];
}

/**
 * Fetch all hooks for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchHooks(projectPath?: string): Promise<HooksResponse> {
  const url = projectPath ? `/api/hooks?path=${encodeURIComponent(projectPath)}` : '/api/hooks';
  const data = await fetchApi<{ hooks?: Hook[] }>(url);
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

/**
 * Create a new hook
 */
export async function createHook(
  input: { name: string; description?: string; trigger: string; matcher?: string; command: string }
): Promise<Hook> {
  return fetchApi<Hook>('/api/hooks/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update hook using dedicated update endpoint with partial input
 */
export async function updateHookConfig(
  hookName: string,
  input: { description?: string; trigger?: string; matcher?: string; command?: string }
): Promise<Hook> {
  return fetchApi<Hook>('/api/hooks/update', {
    method: 'POST',
    body: JSON.stringify({ name: hookName, ...input }),
  });
}

/**
 * Delete a hook
 */
export async function deleteHook(hookName: string): Promise<void> {
  return fetchApi<void>(`/api/hooks/delete/${encodeURIComponent(hookName)}`, {
    method: 'DELETE',
  });
}

/**
 * Install a hook from predefined template
 */
export async function installHookTemplate(templateId: string): Promise<Hook> {
  return fetchApi<Hook>('/api/hooks/install-template', {
    method: 'POST',
    body: JSON.stringify({ templateId }),
  });
}

// ========== Rules API ==========

/**
 * Fetch all rules for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchRules(projectPath?: string): Promise<RulesResponse> {
  const url = projectPath ? `/api/rules?path=${encodeURIComponent(projectPath)}` : '/api/rules';
  const data = await fetchApi<{ rules?: Rule[] }>(url);
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

/**
 * Create a new rule
 */
export async function createRule(input: RuleCreateInput): Promise<Rule> {
  return fetchApi<Rule>('/api/rules/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Delete a rule
 */
export async function deleteRule(
  ruleId: string,
  location?: string
): Promise<void> {
  return fetchApi<void>(`/api/rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ location }),
  });
}

// ========== CCW Tools MCP API ==========

/**
 * CCW MCP configuration interface
 */
export interface CcwMcpConfig {
  isInstalled: boolean;
  enabledTools: string[];
  projectRoot?: string;
  allowedDirs?: string;
  disableSandbox?: boolean;
}

/**
 * Fetch CCW Tools MCP configuration
 */
export async function fetchCcwMcpConfig(): Promise<CcwMcpConfig> {
  const data = await fetchApi<CcwMcpConfig>('/api/mcp/ccw-config');
  return data;
}

/**
 * Update CCW Tools MCP configuration
 */
export async function updateCcwConfig(config: {
  enabledTools?: string[];
  projectRoot?: string;
  allowedDirs?: string;
  disableSandbox?: boolean;
}): Promise<CcwMcpConfig> {
  return fetchApi<CcwMcpConfig>('/api/mcp/ccw-config', {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/**
 * Install CCW Tools MCP server
 */
export async function installCcwMcp(): Promise<CcwMcpConfig> {
  return fetchApi<CcwMcpConfig>('/api/mcp/ccw-install', {
    method: 'POST',
  });
}

/**
 * Uninstall CCW Tools MCP server
 */
export async function uninstallCcwMcp(): Promise<void> {
  await fetchApi<void>('/api/mcp/ccw-uninstall', {
    method: 'POST',
  });
}

// ========== Index Management API ==========

/**
 * Fetch current index status for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchIndexStatus(projectPath?: string): Promise<IndexStatus> {
  const url = projectPath ? `/api/index/status?path=${encodeURIComponent(projectPath)}` : '/api/index/status';
  return fetchApi<IndexStatus>(url);
}

/**
 * Rebuild index
 */
export async function rebuildIndex(request: IndexRebuildRequest = {}): Promise<IndexStatus> {
  return fetchApi<IndexStatus>('/api/index/rebuild', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ========== Prompt History API ==========

/**
 * Prompt history response from backend
 */
export interface PromptsResponse {
  prompts: Prompt[];
  total: number;
}

/**
 * Prompt insights response from backend
 */
export interface PromptInsightsResponse {
  insights: PromptInsight[];
  patterns: Pattern[];
  suggestions: Suggestion[];
}

/**
 * Analyze prompts request
 */
export interface AnalyzePromptsRequest {
  tool?: 'gemini' | 'qwen' | 'codex';
  promptIds?: string[];
  limit?: number;
}

/**
 * Fetch all prompts from history for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchPrompts(projectPath?: string): Promise<PromptsResponse> {
  const url = projectPath ? `/api/memory/prompts?path=${encodeURIComponent(projectPath)}` : '/api/memory/prompts';
  return fetchApi<PromptsResponse>(url);
}

/**
 * Fetch prompt insights from backend for a specific workspace
 * @param projectPath - Optional project path to filter data by workspace
 */
export async function fetchPromptInsights(projectPath?: string): Promise<PromptInsightsResponse> {
  const url = projectPath ? `/api/memory/insights?path=${encodeURIComponent(projectPath)}` : '/api/memory/insights';
  return fetchApi<PromptInsightsResponse>(url);
}

/**
 * Analyze prompts using AI tool
 */
export async function analyzePrompts(request: AnalyzePromptsRequest = {}): Promise<PromptInsightsResponse> {
  return fetchApi<PromptInsightsResponse>('/api/memory/analyze', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Delete a prompt from history
 */
export async function deletePrompt(promptId: string): Promise<void> {
  await fetchApi<void>('/api/memory/prompts/' + encodeURIComponent(promptId), {
    method: 'DELETE',
  });
}

// ========== File Explorer API ==========

/**
 * File tree response from backend
 */
export interface FileTreeResponse {
  rootNodes: import('../types/file-explorer').FileSystemNode[];
  fileCount: number;
  directoryCount: number;
  totalSize: number;
  buildTime: number;
}

/**
 * Fetch file tree for a given root path
 */
export async function fetchFileTree(rootPath: string = '/', options: {
  maxDepth?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
} = {}): Promise<FileTreeResponse> {
  const params = new URLSearchParams();
  params.append('rootPath', rootPath);
  if (options.maxDepth !== undefined) params.append('maxDepth', String(options.maxDepth));
  if (options.includeHidden !== undefined) params.append('includeHidden', String(options.includeHidden));
  if (options.excludePatterns) params.append('excludePatterns', options.excludePatterns.join(','));

  return fetchApi<FileTreeResponse>(`/api/explorer/tree?${params.toString()}`);
}

/**
 * Fetch file content
 */
export async function fetchFileContent(filePath: string, options: {
  encoding?: 'utf8' | 'ascii' | 'base64';
  maxSize?: number;
} = {}): Promise<import('../types/file-explorer').FileContent> {
  const params = new URLSearchParams();
  params.append('path', filePath);
  if (options.encoding) params.append('encoding', options.encoding);
  if (options.maxSize !== undefined) params.append('maxSize', String(options.maxSize));

  return fetchApi<import('../types/file-explorer').FileContent>(`/api/explorer/file?${params.toString()}`);
}

/**
 * Search files request
 */
export interface SearchFilesRequest {
  rootPath?: string;
  query: string;
  filePatterns?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  caseSensitive?: boolean;
}

/**
 * Search files response
 */
export interface SearchFilesResponse {
  results: Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    matches: Array<{
      line: number;
      column: number;
      context: string;
    }>;
  }>;
  totalMatches: number;
  searchTime: number;
}

/**
 * Search files by content or name
 */
export async function searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
  return fetchApi<SearchFilesResponse>('/api/explorer/search', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get available root directories
 */
export interface RootDirectory {
  path: string;
  name: string;
  isWorkspace: boolean;
  isGitRoot: boolean;
}

export async function fetchRootDirectories(): Promise<RootDirectory[]> {
  return fetchApi<RootDirectory[]>('/api/explorer/roots');
}

// ========== Graph Explorer API ==========

/**
 * Graph dependencies request
 */
export interface GraphDependenciesRequest {
  rootPath?: string;
  maxDepth?: number;
  includeTypes?: string[];
  excludePatterns?: string[];
}

/**
 * Graph dependencies response
 */
export interface GraphDependenciesResponse {
  nodes: import('../types/graph-explorer').GraphNode[];
  edges: import('../types/graph-explorer').GraphEdge[];
  metadata: import('../types/graph-explorer').GraphMetadata;
}

/**
 * Fetch graph dependencies for code visualization
 */
export async function fetchGraphDependencies(request: GraphDependenciesRequest = {}): Promise<GraphDependenciesResponse> {
  const params = new URLSearchParams();
  if (request.rootPath) params.append('rootPath', request.rootPath);
  if (request.maxDepth !== undefined) params.append('maxDepth', String(request.maxDepth));
  if (request.includeTypes) params.append('includeTypes', request.includeTypes.join(','));
  if (request.excludePatterns) params.append('excludePatterns', request.excludePatterns.join(','));

  return fetchApi<GraphDependenciesResponse>(`/api/graph/dependencies?${params.toString()}`);
}

/**
 * Graph impact analysis request
 */
export interface GraphImpactRequest {
  nodeId: string;
  direction?: 'upstream' | 'downstream' | 'both';
  maxDepth?: number;
}

/**
 * Graph impact analysis response
 */
export interface GraphImpactResponse {
  nodeId: string;
  dependencies: import('../types/graph-explorer').GraphNode[];
  dependents: import('../types/graph-explorer').GraphNode[];
  paths: Array<{
    nodes: string[];
    edges: string[];
  }>;
}

/**
 * Fetch impact analysis for a specific node
 */
export async function fetchGraphImpact(request: GraphImpactRequest): Promise<GraphImpactResponse> {
  const params = new URLSearchParams();
  params.append('nodeId', request.nodeId);
  if (request.direction) params.append('direction', request.direction);
  if (request.maxDepth !== undefined) params.append('maxDepth', String(request.maxDepth));

  return fetchApi<GraphImpactResponse>(`/api/graph/impact?${params.toString()}`);
}

