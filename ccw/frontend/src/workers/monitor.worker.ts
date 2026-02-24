// ========================================
// Monitor Web Worker
// ========================================
// Off-main-thread rule-based output analysis for terminal sessions.
// MVP rules:
//   1. Keyword matching: /error|failed|exception/i -> critical alert
//   2. Stall detection: no output for > 60s -> warning alert
//
// Message protocol:
//   IN:  { type: 'output', sessionId: string, text: string }
//   IN:  { type: 'reset', sessionId: string }         -- reset session tracking
//   OUT: { type: 'alert', sessionId: string, severity: string, message: string }

// ========== Types ==========

interface OutputMessage {
  type: 'output';
  sessionId: string;
  text: string;
}

interface ResetMessage {
  type: 'reset';
  sessionId: string;
}

type IncomingMessage = OutputMessage | ResetMessage;

interface AlertMessage {
  type: 'alert';
  sessionId: string;
  severity: 'critical' | 'warning';
  message: string;
}

interface KeywordRule {
  pattern: RegExp;
  severity: 'critical' | 'warning';
  label: string;
}

interface SessionState {
  lastActivity: number;
  alertCount: number;
  /** Track stall alert to avoid repeated notifications per stall period */
  stallAlerted: boolean;
}

// ========== Rules ==========

const KEYWORD_RULES: KeywordRule[] = [
  {
    pattern: /error|failed|exception/i,
    severity: 'critical',
    label: 'error keyword',
  },
];

/** Stall threshold in milliseconds (60 seconds) */
const STALL_THRESHOLD_MS = 60_000;

/** Stall check interval in milliseconds (15 seconds) */
const STALL_CHECK_INTERVAL_MS = 15_000;

// ========== State ==========

const sessions = new Map<string, SessionState>();

// ========== Helpers ==========

function getOrCreateSession(sessionId: string): SessionState {
  let state = sessions.get(sessionId);
  if (!state) {
    state = {
      lastActivity: Date.now(),
      alertCount: 0,
      stallAlerted: false,
    };
    sessions.set(sessionId, state);
  }
  return state;
}

function postAlert(alert: AlertMessage): void {
  self.postMessage(alert);
}

// ========== Output Processing ==========

function processOutput(sessionId: string, text: string): void {
  const state = getOrCreateSession(sessionId);
  state.lastActivity = Date.now();
  // Reset stall alert flag on new output
  state.stallAlerted = false;

  // Run keyword rules against text
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      state.alertCount++;
      postAlert({
        type: 'alert',
        sessionId,
        severity: rule.severity,
        message: `Detected ${rule.label} in output`,
      });
      // Only report first matching rule per chunk to avoid alert flood
      break;
    }
  }
}

// ========== Stall Detection ==========

function checkStalls(): void {
  const now = Date.now();
  sessions.forEach((state, sessionId) => {
    if (state.stallAlerted) return;
    const elapsed = now - state.lastActivity;
    if (elapsed > STALL_THRESHOLD_MS) {
      state.stallAlerted = true;
      state.alertCount++;
      const seconds = Math.floor(elapsed / 1000);
      postAlert({
        type: 'alert',
        sessionId,
        severity: 'warning',
        message: `Session stalled: no output for ${seconds}s`,
      });
    }
  });
}

// ========== Message Handler ==========

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'output':
      processOutput(msg.sessionId, msg.text);
      break;
    case 'reset':
      sessions.delete(msg.sessionId);
      break;
  }
};

// ========== Periodic Stall Check ==========

const _stallInterval = setInterval(checkStalls, STALL_CHECK_INTERVAL_MS);

// Cleanup on worker termination (best-effort)
self.addEventListener('close', () => {
  clearInterval(_stallInterval);
});
