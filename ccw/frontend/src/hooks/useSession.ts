// ========================================
// useSession Hook
// ========================================
// Convenient hook for session management

import { useCallback, useMemo } from 'react';
import { useWorkflowStore, selectActiveSessionId } from '../stores/workflowStore';
import type { SessionMetadata, TaskData } from '../types/store';

export interface UseSessionReturn {
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Currently active session data */
  activeSession: SessionMetadata | null;
  /** All active sessions */
  activeSessions: SessionMetadata[];
  /** All archived sessions */
  archivedSessions: SessionMetadata[];
  /** Filtered sessions based on current filters */
  filteredSessions: SessionMetadata[];
  /** Set the active session */
  setActiveSession: (sessionId: string | null) => void;
  /** Add a new session */
  addSession: (session: SessionMetadata) => void;
  /** Update a session */
  updateSession: (sessionId: string, updates: Partial<SessionMetadata>) => void;
  /** Archive a session */
  archiveSession: (sessionId: string) => void;
  /** Remove a session */
  removeSession: (sessionId: string) => void;
  /** Add a task to a session */
  addTask: (sessionId: string, task: TaskData) => void;
  /** Update a task */
  updateTask: (sessionId: string, taskId: string, updates: Partial<TaskData>) => void;
  /** Get session by key */
  getSessionByKey: (key: string) => SessionMetadata | undefined;
}

/**
 * Hook for managing session state
 * @returns Session state and actions
 *
 * @example
 * ```tsx
 * const { activeSession, activeSessions, setActiveSession } = useSession();
 *
 * return (
 *   <SessionList
 *     sessions={activeSessions}
 *     onSelect={(id) => setActiveSession(id)}
 *   />
 * );
 * ```
 */
export function useSession(): UseSessionReturn {
  const activeSessionId = useWorkflowStore(selectActiveSessionId);
  const workflowData = useWorkflowStore((state) => state.workflowData);
  const sessionDataStore = useWorkflowStore((state) => state.sessionDataStore);

  // Actions
  const setActiveSessionId = useWorkflowStore((state) => state.setActiveSessionId);
  const addSessionAction = useWorkflowStore((state) => state.addSession);
  const updateSessionAction = useWorkflowStore((state) => state.updateSession);
  const archiveSessionAction = useWorkflowStore((state) => state.archiveSession);
  const removeSessionAction = useWorkflowStore((state) => state.removeSession);
  const addTaskAction = useWorkflowStore((state) => state.addTask);
  const updateTaskAction = useWorkflowStore((state) => state.updateTask);
  const getFilteredSessionsAction = useWorkflowStore((state) => state.getFilteredSessions);
  const getSessionByKeyAction = useWorkflowStore((state) => state.getSessionByKey);

  // Memoized active session
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    const key = `session-${activeSessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
    return sessionDataStore[key] || null;
  }, [activeSessionId, sessionDataStore]);

  // Memoized filtered sessions
  const filteredSessions = useMemo(() => {
    return getFilteredSessionsAction();
  }, [getFilteredSessionsAction, workflowData]);

  // Callbacks
  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      setActiveSessionId(sessionId);
    },
    [setActiveSessionId]
  );

  const addSession = useCallback(
    (session: SessionMetadata) => {
      addSessionAction(session);
    },
    [addSessionAction]
  );

  const updateSession = useCallback(
    (sessionId: string, updates: Partial<SessionMetadata>) => {
      updateSessionAction(sessionId, updates);
    },
    [updateSessionAction]
  );

  const archiveSession = useCallback(
    (sessionId: string) => {
      archiveSessionAction(sessionId);
    },
    [archiveSessionAction]
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      removeSessionAction(sessionId);
    },
    [removeSessionAction]
  );

  const addTask = useCallback(
    (sessionId: string, task: TaskData) => {
      addTaskAction(sessionId, task);
    },
    [addTaskAction]
  );

  const updateTask = useCallback(
    (sessionId: string, taskId: string, updates: Partial<TaskData>) => {
      updateTaskAction(sessionId, taskId, updates);
    },
    [updateTaskAction]
  );

  const getSessionByKey = useCallback(
    (key: string) => {
      return getSessionByKeyAction(key);
    },
    [getSessionByKeyAction]
  );

  return {
    activeSessionId,
    activeSession,
    activeSessions: workflowData.activeSessions,
    archivedSessions: workflowData.archivedSessions,
    filteredSessions,
    setActiveSession,
    addSession,
    updateSession,
    archiveSession,
    removeSession,
    addTask,
    updateTask,
    getSessionByKey,
  };
}
