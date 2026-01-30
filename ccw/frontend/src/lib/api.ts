// ========================================
// API Client
// ========================================
// Typed fetch functions for API communication with CSRF token handling

import type { SessionMetadata, TaskData } from '../types/store';

// ========== Types ==========

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
    } catch {
      // Ignore JSON parse errors
    }

    throw error;
  }

  // Handle no-content responses
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ========== Dashboard API ==========

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const data = await fetchApi<{ statistics?: DashboardStats }>('/api/data');

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
}

// ========== Sessions API ==========

/**
 * Fetch all sessions (active and archived)
 */
export async function fetchSessions(): Promise<SessionsResponse> {
  const data = await fetchApi<{
    activeSessions?: SessionMetadata[];
    archivedSessions?: SessionMetadata[];
  }>('/api/data');

  return {
    activeSessions: data.activeSessions ?? [],
    archivedSessions: data.archivedSessions ?? [],
  };
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
