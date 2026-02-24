// ========================================
// A2UI Backend Type Definitions
// ========================================
// Shared types for A2UI protocol on the backend

import { z } from 'zod';

// ========== Question Types ==========

/** Question type enum */
export const QuestionTypeSchema = z.enum([
  'confirm',
  'select',
  'input',
  'multi-select',
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/** Question option for select/multi-select questions */
export const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

/** Question definition */
export const QuestionSchema = z.object({
  // Question identification
  id: z.string(),
  type: QuestionTypeSchema,

  // Question content
  title: z.string(),
  message: z.string().optional(),
  description: z.string().optional(),

  // Options for select/multi-select
  options: z.array(QuestionOptionSchema).optional(),

  // Default values
  defaultValue: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),

  // Validation
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),

  // UI hints
  placeholder: z.string().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

// ========== Answer Types ==========

/** Question answer */
export const QuestionAnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.boolean()]),
  cancelled: z.boolean().optional(),
});

export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;

// ========== AskUserQuestion-style Types ==========

/** AskUserQuestion-style option (value auto-generated from label) */
export const SimpleOptionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export type SimpleOption = z.infer<typeof SimpleOptionSchema>;

/** AskUserQuestion-style question */
export const SimpleQuestionSchema = z.object({
  question: z.string(),                    // 问题文本 → 映射到 title
  header: z.string(),                      // 短标签 → 映射到 id
  multiSelect: z.boolean().default(false),
  options: z.array(SimpleOptionSchema).optional(),
});

export type SimpleQuestion = z.infer<typeof SimpleQuestionSchema>;

/** 新格式参数 (questions 数组) */
export const AskQuestionSimpleParamsSchema = z.object({
  questions: z.array(SimpleQuestionSchema).min(1).max(4),
  timeout: z.number().optional(),
});

export type AskQuestionSimpleParams = z.infer<typeof AskQuestionSimpleParamsSchema>;

// ========== Ask Question Parameters ==========

/** Parameters for ask_question tool (legacy format) */
export const AskQuestionParamsSchema = z.object({
  question: QuestionSchema,
  timeout: z.number().optional().default(300000), // 5 minutes default
  surfaceId: z.string().optional(),
});

export type AskQuestionParams = z.infer<typeof AskQuestionParamsSchema>;

// ========== Ask Question Result ==========

/** Result from ask_question tool execution */
export const AskQuestionResultSchema = z.object({
  success: z.boolean(),
  surfaceId: z.string(),
  cancelled: z.boolean(),
  answers: z.array(QuestionAnswerSchema),
  timestamp: z.string(),
  error: z.string().optional(),
  autoSelected: z.boolean().optional(),
});

export type AskQuestionResult = z.infer<typeof AskQuestionResultSchema>;

// ========== Pending Question State ==========

/** Pending question waiting for user response */
export interface PendingQuestion {
  id: string;
  surfaceId: string;
  question: Question;
  timestamp: number;
  timeout: number;
  resolve: (result: AskQuestionResult) => void;
  reject: (error: Error) => void;
}

// ========== A2UI Surface for Questions ==========

/** Generate A2UI surface for a question */
export interface QuestionSurface {
  surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
  };
}
