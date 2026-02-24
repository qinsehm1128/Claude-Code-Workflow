/**
 * Issue Type Definitions
 * TypeScript types for Issue submission and management
 */

/**
 * Issue type enum values
 */
export type IssueType = 'bug' | 'feature' | 'improvement' | 'other';

/**
 * Issue priority enum values
 */
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Issue status enum values
 */
export type IssueStatus = 'registered' | 'analyzing' | 'planned' | 'executing' | 'completed' | 'cancelled';

/**
 * Attachment entity for file uploads
 */
export interface Attachment {
  id: string;           // UUID
  filename: string;     // 原始文件名
  path: string;         // 相对存储路径
  type: string;         // MIME类型
  size: number;         // 文件大小(bytes)
  uploaded_at: string;  // ISO时间戳
}

/**
 * Create Issue Request DTO
 * Required fields: title, description
 */
export interface CreateIssueRequest {
  title: string;
  description: string;
  type?: IssueType;
  priority?: IssuePriority;
  context?: string;
  source?: 'text' | 'github' | 'file';
  source_url?: string | null;
  tags?: string[];
  attachments?: Attachment[];
}

/**
 * Issue entity stored in persistence layer
 */
export interface Issue {
  id: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  context: string;
  source: 'text' | 'github' | 'file';
  source_url: string | null;
  tags: string[];
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}

/**
 * API success response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * API error response wrapper
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    suggestions?: string[];
  };
}

/**
 * Union type for all API responses
 */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation error response with detailed field errors
 */
export interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: ValidationErrorDetail[];
    suggestions: string[];
  };
}
