// ========================================
// Pending Question Service
// ========================================
// Manages persistent storage of pending questions for ask_question tool

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { PendingQuestion } from '../a2ui/A2UITypes.js';

// Storage configuration
const STORAGE_DIR = join(homedir(), '.ccw', 'pending-questions');
const STORAGE_FILE = join(STORAGE_DIR, 'questions.json');

// In-memory cache of pending questions
const pendingQuestions = new Map<string, PendingQuestion>();

// Flag to track if service has been initialized
let initialized = false;

/**
 * Serializable representation of a pending question (without resolve/reject functions)
 */
interface SerializedPendingQuestion {
  id: string;
  surfaceId: string;
  question: {
    id: string;
    type: string;
    title: string;
    message?: string;
    description?: string;
    options?: Array<{ value: string; label: string; description?: string }>;
    defaultValue?: string | string[] | boolean;
    required?: boolean;
    placeholder?: string;
    timeout?: number;
  };
  timestamp: number;
  timeout: number;
}

/**
 * Initialize the service by loading pending questions from disk.
 * Called automatically on module load.
 */
function initialize(): void {
  if (initialized) return;

  try {
    // Ensure storage directory exists
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // Load existing questions from disk
    if (existsSync(STORAGE_FILE)) {
      const content = readFileSync(STORAGE_FILE, 'utf8');
      const serialized: SerializedPendingQuestion[] = JSON.parse(content);

      for (const sq of serialized) {
        // Create a PendingQuestion with placeholder resolve/reject
        // These will be replaced when the question is actually awaited
        const pendingQ: PendingQuestion = {
          id: sq.id,
          surfaceId: sq.surfaceId,
          question: sq.question as PendingQuestion['question'],
          timestamp: sq.timestamp,
          timeout: sq.timeout,
          resolve: () => {
            console.warn(`[PendingQuestionService] Resolve called for restored question ${sq.id} - no promise attached`);
          },
          reject: () => {
            console.warn(`[PendingQuestionService] Reject called for restored question ${sq.id} - no promise attached`);
          },
        };
        pendingQuestions.set(sq.id, pendingQ);
      }

      // Only log when there are actual pending questions (silent when 0)
      if (pendingQuestions.size > 0) {
        console.log(`[PendingQuestionService] Loaded ${pendingQuestions.size} pending questions from storage`);
      }
    }

    initialized = true;
  } catch (error) {
    console.error('[PendingQuestionService] Failed to initialize:', error);
    initialized = true; // Still mark as initialized to prevent retry loops
  }
}

/**
 * Persist current pending questions to disk.
 */
function persistQuestions(): void {
  try {
    // Ensure storage directory exists
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const serialized: SerializedPendingQuestion[] = [];

    for (const pq of pendingQuestions.values()) {
      serialized.push({
        id: pq.id,
        surfaceId: pq.surfaceId,
        question: {
          id: pq.question.id,
          type: pq.question.type,
          title: pq.question.title,
          message: pq.question.message,
          description: pq.question.description,
          options: pq.question.options,
          defaultValue: pq.question.defaultValue,
          required: pq.question.required,
          placeholder: pq.question.placeholder,
          timeout: pq.timeout,
        },
        timestamp: pq.timestamp,
        timeout: pq.timeout,
      });
    }

    writeFileSync(STORAGE_FILE, JSON.stringify(serialized, null, 2), 'utf8');
  } catch (error) {
    console.error('[PendingQuestionService] Failed to persist questions:', error);
  }
}

/**
 * Add a pending question to storage.
 * @param pendingQ - The pending question to add
 */
export function addPendingQuestion(pendingQ: PendingQuestion): void {
  initialize();
  pendingQuestions.set(pendingQ.id, pendingQ);
  persistQuestions();
  console.log(`[PendingQuestionService] Added pending question: ${pendingQ.id}`);
}

/**
 * Get a pending question by ID.
 * @param questionId - The question ID
 * @returns The pending question or undefined
 */
export function getPendingQuestion(questionId: string): PendingQuestion | undefined {
  initialize();
  return pendingQuestions.get(questionId);
}

/**
 * Update an existing pending question (e.g., to attach new resolve/reject).
 * @param questionId - The question ID
 * @param pendingQ - The updated pending question
 */
export function updatePendingQuestion(questionId: string, pendingQ: PendingQuestion): boolean {
  initialize();
  if (pendingQuestions.has(questionId)) {
    pendingQuestions.set(questionId, pendingQ);
    // Don't persist here - resolve/reject functions aren't serializable
    return true;
  }
  return false;
}

/**
 * Remove a pending question from storage.
 * @param questionId - The question ID to remove
 * @returns True if the question was found and removed
 */
export function removePendingQuestion(questionId: string): boolean {
  initialize();
  const existed = pendingQuestions.delete(questionId);
  if (existed) {
    persistQuestions();
    console.log(`[PendingQuestionService] Removed pending question: ${questionId}`);
  }
  return existed;
}

/**
 * Get all pending questions.
 * @returns Array of all pending questions
 */
export function getAllPendingQuestions(): PendingQuestion[] {
  initialize();
  return Array.from(pendingQuestions.values());
}

/**
 * Check if a pending question exists.
 * @param questionId - The question ID to check
 * @returns True if the question exists
 */
export function hasPendingQuestion(questionId: string): boolean {
  initialize();
  return pendingQuestions.has(questionId);
}

/**
 * Get the count of pending questions.
 * @returns Number of pending questions
 */
export function getPendingQuestionCount(): number {
  initialize();
  return pendingQuestions.size;
}

/**
 * Clear all pending questions from storage.
 */
export function clearAllPendingQuestions(): void {
  initialize();
  pendingQuestions.clear();
  persistQuestions();
  console.log(`[PendingQuestionService] Cleared all pending questions`);
}

/**
 * Clean up expired questions (older than their timeout).
 * This can be called periodically to prevent stale data accumulation.
 * @returns Number of questions removed
 */
export function cleanupExpiredQuestions(): number {
  initialize();
  const now = Date.now();
  let removed = 0;

  for (const [id, pq] of pendingQuestions) {
    if (now - pq.timestamp > pq.timeout) {
      pendingQuestions.delete(id);
      removed++;
    }
  }

  if (removed > 0) {
    persistQuestions();
    console.log(`[PendingQuestionService] Cleaned up ${removed} expired questions`);
  }

  return removed;
}

// Initialize on module load
initialize();
