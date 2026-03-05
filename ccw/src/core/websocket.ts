import { createHash } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { a2uiWebSocketHandler, handleA2UIMessage } from './a2ui/A2UIWebSocketHandler.js';
import { handleAnswer } from '../tools/ask-question.js';
import type {
  QueueWSMessageType,
  QueueWSMessage,
  QueueSchedulerStateUpdateMessage,
  QueueItemAddedMessage,
  QueueItemUpdatedMessage,
  QueueItemRemovedMessage,
  QueueSchedulerConfigUpdatedMessage,
} from '../types/queue-types.js';

// WebSocket configuration for connection limits and rate limiting
const WS_MAX_CONNECTIONS = 100;
const WS_MESSAGE_RATE_LIMIT = 10; // messages per second per client
const WS_RATE_LIMIT_WINDOW = 1000; // 1 second window

// WebSocket clients for real-time notifications
export const wsClients = new Set<Duplex>();

// Track message counts per client for rate limiting
export const wsClientMessageCounts = new Map<Duplex, { count: number; resetTime: number }>();

/**
 * Universal broadcast throttling system
 * Reduces WebSocket traffic by deduplicating and rate-limiting broadcast messages
 */

interface ThrottleEntry {
  lastSend: number;
  pendingData: unknown;
}

type ThrottleCategory = 'state_update' | 'memory_cpu' | 'log_output' | 'immediate';

/** Map of message type to throttle configuration */
const THROTTLE_CONFIG = new Map<string, { interval: number; category: ThrottleCategory }>(
  [
    // State updates - high frequency, low value when duplicated
    ['LOOP_STATE_UPDATE', { interval: 1000, category: 'state_update' }],
    ['ORCHESTRATOR_STATE_UPDATE', { interval: 1000, category: 'state_update' }],
    ['COORDINATOR_STATE_UPDATE', { interval: 1000, category: 'state_update' }],
    ['QUEUE_SCHEDULER_STATE_UPDATE', { interval: 1000, category: 'state_update' }],

    // Memory/CPU updates - medium frequency
    ['LOOP_STEP_COMPLETED', { interval: 500, category: 'memory_cpu' }],
    ['ORCHESTRATOR_NODE_COMPLETED', { interval: 500, category: 'memory_cpu' }],
    ['COORDINATOR_COMMAND_COMPLETED', { interval: 500, category: 'memory_cpu' }],
    ['QUEUE_ITEM_UPDATED', { interval: 500, category: 'memory_cpu' }],

    // Log/output - higher frequency allowed for real-time streaming
    ['LOOP_LOG_ENTRY', { interval: 200, category: 'log_output' }],
    ['ORCHESTRATOR_LOG', { interval: 200, category: 'log_output' }],
    ['COORDINATOR_LOG_ENTRY', { interval: 200, category: 'log_output' }],

    // Item added/removed - send immediately
    ['QUEUE_ITEM_ADDED', { interval: 0, category: 'immediate' }],
    ['QUEUE_ITEM_REMOVED', { interval: 0, category: 'immediate' }],
    ['QUEUE_SCHEDULER_CONFIG_UPDATED', { interval: 0, category: 'immediate' }],
    ['ORCHESTRATOR_NODE_STARTED', { interval: 0, category: 'immediate' }],
    ['ORCHESTRATOR_NODE_FAILED', { interval: 0, category: 'immediate' }],
    ['COORDINATOR_COMMAND_STARTED', { interval: 0, category: 'immediate' }],
    ['COORDINATOR_COMMAND_FAILED', { interval: 0, category: 'immediate' }],
    ['COORDINATOR_QUESTION_ASKED', { interval: 0, category: 'immediate' }],
    ['COORDINATOR_ANSWER_RECEIVED', { interval: 0, category: 'immediate' }],
    ['LOOP_COMPLETED', { interval: 0, category: 'immediate' }],
  ] as const
);

/** Per-message-type throttle tracking */
const throttleState = new Map<string, ThrottleEntry>();

/** Metrics for broadcast optimization */
export const broadcastMetrics = {
  sent: 0,
  throttled: 0,
  deduped: 0,
};

/**
 * Get throttle configuration for a message type
 */
function getThrottleConfig(messageType: string): { interval: number; category: ThrottleCategory } {
  return THROTTLE_CONFIG.get(messageType) || { interval: 0, category: 'immediate' };
}

/**
 * Serialize message data for comparison
 */
function serializeMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (typeof data === 'object' && data !== null) {
    return JSON.stringify(data, Object.keys(data).sort());
  }
  return String(data);
}

/**
 * Create WebSocket frame
 */
export function createWebSocketFrame(data: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(data), 'utf8');
  const length = payload.length;

  let frame;
  if (length <= 125) {
    frame = Buffer.alloc(2 + length);
    frame[0] = 0x81; // Text frame, FIN
    frame[1] = length;
    payload.copy(frame, 2);
  } else if (length <= 65535) {
    frame = Buffer.alloc(4 + length);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.alloc(10 + length);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
    payload.copy(frame, 10);
  }

  return frame;
}

/**
 * Broadcast message to all connected WebSocket clients with universal throttling
 * - Deduplicates identical messages within throttle window
 * - Rate-limits by message type with adaptive intervals
 * - Preserves message ordering within each type
 */
export function broadcastToClients(data: unknown): void {
  const eventType =
    typeof data === 'object' && data !== null && 'type' in data ? (data as { type?: unknown }).type : undefined;

  if (!eventType || typeof eventType !== 'string') {
    // Unknown message type - send immediately
    const frame = createWebSocketFrame(data);
    for (const client of wsClients) {
      try {
        client.write(frame);
      } catch (e) {
        wsClients.delete(client);
      }
    }
    console.log(`[WS] Broadcast to ${wsClients.size} clients: unknown type`);
    return;
  }

  const config = getThrottleConfig(eventType);
  const now = Date.now();
  const state = throttleState.get(eventType);

  if (config.interval === 0) {
    // Immediate - send without throttling
    const frame = createWebSocketFrame(data);
    for (const client of wsClients) {
      try {
        client.write(frame);
      } catch (e) {
        wsClients.delete(client);
      }
    }
    broadcastMetrics.sent++;
    throttleState.set(eventType, { lastSend: now, pendingData: data });
    console.log(`[WS] Broadcast to ${wsClients.size} clients: ${eventType} (immediate)`);
    return;
  }

  // Check if we should throttle
  const currentDataHash = serializeMessage(data);

  if (state) {
    const timeSinceLastSend = now - state.lastSend;

    // Check for duplicate data
    if (timeSinceLastSend < config.interval) {
      const pendingDataHash = serializeMessage(state.pendingData);
      if (currentDataHash === pendingDataHash) {
        // Duplicate message - drop it
        broadcastMetrics.deduped++;
        console.log(`[WS] Throttled duplicate ${eventType} (${timeSinceLastSend}ms since last)`);
        return;
      }
      // Different data but within throttle window - update pending
      throttleState.set(eventType, { lastSend: state.lastSend, pendingData: data });
      broadcastMetrics.throttled++;
      console.log(`[WS] Throttled ${eventType} (${timeSinceLastSend}ms since last, pending updated)`);
      return;
    }
  }

  // Send the message
  const frame = createWebSocketFrame(data);
  for (const client of wsClients) {
    try {
      client.write(frame);
    } catch (e) {
      wsClients.delete(client);
    }
  }

  broadcastMetrics.sent++;
  throttleState.set(eventType, { lastSend: now, pendingData: data });
  console.log(`[WS] Broadcast to ${wsClients.size} clients: ${eventType}`);
}

/**
 * Get broadcast throttling metrics
 */
export function getBroadcastMetrics(): Readonly<typeof broadcastMetrics> {
  return { ...broadcastMetrics };
}

/**
 * Reset broadcast throttling metrics (for testing/monitoring)
 */
export function resetBroadcastMetrics(): void {
  broadcastMetrics.sent = 0;
  broadcastMetrics.throttled = 0;
  broadcastMetrics.deduped = 0;
}

/**
 * Check if a new WebSocket connection should be accepted
 * Returns true if connection allowed, false if limit reached
 */
export function canAcceptWebSocketConnection(): boolean {
  return wsClients.size < WS_MAX_CONNECTIONS;
}

/**
 * Check if a client has exceeded their message rate limit
 * Returns true if rate limit OK, false if exceeded
 */
export function checkClientRateLimit(client: Duplex): boolean {
  const now = Date.now();
  const tracking = wsClientMessageCounts.get(client);

  if (!tracking || now > tracking.resetTime) {
    // First message or window expired - reset tracking
    wsClientMessageCounts.set(client, { count: 1, resetTime: now + WS_RATE_LIMIT_WINDOW });
    return true;
  }

  if (tracking.count >= WS_MESSAGE_RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  tracking.count++;
  return true;
}

/**
 * Clean up client tracking when they disconnect
 */
export function removeClientTracking(client: Duplex): void {
  wsClients.delete(client);
  wsClientMessageCounts.delete(client);
}

/**
 * WebSocket message types for Loop monitoring
 */
export type LoopMessageType =
  | 'LOOP_STATE_UPDATE'
  | 'LOOP_STEP_COMPLETED'
  | 'LOOP_COMPLETED'
  | 'LOOP_LOG_ENTRY';

/**
 * Loop State Update - fired when loop status changes
 */
export interface LoopStateUpdateMessage {
  type: 'LOOP_STATE_UPDATE';
  loop_id: string;
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  current_iteration: number;
  current_cli_step: number;
  updated_at: string;
  timestamp: string;
}

/**
 * Loop Step Completed - fired when a CLI step finishes
 */
export interface LoopStepCompletedMessage {
  type: 'LOOP_STEP_COMPLETED';
  loop_id: string;
  step_id: string;
  exit_code: number;
  duration_ms: number;
  output: string;
  timestamp: string;
}

/**
 * Loop Completed - fired when entire loop finishes
 */
export interface LoopCompletedMessage {
  type: 'LOOP_COMPLETED';
  loop_id: string;
  final_status: 'completed' | 'failed';
  total_iterations: number;
  reason?: string;
  timestamp: string;
}

/**
 * Loop Log Entry - fired for streaming log lines
 */
export interface LoopLogEntryMessage {
  type: 'LOOP_LOG_ENTRY';
  loop_id: string;
  step_id: string;
  line: string;
  timestamp: string;
}

/**
 * Orchestrator WebSocket message types
 */
export type OrchestratorMessageType =
  | 'ORCHESTRATOR_STATE_UPDATE'
  | 'ORCHESTRATOR_NODE_STARTED'
  | 'ORCHESTRATOR_NODE_COMPLETED'
  | 'ORCHESTRATOR_NODE_FAILED'
  | 'ORCHESTRATOR_LOG';

/**
 * Execution log entry for Orchestrator
 */
export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  nodeId?: string;
  message: string;
}

/**
 * Orchestrator State Update - fired when execution status changes
 */
export interface OrchestratorStateUpdateMessage {
  type: 'ORCHESTRATOR_STATE_UPDATE';
  execId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentNodeId?: string;
  timestamp: string;
}

/**
 * Orchestrator Node Started - fired when a node begins execution
 */
export interface OrchestratorNodeStartedMessage {
  type: 'ORCHESTRATOR_NODE_STARTED';
  execId: string;
  nodeId: string;
  timestamp: string;
}

/**
 * Orchestrator Node Completed - fired when a node finishes successfully
 */
export interface OrchestratorNodeCompletedMessage {
  type: 'ORCHESTRATOR_NODE_COMPLETED';
  execId: string;
  nodeId: string;
  result?: unknown;
  timestamp: string;
}

/**
 * Orchestrator Node Failed - fired when a node encounters an error
 */
export interface OrchestratorNodeFailedMessage {
  type: 'ORCHESTRATOR_NODE_FAILED';
  execId: string;
  nodeId: string;
  error: string;
  timestamp: string;
}

/**
 * Orchestrator Log - fired for execution log entries
 */
export interface OrchestratorLogMessage {
  type: 'ORCHESTRATOR_LOG';
  execId: string;
  log: ExecutionLog;
  timestamp: string;
}

export function handleWebSocketUpgrade(req: IncomingMessage, socket: Duplex, _head: Buffer): void {
  const header = req.headers['sec-websocket-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    socket.end();
    return;
  }

  // Check connection limit
  if (!canAcceptWebSocketConnection()) {
    const responseHeaders = [
      'HTTP/1.1 429 Too Many Requests',
      'Content-Type: text/plain',
      'Connection: close',
      '',
      'WebSocket connection limit reached. Please try again later.',
      '',
      ''
    ].join('\r\n');
    socket.write(responseHeaders);
    socket.end();
    console.warn(`[WS] Connection rejected: limit reached (${wsClients.size}/${WS_MAX_CONNECTIONS})`);
    return;
  }

  const acceptKey = createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\r\n');

  socket.write(responseHeaders);

  // Add to clients set
  wsClients.add(socket);
  // Initialize rate limit tracking
  wsClientMessageCounts.set(socket, { count: 0, resetTime: Date.now() + WS_RATE_LIMIT_WINDOW });
  console.log(`[WS] Client connected (${wsClients.size} total)`);

  // Replay any buffered A2UI surfaces to the new client
  a2uiWebSocketHandler.replayPendingSurfaces(socket);

  // Handle incoming messages
  let pendingBuffer = Buffer.alloc(0);

  socket.on('data', (buffer: Buffer) => {
    // Buffers may contain partial frames or multiple frames; accumulate and parse in a loop.
    pendingBuffer = Buffer.concat([pendingBuffer, buffer]);

    try {
      while (true) {
        const frame = parseWebSocketFrame(pendingBuffer);
        if (!frame) return;

        const { opcode, payload, frameLength } = frame;
        pendingBuffer = pendingBuffer.slice(frameLength);

        switch (opcode) {
          case 0x1: // Text frame
            if (payload) {
              // Check rate limit before processing
              if (!checkClientRateLimit(socket)) {
                console.warn('[WS] Rate limit exceeded for client');
                break;
              }
              console.log('[WS] Received:', payload);
              // Try to handle as A2UI message
              const handledAsA2UI = handleA2UIMessage(payload, a2uiWebSocketHandler, handleAnswer);
              if (handledAsA2UI) {
                console.log('[WS] Handled as A2UI message');
              }
            }
            break;
          case 0x8: // Close frame
            socket.end();
            return;
          case 0x9: { // Ping frame - respond with Pong
            const pongFrame = Buffer.alloc(2);
            pongFrame[0] = 0x8A; // Pong opcode with FIN bit
            pongFrame[1] = 0x00; // No payload
            socket.write(pongFrame);
            break;
          }
          case 0xA: // Pong frame - ignore
            break;
          default:
            // Ignore other frame types (binary, continuation)
            break;
        }
      }
    } catch (e) {
      // On parse error, drop the buffered data to avoid unbounded growth.
      pendingBuffer = Buffer.alloc(0);
    }
  });

  // Handle disconnect
  socket.on('close', () => {
    removeClientTracking(socket);
    console.log(`[WS] Client disconnected (${wsClients.size} remaining)`);
  });

  socket.on('error', () => {
    removeClientTracking(socket);
  });
}

/**
 * Parse WebSocket frame (simplified)
 * Returns { opcode, payload } or null
 */
export function parseWebSocketFrame(buffer: Buffer): { opcode: number; payload: string; frameLength: number } | null {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const opcode = firstByte & 0x0f; // Extract opcode (bits 0-3)

  // Opcode types:
  // 0x0 = continuation, 0x1 = text, 0x2 = binary
  // 0x8 = close, 0x9 = ping, 0xA = pong

  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask: Buffer | null = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const frameLength = offset + payloadLength;
  if (buffer.length < frameLength) return null;

  const payload = buffer.slice(offset, offset + payloadLength);

  if (isMasked && mask) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode, payload: payload.toString('utf8'), frameLength };
}

/**
 * Extract session ID from file path
 */
export function extractSessionIdFromPath(filePath: string): string | null {
  // Normalize path
  const normalized = filePath.replace(/\\/g, '/');

  // Look for session pattern: WFS-xxx, WRS-xxx, etc.
  const sessionMatch = normalized.match(/\/(W[A-Z]S-[^/]+)\//);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  // Look for .workflow/.sessions/xxx pattern
  const sessionsMatch = normalized.match(/\.workflow\/\.sessions\/([^/]+)/);
  if (sessionsMatch) {
    return sessionsMatch[1];
  }

  // Look for lite-plan/lite-fix pattern
  const liteMatch = normalized.match(/\.(lite-plan|lite-fix)\/([^/]+)/);
  if (liteMatch) {
    return liteMatch[2];
  }

  return null;
}

/**
 * Loop broadcast types (without timestamp - added automatically)
 * Throttling is handled universally in broadcastToClients
 */
export type LoopMessage =
  | Omit<LoopStateUpdateMessage, 'timestamp'>
  | Omit<LoopStepCompletedMessage, 'timestamp'>
  | Omit<LoopCompletedMessage, 'timestamp'>
  | Omit<LoopLogEntryMessage, 'timestamp'>;

/**
 * Broadcast loop update with automatic throttling
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastLoopUpdate(message: LoopMessage): void {
  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast loop log entry
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastLoopLog(loop_id: string, step_id: string, line: string): void {
  broadcastToClients({
    type: 'LOOP_LOG_ENTRY',
    loop_id,
    step_id,
    line,
    timestamp: new Date().toISOString()
  });
}

/**
 * Union type for Orchestrator messages (without timestamp - added automatically)
 * Throttling is handled universally in broadcastToClients
 */
export type OrchestratorMessage =
  | Omit<OrchestratorStateUpdateMessage, 'timestamp'>
  | Omit<OrchestratorNodeStartedMessage, 'timestamp'>
  | Omit<OrchestratorNodeCompletedMessage, 'timestamp'>
  | Omit<OrchestratorNodeFailedMessage, 'timestamp'>
  | Omit<OrchestratorLogMessage, 'timestamp'>;

/**
 * Broadcast orchestrator update with automatic throttling
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastOrchestratorUpdate(message: OrchestratorMessage): void {
  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast orchestrator log entry
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastOrchestratorLog(execId: string, log: Omit<ExecutionLog, 'timestamp'>): void {
  broadcastToClients({
    type: 'ORCHESTRATOR_LOG',
    execId,
    log: {
      ...log,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Coordinator WebSocket message types
 */
export type CoordinatorMessageType =
  | 'COORDINATOR_STATE_UPDATE'
  | 'COORDINATOR_COMMAND_STARTED'
  | 'COORDINATOR_COMMAND_COMPLETED'
  | 'COORDINATOR_COMMAND_FAILED'
  | 'COORDINATOR_LOG_ENTRY'
  | 'COORDINATOR_QUESTION_ASKED'
  | 'COORDINATOR_ANSWER_RECEIVED';

/**
 * Coordinator State Update - fired when coordinator execution status changes
 */
export interface CoordinatorStateUpdateMessage {
  type: 'COORDINATOR_STATE_UPDATE';
  executionId: string;
  status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentNodeId?: string;
  timestamp: string;
}

/**
 * Coordinator Command Started - fired when a command node begins execution
 */
export interface CoordinatorCommandStartedMessage {
  type: 'COORDINATOR_COMMAND_STARTED';
  executionId: string;
  nodeId: string;
  commandName: string;
  timestamp: string;
}

/**
 * Coordinator Command Completed - fired when a command node finishes successfully
 */
export interface CoordinatorCommandCompletedMessage {
  type: 'COORDINATOR_COMMAND_COMPLETED';
  executionId: string;
  nodeId: string;
  result?: unknown;
  timestamp: string;
}

/**
 * Coordinator Command Failed - fired when a command node encounters an error
 */
export interface CoordinatorCommandFailedMessage {
  type: 'COORDINATOR_COMMAND_FAILED';
  executionId: string;
  nodeId: string;
  error: string;
  timestamp: string;
}

/**
 * Coordinator Log Entry - fired for execution log entries
 */
export interface CoordinatorLogEntryMessage {
  type: 'COORDINATOR_LOG_ENTRY';
  executionId: string;
  log: {
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    message: string;
    nodeId?: string;
    source?: 'system' | 'node' | 'user';
    timestamp: string;
  };
  timestamp: string;
}

/**
 * Coordinator Question Asked - fired when coordinator needs user input
 */
export interface CoordinatorQuestionAskedMessage {
  type: 'COORDINATOR_QUESTION_ASKED';
  executionId: string;
  question: {
    id: string;
    nodeId: string;
    title: string;
    description?: string;
    type: 'text' | 'single' | 'multi' | 'yes_no';
    options?: string[];
    required: boolean;
  };
  timestamp: string;
}

/**
 * Coordinator Answer Received - fired when user submits an answer
 */
export interface CoordinatorAnswerReceivedMessage {
  type: 'COORDINATOR_ANSWER_RECEIVED';
  executionId: string;
  questionId: string;
  answer: string | string[];
  timestamp: string;
}

/**
 * Union type for Coordinator messages (without timestamp - added automatically)
 * Throttling is handled universally in broadcastToClients
 */
export type CoordinatorMessage =
  | Omit<CoordinatorStateUpdateMessage, 'timestamp'>
  | Omit<CoordinatorCommandStartedMessage, 'timestamp'>
  | Omit<CoordinatorCommandCompletedMessage, 'timestamp'>
  | Omit<CoordinatorCommandFailedMessage, 'timestamp'>
  | Omit<CoordinatorLogEntryMessage, 'timestamp'>
  | Omit<CoordinatorQuestionAskedMessage, 'timestamp'>
  | Omit<CoordinatorAnswerReceivedMessage, 'timestamp'>;

/**
 * Broadcast coordinator update with automatic throttling
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastCoordinatorUpdate(message: CoordinatorMessage): void {
  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast coordinator log entry
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastCoordinatorLog(
  executionId: string,
  log: {
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    message: string;
    nodeId?: string;
    source?: 'system' | 'node' | 'user';
  }
): void {
  broadcastToClients({
    type: 'COORDINATOR_LOG_ENTRY',
    executionId,
    log: {
      ...log,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}

// Re-export Queue WebSocket types from queue-types.ts
export type {
  QueueWSMessageType as QueueMessageType,
  QueueSchedulerStateUpdateMessage,
  QueueItemAddedMessage,
  QueueItemUpdatedMessage,
  QueueItemRemovedMessage,
  QueueSchedulerConfigUpdatedMessage,
};

/**
 * Union type for Queue messages (without timestamp - added automatically)
 * Throttling is handled universally in broadcastToClients
 */
export type QueueMessage =
  | Omit<QueueSchedulerStateUpdateMessage, 'timestamp'>
  | Omit<QueueItemAddedMessage, 'timestamp'>
  | Omit<QueueItemUpdatedMessage, 'timestamp'>
  | Omit<QueueItemRemovedMessage, 'timestamp'>
  | Omit<QueueSchedulerConfigUpdatedMessage, 'timestamp'>;

/**
 * Broadcast queue update with automatic throttling
 * Note: Throttling is now handled universally in broadcastToClients
 */
export function broadcastQueueUpdate(message: QueueMessage): void {
  broadcastToClients({
    ...message,
    timestamp: new Date().toISOString()
  });
}
