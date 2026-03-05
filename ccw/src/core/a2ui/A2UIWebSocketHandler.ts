// ========================================
// A2UI WebSocket Handler
// ========================================
// WebSocket transport for A2UI surfaces and actions

import type { Duplex } from 'stream';
import http from 'http';
import type { IncomingMessage } from 'http';
import { createWebSocketFrame, parseWebSocketFrame, wsClients } from '../websocket.js';
import type { QuestionAnswer, AskQuestionParams, Question, PendingQuestion } from './A2UITypes.js';
import { getAllPendingQuestions } from '../services/pending-question-service.js';

const DASHBOARD_PORT = Number(process.env.CCW_PORT || 3456);

// ========== A2UI Message Types ==========

/** A2UI WebSocket message types */
export type A2UIMessageType =
  | 'a2ui-surface'      // Send surface to frontend
  | 'a2ui-action';      // Receive action from frontend

/** A2UI surface message - sent to frontend */
export interface A2UISurfaceMessage {
  type: 'a2ui-surface';
  surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
  };
  timestamp: string;
}

/** A2UI action message - received from frontend */
export interface A2UIActionMessage {
  type: 'a2ui-action';
  actionId: string;
  surfaceId: string;
  parameters?: Record<string, unknown>;
  timestamp: string;
}

/** A2UI question answer message - received from frontend */
export interface A2UIQuestionAnswerMessage {
  type: 'a2ui-answer';
  questionId: string;
  surfaceId: string;
  value: unknown;
  cancelled: boolean;
  timestamp: string;
}

// ========== A2UI Handler ==========

/**
 * A2UI WebSocket Handler
 * Manages A2UI surface distribution and action handling
 */
export class A2UIWebSocketHandler {
  private activeSurfaces = new Map<string, {
    surfaceId: string;
    questionId: string;
    timestamp: number;
  }>();

  private multiSelectSelections = new Map<string, Set<string>>();
  private singleSelectSelections = new Map<string, string>();
  private inputValues = new Map<string, string>();

  /** Answers resolved by Dashboard but not yet consumed by MCP polling */
  private resolvedAnswers = new Map<string, { answer: QuestionAnswer; timestamp: number }>();
  private resolvedMultiAnswers = new Map<string, { compositeId: string; answers: QuestionAnswer[]; timestamp: number }>();

  private answerCallback?: (answer: QuestionAnswer) => boolean;
  private multiAnswerCallback?: (compositeId: string, answers: QuestionAnswer[]) => boolean;

  /** Buffered surfaces waiting to be replayed to newly connected clients */
  private pendingSurfaces: Array<{
    surfaceUpdate: { surfaceId: string; components: unknown[]; initialState: Record<string, unknown>; displayMode?: 'popup' | 'panel' };
    message: unknown;
  }> = [];

  /**
   * Register callback for handling question answers
   * @param callback - Function to handle incoming answers
   */
  registerAnswerCallback(callback: (answer: QuestionAnswer) => boolean): void {
    this.answerCallback = callback;
  }

  /**
   * Register callback for handling multi-question composite answers (submit-all)
   * @param callback - Function to handle composite answers
   */
  registerMultiAnswerCallback(callback: (compositeId: string, answers: QuestionAnswer[]) => boolean): void {
    this.multiAnswerCallback = callback;
  }

  /**
   * Get the registered answer callback
   */
  getAnswerCallback(): ((answer: QuestionAnswer) => boolean) | undefined {
    return this.answerCallback;
  }

  /**
   * Initialize multi-select tracking for a question (used by multi-page surfaces)
   */
  initMultiSelect(questionId: string): void {
    this.multiSelectSelections.set(questionId, new Set<string>());
  }

  /**
   * Initialize single-select tracking for a question (used by multi-page surfaces)
   */
  initSingleSelect(questionId: string): void {
    this.singleSelectSelections.set(questionId, '');
  }

  /**
   * Send A2UI surface to all connected clients
   * @param surfaceUpdate - A2UI surface update to send
   * @returns Number of clients notified
   */
  sendSurface(surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
    displayMode?: 'popup' | 'panel';
  }): number {
    const message = {
      type: 'a2ui-surface',
      payload: surfaceUpdate,  // Frontend expects 'payload' not 'surfaceUpdate'
      timestamp: new Date().toISOString(),
    };

    // Track active surface
    const questionId = surfaceUpdate.initialState?.questionId as string | undefined;
    const questionType = surfaceUpdate.initialState?.questionType as string | undefined;
    if (questionId) {
      this.activeSurfaces.set(questionId, {
        surfaceId: surfaceUpdate.surfaceId,
        questionId,
        timestamp: Date.now(),
      });

      if (questionType === 'multi-select') {
        // Selection state is updated via a2ui-action messages ("toggle") and resolved on "submit"
        this.multiSelectSelections.set(questionId, new Set<string>());
      } else if (questionType === 'select') {
        // Single selection state is updated via a2ui-action messages ("select") and resolved on "submit"
        // Initialize with empty string (no selection)
        this.singleSelectSelections.set(questionId, '');
      }
    }

    // No local WebSocket clients — forward via HTTP to Dashboard server
    // (Happens when running in MCP stdio process, separate from Dashboard)
    if (wsClients.size === 0) {
      this.forwardSurfaceViaDashboard(surfaceUpdate);
      return 0;
    }

    // Broadcast to all clients
    const frame = createWebSocketFrame(message);
    let sentCount = 0;

    for (const client of wsClients) {
      try {
        client.write(frame);
        sentCount++;
      } catch (e) {
        wsClients.delete(client);
      }
    }

    console.log(`[A2UI] Sent surface ${surfaceUpdate.surfaceId} to ${sentCount} clients`);
    return sentCount;
  }

  /**
   * Replay buffered surfaces to a newly connected client, then clear the buffer.
   * @param client - The newly connected WebSocket client
   * @returns Number of surfaces replayed
   */
  replayPendingSurfaces(client: Duplex): number {
    if (this.pendingSurfaces.length === 0) {
      return 0;
    }

    const count = this.pendingSurfaces.length;
    for (const { surfaceUpdate, message } of this.pendingSurfaces) {
      try {
        const frame = createWebSocketFrame(message);
        client.write(frame);
      } catch (e) {
        console.error(`[A2UI] Failed to replay surface ${surfaceUpdate.surfaceId}:`, e);
      }
    }

    console.log(`[A2UI] Replayed ${count} buffered surface(s) to new client`);
    this.pendingSurfaces = [];
    return count;
  }

  /**
   * Forward surface to Dashboard server via HTTP POST /api/hook.
   * Used when running in a separate process (MCP stdio) without local WebSocket clients.
   */
  private forwardSurfaceViaDashboard(surfaceUpdate: {
    surfaceId: string;
    components: unknown[];
    initialState: Record<string, unknown>;
    displayMode?: 'popup' | 'panel';
  }): void {
    // Send flat so the hook handler wraps it as { type, payload: { ...fields } }
    // which matches the frontend's expected format: data.type === 'a2ui-surface' && data.payload
    const body = JSON.stringify({
      type: 'a2ui-surface',
      surfaceId: surfaceUpdate.surfaceId,
      components: surfaceUpdate.components,
      initialState: surfaceUpdate.initialState,
      displayMode: surfaceUpdate.displayMode,
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: DASHBOARD_PORT,
      path: '/api/hook',
      method: 'POST',
      timeout: 2000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    });

    // Fire-and-forget: don't keep the process alive due to an open socket
    req.on('socket', (socket) => {
      socket.unref();
    });

    req.on('error', (err) => {
      console.error(`[A2UI] Failed to forward surface ${surfaceUpdate.surfaceId} to Dashboard:`, err.message);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    req.write(body);
    req.end();

    console.log(`[A2UI] Forwarded surface ${surfaceUpdate.surfaceId} to Dashboard via HTTP`);
  }

  /**
   * Send A2UI surface to specific client
   * @param client - Specific WebSocket client
   * @param surfaceUpdate - A2UI surface update to send
   * @returns True if sent successfully
   */
  sendSurfaceToClient(
    client: Duplex,
    surfaceUpdate: {
      surfaceId: string;
      components: unknown[];
      initialState: Record<string, unknown>;
      displayMode?: 'popup' | 'panel';
    }
  ): boolean {
    const message = {
      type: 'a2ui-surface',
      payload: surfaceUpdate,  // Frontend expects 'payload' not 'surfaceUpdate'
      timestamp: new Date().toISOString(),
    };

    try {
      const frame = createWebSocketFrame(message);
      client.write(frame);
      return true;
    } catch (e) {
      wsClients.delete(client);
      return false;
    }
  }

  /**
   * Handle incoming A2UI action from frontend
   * @param action - Action message from frontend
   * @param callback - Optional callback to handle the action
   * @returns True if action was handled
   */
  handleAction(action: A2UIActionMessage, callback?: (action: A2UIActionMessage) => void): boolean {
    console.log(`[A2UI] Received action: ${action.actionId} for surface ${action.surfaceId}`);

    // Call callback if provided
    if (callback) {
      callback(action);
      return true;
    }

    return true;
  }

  /**
   * Handle incoming A2UI question answer from frontend
   * @param answer - Answer message from frontend
   * @param callback - Callback to process the answer
   * @returns True if answer was handled
   */
  handleAnswer(answer: A2UIQuestionAnswerMessage, callback: (answer: QuestionAnswer) => boolean): boolean {
    console.log(`[A2UI] Received answer for question ${answer.questionId}: cancelled=${answer.cancelled}`);

    // Convert to QuestionAnswer format
    const questionAnswer: QuestionAnswer = {
      questionId: answer.questionId,
      value: answer.value as string | boolean | string[],
      cancelled: answer.cancelled,
    };

    // Call callback
    const handled = callback(questionAnswer);

    // Remove from active surfaces if answered/cancelled
    if (handled) {
      this.activeSurfaces.delete(answer.questionId);
      this.multiSelectSelections.delete(answer.questionId);
      this.singleSelectSelections.delete(answer.questionId);
    }

    return handled;
  }

  /**
   * Try to interpret a2ui-action messages as ask_question answers.
   * This keeps the frontend generic: it only sends actions; the backend resolves question answers.
   */
  handleQuestionAction(
    action: A2UIActionMessage,
    answerCallback: (answer: QuestionAnswer) => boolean
  ): boolean {
    const params = action.parameters ?? {};
    const questionId = typeof params.questionId === 'string' ? params.questionId : undefined;

    // Handle submit-all first - it uses compositeId instead of questionId
    if (action.actionId === 'submit-all') {
      const compositeId = typeof params.compositeId === 'string' ? params.compositeId : undefined;
      const questionIds = Array.isArray(params.questionIds) ? params.questionIds as string[] : undefined;
      if (!compositeId || !questionIds) {
        return false;
      }

      // DEBUG: NDJSON log for submit-all received
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        hid: 'H2',
        event: 'submit_all_received_in_handleQuestionAction',
        compositeId,
        questionCount: questionIds.length
      }));

      // Collect answers for all sub-questions
      const answers: QuestionAnswer[] = [];
      for (const qId of questionIds) {
        const singleSel = this.singleSelectSelections.get(qId);
        const multiSel = this.multiSelectSelections.get(qId);
        const inputVal = this.inputValues.get(qId);
        const otherText = this.inputValues.get(`__other__:${qId}`);

        if (singleSel !== undefined) {
          const value = singleSel === '__other__' && otherText ? otherText : singleSel;
          answers.push({ questionId: qId, value, cancelled: false });
        } else if (multiSel !== undefined) {
          const values = Array.from(multiSel).map(v =>
            v === '__other__' && otherText ? otherText : v
          );
          answers.push({ questionId: qId, value: values, cancelled: false });
        } else if (inputVal !== undefined) {
          answers.push({ questionId: qId, value: inputVal, cancelled: false });
        } else {
          answers.push({ questionId: qId, value: '', cancelled: false });
        }

        // Cleanup per-question tracking
        this.singleSelectSelections.delete(qId);
        this.multiSelectSelections.delete(qId);
        this.inputValues.delete(qId);
        this.inputValues.delete(`__other__:${qId}`);
      }

      // Call multi-answer callback
      let handled = false;
      if (this.multiAnswerCallback) {
        handled = this.multiAnswerCallback(compositeId, answers);
      }
      if (!handled) {
        // Store for HTTP polling retrieval
        this.resolvedMultiAnswers.set(compositeId, { compositeId, answers, timestamp: Date.now() });

        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'DEBUG',
          hid: 'H2',
          event: 'answer_stored_for_polling',
          compositeId,
          answerCount: answers.length
        }));
      }
      this.activeSurfaces.delete(compositeId);
      return true;
    }

    // For other actions, questionId is required
    if (!questionId) {
      return false;
    }

    const resolveAndCleanup = (answer: QuestionAnswer): boolean => {
      const handled = answerCallback(answer);
      if (!handled) {
        // answerCallback couldn't deliver (MCP process has no local pendingQuestions)
        // Store answer for HTTP polling retrieval
        this.resolvedAnswers.set(questionId, { answer, timestamp: Date.now() });
      }
      // Always clean up UI state regardless of delivery
      this.activeSurfaces.delete(questionId);
      this.multiSelectSelections.delete(questionId);
      this.singleSelectSelections.delete(questionId);
      return true;
    };

    switch (action.actionId) {
      case 'confirm':
        return resolveAndCleanup({ questionId, value: true, cancelled: false });

      case 'cancel':
        return resolveAndCleanup({ questionId, value: false, cancelled: true });

      case 'answer': {
        const value = params.value;
        if (typeof value !== 'string' && typeof value !== 'boolean' && !Array.isArray(value)) {
          return false;
        }
        return resolveAndCleanup({ questionId, value: value as string | boolean | string[], cancelled: false });
      }

      case 'select': {
        // Single select: store the selected value (don't submit yet)
        const value = params.value;
        if (typeof value !== 'string') {
          return false;
        }
        this.singleSelectSelections.set(questionId, value);
        return true;
      }

      case 'toggle': {
        const value = params.value;
        const checked = params.checked;

        if (typeof value !== 'string' || typeof checked !== 'boolean') {
          return false;
        }

        const selected = this.multiSelectSelections.get(questionId) ?? new Set<string>();
        if (checked) {
          selected.add(value);
        } else {
          selected.delete(value);
        }
        this.multiSelectSelections.set(questionId, selected);
        return true;
      }

      case 'submit': {
        const otherText = this.inputValues.get(`__other__:${questionId}`);

        // Check if this is a single-select
        const singleSelection = this.singleSelectSelections.get(questionId);
        if (singleSelection !== undefined) {
          // Resolve __other__ to actual text input
          const value = singleSelection === '__other__' && otherText ? otherText : singleSelection;
          this.inputValues.delete(`__other__:${questionId}`);
          return resolveAndCleanup({ questionId, value, cancelled: false });
        }

        // Check if this is a multi-select
        const multiSelected = this.multiSelectSelections.get(questionId);
        if (multiSelected !== undefined && multiSelected.size > 0) {
          // Resolve __other__ in multi-select: replace with actual text
          const values = Array.from(multiSelected).map(v =>
            v === '__other__' && otherText ? otherText : v
          );
          this.inputValues.delete(`__other__:${questionId}`);
          return resolveAndCleanup({ questionId, value: values, cancelled: false });
        }

        // Check if this is a text input (no selections, but has input value)
        const inputValue = this.inputValues.get(questionId);
        if (inputValue !== undefined) {
          this.inputValues.delete(questionId);
          return resolveAndCleanup({ questionId, value: inputValue, cancelled: false });
        }

        // No value found - submit empty string
        return resolveAndCleanup({ questionId, value: '', cancelled: false });
      }

      case 'input-change': {
        // Track text input value for multi-page surfaces
        const value = params.value;
        if (typeof value !== 'string') {
          return false;
        }
        this.inputValues.set(questionId, value);
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Cancel an active surface
   * @param questionId - Question ID to cancel
   * @returns True if surface was cancelled
   */
  cancelSurface(questionId: string): boolean {
    const surface = this.activeSurfaces.get(questionId);
    if (!surface) {
      return false;
    }

    // Send cancel notification to frontend
    const message = {
      type: 'a2ui-cancel' as const,
      surfaceId: surface.surfaceId,
      questionId,
      timestamp: new Date().toISOString(),
    };

    const frame = createWebSocketFrame(message);
    for (const client of wsClients) {
      try {
        client.write(frame);
      } catch (e) {
        wsClients.delete(client);
      }
    }

    this.activeSurfaces.delete(questionId);
    this.multiSelectSelections.delete(questionId);
    this.inputValues.delete(questionId);
    return true;
  }

  /**
   * Get active surfaces
   * @returns Array of active surface info
   */
  getActiveSurfaces(): Array<{
    surfaceId: string;
    questionId: string;
    timestamp: number;
  }> {
    return Array.from(this.activeSurfaces.values());
  }

  /**
   * Clear all active surfaces
   */
  clearSurfaces(): void {
    this.activeSurfaces.clear();
  }

  /**
   * Get and remove a resolved answer (one-shot read).
   * Used by MCP HTTP polling to retrieve answers stored by the Dashboard.
   */
  getResolvedAnswer(questionId: string): QuestionAnswer | undefined {
    const entry = this.resolvedAnswers.get(questionId);
    if (entry) {
      this.resolvedAnswers.delete(questionId);
      return entry.answer;
    }
    return undefined;
  }

  /**
   * Get and remove a resolved multi-answer (one-shot read).
   * Used by MCP HTTP polling to retrieve composite answers stored by the Dashboard.
   */
  getResolvedMultiAnswer(compositeId: string): QuestionAnswer[] | undefined {
    const entry = this.resolvedMultiAnswers.get(compositeId);
    if (entry) {
      this.resolvedMultiAnswers.delete(compositeId);
      return entry.answers;
    }
    return undefined;
  }

  /**
   * Remove stale surfaces (older than specified time)
   * @param maxAge - Maximum age in milliseconds
   * @returns Number of surfaces removed
   */
  removeStaleSurfaces(maxAge: number = 3600000): number {
    const now = Date.now();
    let removed = 0;

    for (const [questionId, surface] of this.activeSurfaces) {
      if (now - surface.timestamp > maxAge) {
        this.activeSurfaces.delete(questionId);
        removed++;
      }
    }

    // Clean up stale resolved answers
    for (const [id, entry] of this.resolvedAnswers) {
      if (now - entry.timestamp > maxAge) {
        this.resolvedAnswers.delete(id);
      }
    }
    for (const [id, entry] of this.resolvedMultiAnswers) {
      if (now - entry.timestamp > maxAge) {
        this.resolvedMultiAnswers.delete(id);
      }
    }

    return removed;
  }
}

// ========== WebSocket Integration ==========

/**
 * Generate A2UI surface for a pending question
 * This is used to resend pending questions when frontend reconnects
 */
function generatePendingQuestionSurface(pq: PendingQuestion): {
  surfaceId: string;
  components: unknown[];
  initialState: Record<string, unknown>;
  displayMode?: 'popup' | 'panel';
} | null {
  const question = pq.question;
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

  // Add interactive components based on question type
  switch (question.type) {
    case 'confirm':
      components.push({
        id: 'confirm-btn',
        component: {
          Button: {
            onClick: { actionId: 'confirm', parameters: { questionId: question.id } },
            content: { Text: { text: { literalString: 'Confirm' } } },
            variant: 'primary',
          },
        },
      });
      components.push({
        id: 'cancel-btn',
        component: {
          Button: {
            onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
            content: { Text: { text: { literalString: 'Cancel' } } },
            variant: 'secondary',
          },
        },
      });
      break;

    case 'select':
      if (question.options && question.options.length > 0) {
        const options = question.options.map((opt) => ({
          label: { literalString: opt.label },
          value: opt.value,
          description: opt.description ? { literalString: opt.description } : undefined,
          isDefault: question.defaultValue !== undefined && opt.value === String(question.defaultValue),
        }));

        options.push({
          label: { literalString: 'Other' },
          value: '__other__',
          description: { literalString: 'Provide a custom answer' },
          isDefault: false,
        });

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

        components.push({
          id: 'submit-btn',
          component: {
            Button: {
              onClick: { actionId: 'submit', parameters: { questionId: question.id } },
              content: { Text: { text: { literalString: 'Submit' } } },
              variant: 'primary',
            },
          },
        });
        components.push({
          id: 'cancel-btn',
          component: {
            Button: {
              onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
              content: { Text: { text: { literalString: 'Cancel' } } },
              variant: 'secondary',
            },
          },
        });
      }
      break;

    case 'multi-select':
      if (question.options && question.options.length > 0) {
        question.options.forEach((opt, idx) => {
          components.push({
            id: `checkbox-${idx}`,
            component: {
              Checkbox: {
                label: { literalString: opt.label },
                ...(opt.description && { description: { literalString: opt.description } }),
                onChange: { actionId: 'toggle', parameters: { questionId: question.id, value: opt.value } },
                checked: { literalBoolean: false },
              },
            },
          });
        });

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

        components.push({
          id: 'submit-btn',
          component: {
            Button: {
              onClick: { actionId: 'submit', parameters: { questionId: question.id } },
              content: { Text: { text: { literalString: 'Submit' } } },
              variant: 'primary',
            },
          },
        });
        components.push({
          id: 'cancel-btn',
          component: {
            Button: {
              onClick: { actionId: 'cancel', parameters: { questionId: question.id } },
              content: { Text: { text: { literalString: 'Cancel' } } },
              variant: 'secondary',
            },
          },
        });
      }
      break;

    case 'input':
      components.push({
        id: 'input',
        component: {
          TextField: {
            value: question.defaultValue ? { literalString: String(question.defaultValue) } : undefined,
            onChange: { actionId: 'answer', parameters: { questionId: question.id } },
            placeholder: question.placeholder || 'Enter your answer',
            type: 'text',
          },
        },
      });
      break;

    default:
      return null;
  }

  return {
    surfaceId: pq.surfaceId,
    components,
    initialState: {
      questionId: question.id,
      questionType: question.type,
      options: question.options,
      required: question.required,
      timeoutAt: new Date(pq.timestamp + pq.timeout).toISOString(),
      ...(question.defaultValue !== undefined && { defaultValue: question.defaultValue }),
    },
    displayMode: 'popup',
  };
}

/**
 * Handle A2UI messages in WebSocket data handler
 * Called from main WebSocket handler
 * @param payload - Message payload
 * @param a2uiHandler - A2UI handler instance
 * @param answerCallback - Callback for question answers
 * @returns True if message was handled as A2UI message
 */
export function handleA2UIMessage(
  payload: string,
  a2uiHandler: A2UIWebSocketHandler,
  answerCallback?: (answer: QuestionAnswer) => boolean
): boolean {
  try {
    const data = JSON.parse(payload);

    // Handle FRONTEND_READY - frontend requesting pending questions
    if (data.type === 'FRONTEND_READY' && data.payload?.action === 'requestPendingQuestions') {
      console.log('[A2UI] Frontend ready, sending pending questions...');
      const pendingQuestions = getAllPendingQuestions();

      for (const pq of pendingQuestions) {
        // Regenerate surface for each pending question
        const surfaceUpdate = generatePendingQuestionSurface(pq);
        if (surfaceUpdate) {
          a2uiHandler.sendSurface(surfaceUpdate);
        }
      }

      console.log(`[A2UI] Sent ${pendingQuestions.length} pending questions to frontend`);
      return true;
    }

    // Handle A2UI action messages
    if (data.type === 'a2ui-action') {
      const action = data as A2UIActionMessage;
      a2uiHandler.handleAction(action);

      // If this action belongs to an ask_question surface, interpret it as an answer update/submit.
      if (answerCallback) {
        a2uiHandler.handleQuestionAction(action, answerCallback);
      }
      return true;
    }

    // Handle A2UI answer messages
    if (data.type === 'a2ui-answer' && answerCallback) {
      a2uiHandler.handleAnswer(data as A2UIQuestionAnswerMessage, answerCallback);
      return true;
    }

    return false;
  } catch (e) {
    console.error('[A2UI] Failed to parse message:', e);
    return false;
  }
}

// ========== Singleton Export ==========

/** Global A2UI WebSocket handler instance */
export const a2uiWebSocketHandler = new A2UIWebSocketHandler();
