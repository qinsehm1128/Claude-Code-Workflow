/**
 * Issue Zod Validation Schemas
 * Provides runtime validation for Issue-related API requests
 */
import { z } from 'zod';

/**
 * Issue type enum schema
 */
export const IssueTypeSchema = z.enum(['bug', 'feature', 'improvement', 'other']);

/**
 * Issue priority enum schema
 */
export const IssuePrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Issue source enum schema
 */
export const IssueSourceSchema = z.enum(['text', 'github', 'file']);

/**
 * Attachment schema for file uploads
 */
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().max(255),
  path: z.string(),
  type: z.string().max(100),
  size: z.number().int().nonnegative(),
  uploaded_at: z.string().datetime(),
});

/**
 * Create Issue request schema with validation rules
 * - title: required, max 200 characters
 * - description: required, max 10000 characters
 * - type: optional enum
 * - priority: optional enum
 * - attachments: optional array of attachments
 */
export const CreateIssueRequestSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .trim(),

  description: z.string()
    .min(1, 'Description is required')
    .max(10000, 'Description must be at most 10000 characters'),

  type: IssueTypeSchema.optional()
    .default('other'),

  priority: IssuePrioritySchema.optional()
    .default('medium'),

  context: z.string()
    .max(5000, 'Context must be at most 5000 characters')
    .optional()
    .default(''),

  source: IssueSourceSchema.optional()
    .default('text'),

  source_url: z.string()
    .url('Source URL must be a valid URL')
    .nullable()
    .optional()
    .default(null),

  tags: z.array(z.string().max(50))
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([]),

  attachments: z.array(AttachmentSchema)
    .max(10, 'Maximum 10 attachments allowed')
    .optional()
    .default([]),
});

/**
 * Type inference from Zod schema
 */
export type CreateIssueRequestInput = z.infer<typeof CreateIssueRequestSchema>;

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Validate create issue request
 * Returns validated data or error details
 */
export function validateCreateIssueRequest(data: unknown): ValidationResult<CreateIssueRequestInput> {
  const result = CreateIssueRequestSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));

  return {
    success: false,
    errors,
  };
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(
  errors: Array<{ field: string; message: string; code: string }>
): { message: string; suggestions: string[] } {
  const messages = errors.map((e) => `${e.field}: ${e.message}`);
  const suggestions: string[] = [];

  // Add contextual suggestions based on error types
  for (const error of errors) {
    if (error.field === 'title' && error.code === 'too_big') {
      suggestions.push('Consider using a shorter, more descriptive title');
    }
    if (error.field === 'description' && error.code === 'too_big') {
      suggestions.push('Move detailed information to context field or attachments');
    }
    if (error.field === 'type' && error.code === 'invalid_enum_value') {
      suggestions.push('Valid types are: bug, feature, improvement, other');
    }
    if (error.field === 'priority' && error.code === 'invalid_enum_value') {
      suggestions.push('Valid priorities are: low, medium, high, urgent');
    }
  }

  return {
    message: `Validation failed: ${messages.join('; ')}`,
    suggestions: suggestions.length > 0 ? suggestions : ['Check your request body format'],
  };
}
