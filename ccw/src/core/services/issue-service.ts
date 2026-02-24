/**
 * Issue Service
 * Business logic for Issue CRUD operations
 */
import { randomUUID } from 'crypto';
import type {
  Issue,
  CreateIssueRequest,
  ApiResponse,
  ApiErrorResponse,
  ValidationErrorResponse,
  IssueType,
  IssuePriority,
  IssueStatus,
} from '../types/issue.js';
import {
  validateCreateIssueRequest,
  formatValidationErrors,
  type CreateIssueRequestInput,
} from '../schemas/issue-schema.js';

/**
 * Generate a unique Issue ID
 * Format: ISS-{timestamp}-{random}
 */
export function generateIssueId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().split('-')[0];
  return `ISS-${timestamp}-${random}`;
}

/**
 * Map validated input to Issue entity
 */
export function createIssueEntity(input: CreateIssueRequestInput, customId?: string): Issue {
  const now = new Date().toISOString();
  return {
    id: customId || generateIssueId(),
    title: input.title,
    description: input.description,
    type: input.type as IssueType,
    priority: input.priority as IssuePriority,
    status: 'registered' as IssueStatus,
    context: input.context || '',
    source: input.source || 'text',
    source_url: input.source_url || null,
    tags: input.tags || [],
    attachments: input.attachments || [],
    created_at: now,
    updated_at: now,
  };
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  suggestions?: string[]
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      suggestions,
    },
  };
}

/**
 * Create validation error response with field details
 */
export function createValidationErrorResponse(
  errors: Array<{ field: string; message: string; code: string }>
): ValidationErrorResponse {
  const formatted = formatValidationErrors(errors);
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: formatted.message,
      details: errors,
      suggestions: formatted.suggestions,
    },
  };
}

/**
 * Service result type for create operation
 */
export type CreateIssueResult =
  | { success: true; issue: Issue; status: 201 }
  | { success: false; error: ValidationErrorResponse | ApiErrorResponse; status: 400 };

/**
 * Process create issue request with validation
 */
export function processCreateIssueRequest(
  body: unknown,
  options?: { customId?: string }
): CreateIssueResult {
  // Validate request body
  const validation = validateCreateIssueRequest(body);

  if (!validation.success || !validation.data) {
    return {
      success: false,
      error: createValidationErrorResponse(validation.errors || []),
      status: 400,
    };
  }

  // Create issue entity
  const issue = createIssueEntity(validation.data, options?.customId);

  return {
    success: true,
    issue,
    status: 201,
  };
}

/**
 * Check if an issue ID already exists
 */
export function isIssueIdExists(issues: Issue[], id: string): boolean {
  return issues.some((issue) => issue.id === id);
}

/**
 * Validate issue ID format
 */
export function isValidIssueId(id: string): boolean {
  return /^ISS-[a-z0-9]+-[a-z0-9]+$/i.test(id);
}
