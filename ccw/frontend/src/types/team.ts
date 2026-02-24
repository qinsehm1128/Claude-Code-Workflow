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

export type TeamStatus = 'active' | 'completed' | 'archived';

export interface TeamSummary {
  name: string;
  messageCount: number;
  lastActivity: string;
}

export interface TeamSummaryExtended extends TeamSummary {
  status: TeamStatus;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  pipeline_mode?: string;
  memberCount: number;
  members: string[];  // Always provided by backend
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
  teams: TeamSummaryExtended[];
}

export interface TeamMessageFilter {
  from?: string;
  to?: string;
  type?: string;
}

export type PipelineStage = 'plan' | 'impl' | 'test' | 'review';
export type PipelineStageStatus = 'completed' | 'in_progress' | 'pending' | 'blocked';

// ========================================
// Team Artifacts Types
// ========================================
// Types for team artifacts tree visualization

export type ArtifactNodeType = 'file' | 'directory';

export type ContentType = 'markdown' | 'json' | 'text' | 'unknown';

export interface ArtifactNode {
  type: ArtifactNodeType;
  name: string;
  path: string;
  contentType: ContentType;  // Always provided by backend
  size?: number;
  modifiedAt?: string;
  children?: ArtifactNode[];
}

export interface TeamArtifactsResponse {
  teamName: string;
  sessionId: string;
  sessionPath: string;
  pipelineMode?: string;
  tree: ArtifactNode[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}
