// ========================================
// CLI Session Store (PTY-backed terminals)
// ========================================
// Zustand store for managing PTY session metadata and output chunks.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface CliSessionMeta {
  sessionKey: string;
  shellKind: string;
  workingDir: string;
  tool?: string;
  model?: string;
  resumeKey?: string;
  createdAt: string;
  updatedAt: string;
  isPaused: boolean;
  /** When set, this session is a native CLI interactive process. */
  cliTool?: string;
}

export interface CliSessionOutputChunk {
  data: string;
  timestamp: number;
}

interface CliSessionState {
  sessions: Record<string, CliSessionMeta>;
  outputChunks: Record<string, CliSessionOutputChunk[]>;
  outputBytes: Record<string, number>;

  setSessions: (sessions: CliSessionMeta[]) => void;
  upsertSession: (session: CliSessionMeta) => void;
  removeSession: (sessionKey: string) => void;
  updateSessionPausedState: (sessionKey: string, isPaused: boolean) => void;

  setBuffer: (sessionKey: string, buffer: string) => void;
  appendOutput: (sessionKey: string, data: string, timestamp?: number) => void;
  clearOutput: (sessionKey: string) => void;
}

const MAX_OUTPUT_BYTES_PER_SESSION = 2 * 1024 * 1024; // 2MB

const utf8Encoder = new TextEncoder();
function utf8ByteLength(value: string): number {
  // Browser-safe alternative to Buffer.byteLength
  return utf8Encoder.encode(value).length;
}

export const useCliSessionStore = create<CliSessionState>()(
  devtools(
    (set, get) => ({
      sessions: {},
      outputChunks: {},
      outputBytes: {},

      setSessions: (sessions) =>
        set((state) => {
          const nextSessions: Record<string, CliSessionMeta> = {};
          for (const session of sessions) {
            nextSessions[session.sessionKey] = session;
          }

          const keepKeys = new Set(Object.keys(nextSessions));
          const nextChunks = { ...state.outputChunks };
          const nextBytes = { ...state.outputBytes };
          for (const key of Object.keys(nextChunks)) {
            if (!keepKeys.has(key)) delete nextChunks[key];
          }
          for (const key of Object.keys(nextBytes)) {
            if (!keepKeys.has(key)) delete nextBytes[key];
          }

          return { sessions: nextSessions, outputChunks: nextChunks, outputBytes: nextBytes };
        }),

      upsertSession: (session) =>
        set((state) => ({
          sessions: { ...state.sessions, [session.sessionKey]: session },
        })),

      removeSession: (sessionKey) =>
        set((state) => {
          const nextSessions = { ...state.sessions };
          const nextChunks = { ...state.outputChunks };
          const nextBytes = { ...state.outputBytes };
          delete nextSessions[sessionKey];
          delete nextChunks[sessionKey];
          delete nextBytes[sessionKey];
          return { sessions: nextSessions, outputChunks: nextChunks, outputBytes: nextBytes };
        }),

      updateSessionPausedState: (sessionKey, isPaused) =>
        set((state) => {
          const session = state.sessions[sessionKey];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionKey]: { ...session, isPaused, updatedAt: new Date().toISOString() },
            },
          };
        }),

      setBuffer: (sessionKey, buffer) =>
        set((state) => ({
          outputChunks: {
            ...state.outputChunks,
            [sessionKey]: buffer ? [{ data: buffer, timestamp: Date.now() }] : [],
          },
          outputBytes: {
            ...state.outputBytes,
            [sessionKey]: buffer ? utf8ByteLength(buffer) : 0,
          },
        })),

      appendOutput: (sessionKey, data, timestamp = Date.now()) => {
        if (!data) return;
        const chunkBytes = utf8ByteLength(data);
        const { outputChunks, outputBytes } = get();
        const existingChunks = outputChunks[sessionKey] ?? [];
        const existingBytes = outputBytes[sessionKey] ?? 0;

        const nextChunks = [...existingChunks, { data, timestamp }];
        let nextBytes = existingBytes + chunkBytes;

        // Ring-buffer by bytes
        while (nextBytes > MAX_OUTPUT_BYTES_PER_SESSION && nextChunks.length > 0) {
          const removed = nextChunks.shift();
          if (removed) nextBytes -= utf8ByteLength(removed.data);
        }

        set((state) => ({
          outputChunks: { ...state.outputChunks, [sessionKey]: nextChunks },
          outputBytes: { ...state.outputBytes, [sessionKey]: Math.max(0, nextBytes) },
        }));
      },

      clearOutput: (sessionKey) =>
        set((state) => ({
          outputChunks: { ...state.outputChunks, [sessionKey]: [] },
          outputBytes: { ...state.outputBytes, [sessionKey]: 0 },
        })),
    }),
    { name: 'cliSessionStore' }
  )
);
