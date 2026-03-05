/**
 * Queue Scheduler Routes Module
 *
 * HTTP API endpoints for the Queue Scheduler Service.
 * Delegates all business logic to QueueSchedulerService.
 *
 * API Endpoints:
 * - POST   /api/queue/execute            - Submit items to the scheduler and start
 * - GET    /api/queue/scheduler/state     - Get full scheduler state
 * - POST   /api/queue/scheduler/start     - Start scheduling loop with items
 * - POST   /api/queue/scheduler/pause     - Pause scheduling
 * - POST   /api/queue/scheduler/stop      - Graceful stop
 * - POST   /api/queue/scheduler/config    - Update scheduler configuration
 */

import type { RouteContext } from './types.js';
import type { QueueSchedulerService } from '../services/queue-scheduler-service.js';
import type { QueueItem, QueueSchedulerConfig } from '../../types/queue-types.js';

/**
 * Handle queue scheduler routes
 * @returns true if route was handled, false otherwise
 */
export async function handleQueueSchedulerRoutes(
  ctx: RouteContext,
  schedulerService: QueueSchedulerService,
): Promise<boolean> {
  const { pathname, req, res, handlePostRequest } = ctx;

  // POST /api/queue/execute - Submit items and start the scheduler
  if (pathname === '/api/queue/execute' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { items } = body as { items?: QueueItem[] };

      if (!items || !Array.isArray(items) || items.length === 0) {
        return { error: 'items array is required and must not be empty', status: 400 };
      }

      try {
        const state = schedulerService.getState();

        // If idle, start with items; otherwise add items to running scheduler
        if (state.status === 'idle') {
          schedulerService.start(items);
        } else if (state.status === 'running' || state.status === 'paused') {
          for (const item of items) {
            schedulerService.addItem(item);
          }
        } else if (state.status === 'completed' || state.status === 'failed') {
          // Auto-reset when scheduler is in terminal state and start fresh
          schedulerService.reset();
          schedulerService.start(items);
        } else {
          return {
            error: `Cannot add items when scheduler is in '${state.status}' state`,
            status: 409,
          };
        }

        return {
          success: true,
          state: schedulerService.getState(),
        };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // GET /api/queue/scheduler/state - Return full scheduler state
  if (pathname === '/api/queue/scheduler/state' && req.method === 'GET') {
    try {
      const state = schedulerService.getState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // POST /api/queue/scheduler/start - Start scheduling loop with items
  if (pathname === '/api/queue/scheduler/start' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { items } = body as { items?: QueueItem[] };

      if (!items || !Array.isArray(items) || items.length === 0) {
        return { error: 'items array is required and must not be empty', status: 400 };
      }

      try {
        schedulerService.start(items);
        return {
          success: true,
          state: schedulerService.getState(),
        };
      } catch (err) {
        return { error: (err as Error).message, status: 409 };
      }
    });
    return true;
  }

  // POST /api/queue/scheduler/pause - Pause scheduling
  if (pathname === '/api/queue/scheduler/pause' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        schedulerService.pause();
        return {
          success: true,
          state: schedulerService.getState(),
        };
      } catch (err) {
        return { error: (err as Error).message, status: 409 };
      }
    });
    return true;
  }

  // POST /api/queue/scheduler/stop - Graceful stop
  if (pathname === '/api/queue/scheduler/stop' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        await schedulerService.stop();
        return {
          success: true,
          state: schedulerService.getState(),
        };
      } catch (err) {
        return { error: (err as Error).message, status: 409 };
      }
    });
    return true;
  }

  // POST /api/queue/scheduler/reset - Reset scheduler to idle state
  if (pathname === '/api/queue/scheduler/reset' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      try {
        schedulerService.reset();
        return {
          success: true,
          state: schedulerService.getState(),
        };
      } catch (err) {
        return { error: (err as Error).message, status: 409 };
      }
    });
    return true;
  }

  // POST /api/queue/scheduler/config - Update scheduler configuration
  if (pathname === '/api/queue/scheduler/config' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const config = body as Partial<QueueSchedulerConfig>;

      if (!config || typeof config !== 'object') {
        return { error: 'Configuration object is required', status: 400 };
      }

      try {
        schedulerService.updateConfig(config);
        return {
          success: true,
          config: schedulerService.getState().config,
        };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
