// ========================================
// ask_question MCP Tool
// ========================================
// Interactive question tool using A2UI protocol

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import type {
  Question,
  QuestionType,
  QuestionOption,
  QuestionAnswer,
  AskQuestionParams,
  AskQuestionResult,
  PendingQuestion,
  SimpleQuestion,
} from '../core/a2ui/A2UITypes.js';
import http from 'http';
import { a2uiWebSocketHandler } from '../core/a2ui/A2UIWebSocketHandler.js';
import { remoteNotificationService } from '../core/services/remote-notification-service.js';
import {
  addPendingQuestion,
  getPendingQuestion,
  updatePendingQuestion,
  removePendingQuestion,
  getAllPendingQuestions,
  clearAllPendingQuestions,
  hasPendingQuestion,
} from '../core/services/pending-question-service.js';
import {
  isDashboardServerRunning,
  startCcwServeProcess,
} from '../utils/dashboard-launcher.js';

const DASHBOARD_PORT = Number(process.env.CCW_PORT || 3456);
const POLL_INTERVAL_MS = 1000;

// Register multi-answer callback for multi-page question surfaces
a2uiWebSocketHandler.registerMultiAnswerCallback(
  (compositeId: string, answers: QuestionAnswer[]) => handleMultiAnswer(compositeId, answers)
);

// ========== Constants ==========

/** Default question timeout (5 minutes) */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// ========== Validation ==========

/**
 * Validate question parameters
 * @param question - Question to validate
 * @returns Validated question or throws error
 */
function validateQuestion(question: unknown): Question {
  // Check required fields
  if (!question || typeof question !== 'object') {
    throw new Error('Question must be an object');
  }

  const q = question as Record<string, unknown>;

  if (!q.id || typeof q.id !== 'string') {
    throw new Error('Question must have an id field');
  }

  if (!q.type || typeof q.type !== 'string') {
    throw new Error('Question must have a type field');
  }

  if (!q.title || typeof q.title !== 'string') {
    throw new Error('Question must have a title field');
  }

  // Validate type
  const validTypes: QuestionType[] = ['confirm', 'select', 'input', 'multi-select'];
  if (!validTypes.includes(q.type as QuestionType)) {
    throw new Error(`Invalid question type: ${q.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate options for select/multi-select
  if (q.type === 'select' || q.type === 'multi-select') {
    if (!Array.isArray(q.options) || q.options.length === 0) {
      throw new Error(`Question type '${q.type}' requires at least one option`);
    }

    for (const opt of q.options) {
      if (!opt.value || typeof opt.value !== 'string') {
        throw new Error('Each option must have a value field');
      }
      if (!opt.label || typeof opt.label !== 'string') {
        throw new Error('Each option must have a label field');
      }
    }
  }

  // Validate timeout
  const timeout = typeof q.timeout === 'number' ? q.timeout : DEFAULT_TIMEOUT_MS;
  if (timeout < 1000 || timeout > 3600000) {
    throw new Error('Timeout must be between 1 second and 1 hour');
  }

  return q as Question;
}

/**
 * Validate answer against question constraints
 * @param question - Question definition
 * @param answer - Answer to validate
 * @returns True if answer is valid
 */
function validateAnswer(question: Question, answer: QuestionAnswer): boolean {
  // Check question ID matches
  if (answer.questionId !== question.id) {
    return false;
  }

  // Handle cancelled answers
  if (answer.cancelled === true) {
    return true;
  }

  // Validate based on question type
  switch (question.type) {
    case 'confirm':
      return typeof answer.value === 'boolean';

    case 'input':
      return typeof answer.value === 'string';

    case 'select':
      if (typeof answer.value !== 'string') {
        return false;
      }
      if (!question.options) {
        return false;
      }
      // Accept __other__ as a valid value (custom input)
      if (answer.value === '__other__' || answer.value.startsWith('__other__:')) {
        return true;
      }
      return question.options.some((opt) => opt.value === answer.value);

    case 'multi-select':
      if (!Array.isArray(answer.value)) {
        return false;
      }
      if (!question.options) {
        return false;
      }
      const validValues = new Set(question.options.map((opt) => opt.value));
      // Accept __other__ as a valid value (custom input)
      validValues.add('__other__');
      return answer.value.every((v) => typeof v === 'string' && (validValues.has(v) || v.startsWith('__other__:')));

    default:
      return false;
  }
}

// ========== Simple Format Normalization ==========

/**
 * Normalize a SimpleQuestion (AskUserQuestion-style) to internal Question format
 * @param simple - SimpleQuestion to normalize
 * @returns Normalized Question
 */
function normalizeSimpleQuestion(simple: SimpleQuestion): Question {
  let type: QuestionType;
  if (simple.options && simple.options.length > 0) {
    type = simple.multiSelect ? 'multi-select' : 'select';
  } else {
    type = 'input';
  }

  let defaultValue: string | undefined;
  const options: QuestionOption[] | undefined = simple.options?.map((opt) => {
    const isDefault = opt.isDefault === true
      || /\(Recommended\)/i.test(opt.label);
    if (isDefault && !defaultValue) {
      defaultValue = opt.label;
    }
    return { value: opt.label, label: opt.label, description: opt.description };
  });

  return {
    id: simple.header,
    type,
    title: simple.question,
    options,
    ...(defaultValue !== undefined && { defaultValue }),
  } as Question;
}

/**
 * Detect if params use the new "questions" array format
 */
function isSimpleFormat(params: Record<string, unknown>): params is { questions: SimpleQuestion[]; timeout?: number } {
  return Array.isArray(params.questions);
}

// ========== A2UI Surface Generation ==========

/**
 * Generate A2UI surface update for a question
 * @param question - Question to render
 * @param surfaceId - Surface ID for the question
 * @returns A2UI surface update object
 */
function generateQuestionSurface(question: Question, surfaceId: string, timeoutMs: number): {
  surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
    displayMode?: 'popup' | 'panel';
  };
} {
  const components: unknown[] = [];

  // Add title
  components.push({
    id: 'title',
    component: {
      Text: {
        text: { literalString: question.title },
        usageHint: 'h3',
      },
    },
  });

  // Add message if provided
  if (question.message) {
    components.push({
      id: 'message',
      component: {
        Text: {
          text: { literalString: question.message },
          usageHint: 'p',
        },
      },
    });
  }

  // Add description if provided
  if (question.description) {
    components.push({
      id: 'description',
      component: {
        Text: {
          text: { literalString: question.description },
          usageHint: 'small',
        },
      },
    });
  }

  // Add input components based on question type
  switch (question.type) {
    case 'confirm': {
      components.push({
        id: 'confirm-btn',
        component: {
          Button: {
            onClick: { actionId: 'confirm', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Confirm' } },
            },
            variant: 'primary',
          },
        },
      });
      components.push({
        id: 'cancel-btn',
        component: {
          Button: {
            onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Cancel' } },
            },
            variant: 'secondary',
          },
        },
      });
      break;
    }

    case 'select': {
      const options = question.options?.map((opt) => ({
        label: { literalString: opt.label },
        value: opt.value,
        description: opt.description ? { literalString: opt.description } : undefined,
        isDefault: question.defaultValue !== undefined && opt.value === String(question.defaultValue),
      })) || [];

      // Add "Other" option for custom input
      options.push({
        label: { literalString: 'Other' },
        value: '__other__',
        description: { literalString: 'Provide a custom answer' },
        isDefault: false,
      });

      // Use RadioGroup for direct selection display (not dropdown)
      components.push({
        id: 'radio-group',
        component: {
          RadioGroup: {
            options,
            selectedValue: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
            onChange: { actionId: 'select', parameters: { questionId: question.id } },
          },
        },
      });

      // Add Submit/Cancel buttons to avoid accidental submission
      components.push({
        id: 'submit-btn',
        component: {
          Button: {
            onClick: { actionId: 'submit', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Submit' } },
            },
            variant: 'primary',
          },
        },
      });
      components.push({
        id: 'cancel-btn',
        component: {
          Button: {
            onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Cancel' } },
            },
            variant: 'secondary',
          },
        },
      });
      break;
    }

    case 'multi-select': {
      const options = question.options?.map((opt) => ({
        label: { literalString: opt.label },
        value: opt.value,
        description: opt.description ? { literalString: opt.description } : undefined,
      })) || [];

      // Add each checkbox as a separate component for better layout control
      options.forEach((opt, idx) => {
        components.push({
          id: `checkbox-${idx}`,
          component: {
            Checkbox: {
              label: opt.label,
              ...(opt.description && { description: opt.description }),
              onChange: { actionId: 'toggle', parameters: { questionId: question.id, value: opt.value } },
              checked: { literalBoolean: false },
            },
          },
        });
      });

      // Add "Other" checkbox for custom input
      components.push({
        id: 'checkbox-other',
        component: {
          Checkbox: {
            label: { literalString: 'Other' },
            description: { literalString: 'Provide a custom answer' },
            onChange: { actionId: 'toggle', parameters: { questionId: question.id, value: '__other__' } },
            checked: { literalBoolean: false },
          },
        },
      });

      // Submit/cancel actions for multi-select so users can choose multiple options before resolving
      components.push({
        id: 'submit-btn',
        component: {
          Button: {
            onClick: { actionId: 'submit', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Submit' } },
            },
            variant: 'primary',
          },
        },
      });
      components.push({
        id: 'cancel-btn',
        component: {
          Button: {
            onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Cancel' } },
            },
            variant: 'secondary',
          },
        },
      });
      break;
    }

    case 'input': {
      components.push({
        id: 'input',
        component: {
          TextField: {
            value: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
            onChange: { actionId: 'input-change', parameters: { questionId: question.id } },
            placeholder: question.placeholder || 'Enter your answer',
            type: 'text',
          },
        },
      });
      // Add Submit/Cancel buttons for input type
      components.push({
        id: 'submit-btn',
        component: {
          Button: {
            onClick: { actionId: 'submit', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Submit' } },
            },
            variant: 'primary',
          },
        },
      });
      components.push({
        id: 'cancel-btn',
        component: {
          Button: {
            onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
            content: {
              Text: { text: { literalString: 'Cancel' } },
            },
            variant: 'secondary',
          },
        },
      });
      break;
    }
  }

  return {
    surfaceUpdate: {
      surfaceId,
      components,
      initialState: {
        questionId: question.id,
        questionType: question.type,
        options: question.options,
        required: question.required,
        timeoutAt: new Date(Date.now() + timeoutMs).toISOString(),
        ...(question.defaultValue !== undefined && { defaultValue: question.defaultValue }),
      },
      /** Display mode: 'popup' for centered dialog (interactive questions) */
      displayMode: 'popup' as const,
    },
  };
}

// ========== Question Handler ==========

/**
 * Execute ask_question tool
 * @param params - Tool parameters
 * @returns Tool result with answer or timeout
 */
export async function execute(params: AskQuestionParams): Promise<ToolResult<AskQuestionResult>> {
  try {
    // Validate question
    const question = validateQuestion(params.question);

    // Generate surface ID
    const surfaceId = params.surfaceId || `question-${question.id}-${Date.now()}`;

    // Check if this question was restored from disk (e.g., after MCP restart)
    const existingPending = getPendingQuestion(question.id);

    // Create promise for answer
    const resultPromise = new Promise<AskQuestionResult>((resolve, reject) => {
      // Store pending question with real resolve/reject
      const pendingQuestion: PendingQuestion = {
        id: question.id,
        surfaceId,
        question,
        timestamp: existingPending?.timestamp || Date.now(),
        timeout: params.timeout || DEFAULT_TIMEOUT_MS,
        resolve,
        reject,
      };

      // If question exists (restored from disk), update it with real resolve/reject
      // This fixes the "no promise attached" issue when MCP restarts
      if (existingPending) {
        updatePendingQuestion(question.id, pendingQuestion);
        console.log(`[AskQuestion] Updated restored question "${question.id}" with real resolve/reject`);
      } else {
        addPendingQuestion(pendingQuestion);
      }

      // Set timeout
      setTimeout(() => {
        const timedOutQuestion = getPendingQuestion(question.id);
        if (timedOutQuestion) {
          removePendingQuestion(question.id);
          if (question.defaultValue !== undefined) {
            resolve({
              success: true,
              surfaceId,
              cancelled: false,
              answers: [{ questionId: question.id, value: question.defaultValue as string | string[] | boolean, cancelled: false }],
              timestamp: new Date().toISOString(),
              autoSelected: true,
            });
          } else {
            resolve({
              success: false,
              surfaceId,
              cancelled: false,
              answers: [],
              timestamp: new Date().toISOString(),
              error: 'Question timed out',
            });
          }
        }
      }, params.timeout || DEFAULT_TIMEOUT_MS);
    });

    // Send A2UI surface via WebSocket to frontend
    const a2uiSurface = generateQuestionSurface(question, surfaceId, params.timeout || DEFAULT_TIMEOUT_MS);
    const sentCount = a2uiWebSocketHandler.sendSurface(a2uiSurface.surfaceUpdate);

    // Trigger remote notification for ask-user-question event (if enabled)
    if (remoteNotificationService.shouldNotify('ask-user-question')) {
      remoteNotificationService.sendNotification('ask-user-question', {
        sessionId: surfaceId,
        questionText: question.title,
      });
    }

    // If no local WS clients, check Dashboard status and start HTTP polling
    if (sentCount === 0) {
      // Check if Dashboard server is running, attempt to start if not
      const dashboardRunning = await isDashboardServerRunning();
      if (!dashboardRunning) {
        console.warn(`[AskQuestion] Dashboard server not running. Attempting to start...`);
        const started = await startCcwServeProcess();
        if (!started) {
          console.error(`[AskQuestion] Failed to automatically start Dashboard server.`);
        }
      }
      startAnswerPolling(question.id);
    }

    // Wait for answer
    const result = await resultPromise;

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========== Answer Handler ==========

/**
 * Handle incoming answer from frontend
 * @param answer - Answer from user
 * @returns True if answer was processed
 */
export function handleAnswer(answer: QuestionAnswer): boolean {
  const pending = getPendingQuestion(answer.questionId);
  if (!pending) {
    return false;
  }

  // Validate answer
  if (!validateAnswer(pending.question, answer)) {
    return false;
  }

  // Resolve promise
  pending.resolve({
    success: true,
    surfaceId: pending.surfaceId,
    cancelled: answer.cancelled || false,
    answers: [answer],
    timestamp: new Date().toISOString(),
  });

  // Remove from pending
  removePendingQuestion(answer.questionId);

  return true;
}

/**
 * Handle multi-question composite answer from frontend (submit-all)
 * @param compositeId - The composite question ID (multi-xxx)
 * @param answers - Array of answers for each page
 * @returns True if answer was processed
 */
export function handleMultiAnswer(compositeId: string, answers: QuestionAnswer[]): boolean {
  const handleStartTime = Date.now();

  // DEBUG: NDJSON log for handleMultiAnswer start
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'DEBUG',
    hid: 'H3',
    event: 'handle_multi_answer_start',
    compositeId,
    answerCount: answers.length
  }));

  const pending = getPendingQuestion(compositeId);
  if (!pending) {
    // DEBUG: NDJSON log for missing pending question
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      hid: 'H3',
      event: 'handle_multi_answer_no_pending',
      compositeId,
      elapsedMs: Date.now() - handleStartTime
    }));
    return false;
  }

  pending.resolve({
    success: true,
    surfaceId: pending.surfaceId,
    cancelled: false,
    answers,
    timestamp: new Date().toISOString(),
  });

  removePendingQuestion(compositeId);

  // DEBUG: NDJSON log for handleMultiAnswer complete
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'DEBUG',
    hid: 'H3',
    event: 'handle_multi_answer_complete',
    compositeId,
    elapsedMs: Date.now() - handleStartTime
  }));

  return true;
}

// ========== Answer Polling (MCP stdio mode) ==========

/**
 * Poll Dashboard server for answers when running in a separate MCP process.
 * Starts polling GET /api/a2ui/answer and resolves the pending promise when an answer arrives.
 * Automatically stops when the questionId is no longer in pending questions (timeout cleanup).
 */
function startAnswerPolling(questionId: string, isComposite: boolean = false): void {
  const pollPath = `/api/a2ui/answer?questionId=${encodeURIComponent(questionId)}&composite=${isComposite}`;
  const startTime = Date.now();

  // DEBUG: NDJSON log for polling start
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'DEBUG',
    hid: 'H1',
    event: 'polling_start',
    questionId,
    isComposite,
    port: DASHBOARD_PORT,
    firstPollDelayMs: POLL_INTERVAL_MS
  }));

  console.error(`[A2UI-Poll] Starting polling for questionId=${questionId}, composite=${isComposite}, port=${DASHBOARD_PORT}`);

  let pollCount = 0;

  const poll = () => {
    // Stop if the question was already resolved or timed out
    if (!hasPendingQuestion(questionId)) {
      console.error(`[A2UI-Poll] Stopping: questionId=${questionId} no longer pending`);
      return;
    }

    pollCount++;
    const pollStartTime = Date.now();

    // DEBUG: NDJSON log for each poll attempt
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      hid: 'H1',
      event: 'poll_attempt',
      questionId,
      pollCount,
      elapsedMs: pollStartTime - startTime
    }));

    const req = http.get({ hostname: '127.0.0.1', port: DASHBOARD_PORT, path: pollPath, timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            console.error(`[A2UI-Poll] HTTP ${res.statusCode} from Dashboard (first 200 chars):`, data.slice(0, 200));
            setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }

          const parsed = JSON.parse(data);
          if (parsed.pending) {
            // No answer yet, schedule next poll
            setTimeout(poll, POLL_INTERVAL_MS);
            return;
          }

          console.error(`[A2UI-Poll] Answer received for questionId=${questionId}:`, JSON.stringify(parsed).slice(0, 200));

          // DEBUG: NDJSON log for answer received
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'DEBUG',
            hid: 'H1',
            event: 'answer_received',
            questionId,
            pollCount,
            elapsedMs: Date.now() - startTime,
            pollLatencyMs: Date.now() - pollStartTime,
            isComposite,
            answerPreview: JSON.stringify(parsed).slice(0, 100)
          }));

          if (isComposite && Array.isArray(parsed.answers)) {
            const ok = handleMultiAnswer(questionId, parsed.answers as QuestionAnswer[]);
            console.error(`[A2UI-Poll] handleMultiAnswer result: ${ok}`);
            if (!ok && hasPendingQuestion(questionId)) {
              // Answer consumed but delivery failed; keep polling for a new answer
              setTimeout(poll, POLL_INTERVAL_MS);
            }
          } else if (!isComposite && parsed.answer) {
            const ok = handleAnswer(parsed.answer as QuestionAnswer);
            console.error(`[A2UI-Poll] handleAnswer result: ${ok}`);
            if (!ok && hasPendingQuestion(questionId)) {
              // Answer consumed but validation/delivery failed; keep polling for a new answer
              setTimeout(poll, POLL_INTERVAL_MS);
            }
          } else {
            console.error(`[A2UI-Poll] Unexpected response shape, keep polling`);
            setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (e) {
          console.error(`[A2UI-Poll] Parse error:`, e);
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[A2UI-Poll] Network error: ${err.message}`);
      if (hasPendingQuestion(questionId)) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
  };

  // Start first poll after a short delay to give the Dashboard time to receive the surface
  setTimeout(poll, POLL_INTERVAL_MS);
}

// ========== Cleanup ==========

/**
 * Cancel a pending question
 * @param questionId - Question ID to cancel
 * @returns True if question was cancelled
 */
export function cancelQuestion(questionId: string): boolean {
  const pending = getPendingQuestion(questionId);
  if (!pending) {
    return false;
  }

  pending.resolve({
    success: false,
    surfaceId: pending.surfaceId,
    cancelled: true,
    answers: [],
    timestamp: new Date().toISOString(),
    error: 'Question cancelled',
  });

  removePendingQuestion(questionId);
  return true;
}

/**
 * Get all pending questions
 * @returns Array of pending questions
 */
export function getPendingQuestions(): PendingQuestion[] {
  return getAllPendingQuestions();
}

/**
 * Clear all pending questions
 */
export function clearPendingQuestions(): void {
  for (const pending of getAllPendingQuestions()) {
    pending.reject(new Error('Question cleared'));
  }
  clearAllPendingQuestions();
}

// ========== Tool Schema ==========

export const schema: ToolSchema = {
  name: 'ask_question',
  description: `Ask the user a question through an interactive A2UI interface. Supports two calling styles:

**Style 1 - AskUserQuestion-compatible (recommended)**:
\`\`\`json
{
  "questions": [{
    "question": "Which library?",
    "header": "Library",
    "multiSelect": false,
    "options": [
      { "label": "React", "description": "UI library" },
      { "label": "Vue", "description": "Progressive framework" }
    ]
  }]
}
\`\`\`
Response includes \`answersDict\`: \`{ "Library": "React" }\`

Type inference: options + multiSelect=true → multi-select; options + multiSelect=false → select; no options → input.

**Style 2 - Legacy format**:
\`\`\`json
{
  "question": {
    "id": "q1",
    "type": "select",
    "title": "Which library?",
    "options": [{ "value": "react", "label": "React" }]
  }
}
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'AskUserQuestion-style questions array (1-4 questions). Use this OR "question", not both.',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The question text' },
            header: { type: 'string', description: 'Short label, also used as response key (max 12 chars)' },
            multiSelect: { type: 'boolean', description: 'Allow multiple selections (default: false)' },
            options: {
              type: 'array',
              description: 'Available choices. Omit for text input.',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: 'Display text, also used as value' },
                  description: { type: 'string', description: 'Option description' },
                  isDefault: { type: 'boolean', description: 'Mark as default/recommended option' },
                },
                required: ['label'],
              },
            },
          },
          required: ['question', 'header'],
        },
        minItems: 1,
        maxItems: 4,
      },
      question: {
        type: 'object',
        description: 'Legacy format: single question object. Use this OR "questions", not both.',
        properties: {
          id: { type: 'string', description: 'Unique identifier for this question' },
          type: {
            type: 'string',
            enum: ['confirm', 'select', 'input', 'multi-select'],
            description: 'Question type: confirm (yes/no), select (dropdown), input (text field), multi-select (checkboxes)',
          },
          title: { type: 'string', description: 'Question title' },
          message: { type: 'string', description: 'Additional message text' },
          description: { type: 'string', description: 'Helper text' },
          options: {
            type: 'array',
            description: 'Options for select/multi-select questions',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['value', 'label'],
            },
          },
          defaultValue: { type: 'string', description: 'Default value' },
          required: { type: 'boolean', description: 'Whether an answer is required' },
          placeholder: { type: 'string', description: 'Placeholder text for input fields' },
        },
        required: ['id', 'type', 'title'],
      },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 300000 / 5 minutes)' },
      surfaceId: { type: 'string', description: 'Custom surface ID (auto-generated if not provided). Legacy format only.' },
    },
  },
};

/**
 * Tool handler for MCP integration
 * Supports both legacy format (question object) and AskUserQuestion-style format (questions array)
 */
export async function handler(params: Record<string, unknown>): Promise<ToolResult<AskQuestionResult>> {
  if (isSimpleFormat(params)) {
    return executeSimpleFormat(params.questions, params.timeout);
  }
  return execute(params as AskQuestionParams);
}

// ========== Multi-Question Surface Generation ==========

/**
 * Page metadata for multi-question surfaces
 */
interface PageMeta {
  index: number;
  questionId: string;
  title: string;
  type: string;
}

/**
 * Generate a single A2UI surface containing all questions, each tagged with a page index.
 * @param questions - Array of SimpleQuestion
 * @returns Surface update with page-tagged components and page metadata
 */
function generateMultiQuestionSurface(
  questions: SimpleQuestion[],
  surfaceId: string,
  timeoutMs: number,
): {
  surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
    displayMode: 'popup';
  };
  pages: PageMeta[];
} {
  const components: unknown[] = [];
  const pages: PageMeta[] = [];

  for (let pageIdx = 0; pageIdx < questions.length; pageIdx++) {
    const simpleQ = questions[pageIdx];
    const question = normalizeSimpleQuestion(simpleQ);
    const qId = question.id; // header used as id

    pages.push({
      index: pageIdx,
      questionId: qId,
      title: question.title,
      type: question.type,
    });

    // Title
    components.push({
      id: `page-${pageIdx}-title`,
      page: pageIdx,
      component: {
        Text: {
          text: { literalString: question.title },
          usageHint: 'h3',
        },
      },
    });

    // Message
    if (question.message) {
      components.push({
        id: `page-${pageIdx}-message`,
        page: pageIdx,
        component: {
          Text: {
            text: { literalString: question.message },
            usageHint: 'p',
          },
        },
      });
    }

    // Description
    if (question.description) {
      components.push({
        id: `page-${pageIdx}-description`,
        page: pageIdx,
        component: {
          Text: {
            text: { literalString: question.description },
            usageHint: 'small',
          },
        },
      });
    }

    // Interactive components based on question type
    switch (question.type) {
      case 'select': {
        const options = question.options?.map((opt) => ({
          label: { literalString: opt.label },
          value: opt.value,
          description: opt.description ? { literalString: opt.description } : undefined,
          isDefault: question.defaultValue !== undefined && opt.value === String(question.defaultValue),
        })) || [];

        // Add "Other" option for custom input
        options.push({
          label: { literalString: 'Other' },
          value: '__other__',
          description: { literalString: 'Provide a custom answer' },
          isDefault: false,
        });

        components.push({
          id: `page-${pageIdx}-radio-group`,
          page: pageIdx,
          component: {
            RadioGroup: {
              options,
              selectedValue: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
              onChange: { actionId: 'select', parameters: { questionId: qId } },
            },
          },
        });
        break;
      }

      case 'multi-select': {
        const options = question.options?.map((opt) => ({
          label: { literalString: opt.label },
          value: opt.value,
          description: opt.description ? { literalString: opt.description } : undefined,
        })) || [];

        options.forEach((opt, idx) => {
          components.push({
            id: `page-${pageIdx}-checkbox-${idx}`,
            page: pageIdx,
            component: {
              Checkbox: {
                label: opt.label,
                ...(opt.description && { description: opt.description }),
                onChange: { actionId: 'toggle', parameters: { questionId: qId, value: opt.value } },
                checked: { literalBoolean: false },
              },
            },
          });
        });

        // Add "Other" checkbox for custom input
        components.push({
          id: `page-${pageIdx}-checkbox-other`,
          page: pageIdx,
          component: {
            Checkbox: {
              label: { literalString: 'Other' },
              description: { literalString: 'Provide a custom answer' },
              onChange: { actionId: 'toggle', parameters: { questionId: qId, value: '__other__' } },
              checked: { literalBoolean: false },
            },
          },
        });
        break;
      }

      case 'input': {
        components.push({
          id: `page-${pageIdx}-input`,
          page: pageIdx,
          component: {
            TextField: {
              value: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
              onChange: { actionId: 'input-change', parameters: { questionId: qId } },
              placeholder: question.placeholder || 'Enter your answer',
              type: 'text',
            },
          },
        });
        break;
      }

      case 'confirm': {
        // Confirm type gets handled as a single boolean per page
        // No extra component — the page navigation handles yes/no
        break;
      }
    }
  }

  return {
    surfaceUpdate: {
      surfaceId,
      components,
      initialState: {
        questionId: `multi-${Date.now()}`,
        questionType: 'multi-question',
        pages,
        totalPages: questions.length,
        timeoutAt: new Date(Date.now() + timeoutMs).toISOString(),
      },
      displayMode: 'popup',
    },
    pages,
  };
}

/**
 * Execute questions in AskUserQuestion-style format.
 * Single question: falls back to legacy sequential popup.
 * Multiple questions: generates a single multi-page surface.
 */
async function executeSimpleFormat(
  questions: SimpleQuestion[],
  timeout?: number,
): Promise<ToolResult<AskQuestionResult>> {
  // Single question: use legacy single-popup flow
  if (questions.length === 1) {
    const simpleQ = questions[0];
    const question = normalizeSimpleQuestion(simpleQ);
    const params = {
      question,
      timeout: timeout ?? DEFAULT_TIMEOUT_MS,
    } satisfies AskQuestionParams;

    const result = await execute(params);
    if (!result.success || !result.result) {
      return result;
    }

    // Propagate inner failures (e.g. timeout) — don't mask them as success
    if (result.result.cancelled || !result.result.success) {
      return result;
    }

    const answersDict: Record<string, string | string[]> = {};
    if (result.result.answers.length > 0) {
      const answer = result.result.answers[0];
      answersDict[simpleQ.header] = answer.value as string | string[];
    }

    return {
      success: true,
      result: {
        success: true,
        surfaceId: result.result.surfaceId,
        cancelled: false,
        answers: result.result.answers,
        timestamp: new Date().toISOString(),
        answersDict,
      } as AskQuestionResult & { answersDict: Record<string, string | string[]> },
    };
  }

  // Multiple questions: single multi-page surface
  const compositeId = `multi-${Date.now()}`;
  const surfaceId = `question-${compositeId}`;

  const { surfaceUpdate, pages } = generateMultiQuestionSurface(questions, surfaceId, timeout ?? DEFAULT_TIMEOUT_MS);

  // Create promise for the composite answer
  const resultPromise = new Promise<AskQuestionResult>((resolve, reject) => {
    const pendingQuestion: PendingQuestion = {
      id: compositeId,
      surfaceId,
      question: {
        id: compositeId,
        type: 'input', // placeholder type — multi-question uses custom answer handling
        title: 'Multi-question',
        required: false,
      },
      timestamp: Date.now(),
      timeout: timeout ?? DEFAULT_TIMEOUT_MS,
      resolve,
      reject,
    };
    addPendingQuestion(pendingQuestion);

    // Also register each sub-question's questionId pointing to the same pending entry
    // so that select/toggle actions on individual questions get tracked
    for (const page of pages) {
      // Initialize selection tracking in the websocket handler
      if (page.type === 'multi-select') {
        a2uiWebSocketHandler.initMultiSelect(page.questionId);
      } else if (page.type === 'select') {
        a2uiWebSocketHandler.initSingleSelect(page.questionId);
      }
    }

    setTimeout(() => {
      const timedOutQuestion = getPendingQuestion(compositeId);
      if (timedOutQuestion) {
        removePendingQuestion(compositeId);
        // Collect default values from each sub-question
        const defaultAnswers: QuestionAnswer[] = [];
        for (const simpleQ of questions) {
          const q = normalizeSimpleQuestion(simpleQ);
          if (q.defaultValue !== undefined) {
            defaultAnswers.push({ questionId: q.id, value: q.defaultValue as string | string[] | boolean, cancelled: false });
          }
        }
        if (defaultAnswers.length > 0) {
          resolve({
            success: true,
            surfaceId,
            cancelled: false,
            answers: defaultAnswers,
            timestamp: new Date().toISOString(),
            autoSelected: true,
          });
        } else {
          resolve({
            success: false,
            surfaceId,
            cancelled: false,
            answers: [],
            timestamp: new Date().toISOString(),
            error: 'Question timed out',
          });
        }
      }
    }, timeout ?? DEFAULT_TIMEOUT_MS);
  });

  // Send the surface
  const sentCount = a2uiWebSocketHandler.sendSurface(surfaceUpdate);

  // Trigger remote notification for ask-user-question event (if enabled)
  if (remoteNotificationService.shouldNotify('ask-user-question')) {
    const questionTexts = questions.map(q => q.question).join('\n');
    remoteNotificationService.sendNotification('ask-user-question', {
      sessionId: compositeId,
      questionText: questionTexts,
    });
  }

  // If no local WS clients, start HTTP polling for answer from Dashboard
  if (sentCount === 0) {
    startAnswerPolling(compositeId, true);
  }

  // Wait for answer
  const result = await resultPromise;

  // If cancelled, return as-is
  if (result.cancelled) {
    return { success: true, result };
  }

  // Build answersDict from the answers array
  const answersDict: Record<string, string | string[]> = {};
  if (result.answers) {
    for (const answer of result.answers) {
      // Find the matching SimpleQuestion by questionId (which maps to header)
      const simpleQ = questions.find(q => q.header === answer.questionId);
      if (simpleQ) {
        answersDict[simpleQ.header] = answer.value as string | string[];
      }
    }
  }

  return {
    success: true,
    result: {
      ...result,
      answersDict,
    } as AskQuestionResult & { answersDict: Record<string, string | string[]> },
  };
}
