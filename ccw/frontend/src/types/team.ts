// ========================================
// Team Types
// ========================================
// Types for team execution visualization

export interface TeamMessage {
  id: string;
  ts: string;
  from: string;
  to: string;
  type: TeamMessageType;
  summary: string;
  ref?: string;
  data?: Record<string, unknown>;
}

export type TeamMessageType =
  | 'plan_ready'
  | 'plan_approved'
  | 'plan_revision'
  | 'task_unblocked'
  | 'impl_complete'
  | 'impl_progress'
  | 'test_result'
  | 'review_result'
  | 'fix_required'
  | 'error'
  | 'shutdown'
  | 'message';

export interface TeamMember {
  member: string;
  lastSeen: string;
  lastAction: string;
  messageCount: number;
}

export interface TeamSummary {
  name: string;
  messageCount: number;
  lastActivity: string;
}

export interface TeamMessagesResponse {
  total: number;
  showing: number;
  messages: TeamMessage[];
}

export interface TeamStatusResponse {
  members: TeamMember[];
  total_messages: number;
}

export interface TeamsListResponse {
  teams: TeamSummary[];
}

export interface TeamMessageFilter {
  from?: string;
  to?: string;
  type?: string;
}

export type PipelineStage = 'plan' | 'impl' | 'test' | 'review';
export type PipelineStageStatus = 'completed' | 'in_progress' | 'pending' | 'blocked';
