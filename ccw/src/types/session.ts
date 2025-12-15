export type SessionStatus = 'active' | 'paused' | 'completed' | 'archived';
export type SessionType = 'workflow' | 'review' | 'tdd' | 'test' | 'docs' | 'lite-plan' | 'lite-fix';
export type ContentType =
  | 'session' | 'plan' | 'task' | 'summary'
  | 'process' | 'chat' | 'brainstorm'
  | 'review-dim' | 'review-iter' | 'review-fix'
  | 'todo' | 'context';

export interface SessionMetadata {
  id: string;
  type: SessionType;
  status: SessionStatus;
  description?: string;
  project?: string;
  created: string;
  updated: string;
}

export interface SessionOperationResult {
  success: boolean;
  sessionId?: string;
  path?: string;
  data?: unknown;
  error?: string;
}
