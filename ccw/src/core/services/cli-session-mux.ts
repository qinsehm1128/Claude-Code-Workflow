/**
 * CliSessionMux
 *
 * A tiny indirection layer used by FlowExecutor (and potentially others) to
 * route commands to existing PTY sessions in a testable way.
 *
 * Why this exists:
 * - ESM module namespace exports are immutable, which makes it hard to mock
 *   named exports in node:test without special loaders.
 * - Exporting a mutable object lets tests override behavior by swapping
 *   functions on the object.
 */

import type { CliSessionManager } from './cli-session-manager.js';
import { findCliSessionManager, getCliSessionManager } from './cli-session-manager.js';

export const cliSessionMux: {
  findCliSessionManager: (sessionKey: string) => CliSessionManager | null;
  getCliSessionManager: (projectRoot?: string) => CliSessionManager;
} = {
  findCliSessionManager,
  getCliSessionManager,
};

