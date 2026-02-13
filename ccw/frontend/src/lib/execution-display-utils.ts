// ========================================
// Execution Display Utilities
// ========================================
// Shared helpers for rendering queue execution status across
// ExecutionPanel and QueueExecutionListView components.

import type { ReactElement } from 'react';
import { createElement } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import type { QueueExecutionStatus } from '@/stores/queueExecutionStore';

/**
 * Map execution status to Badge variant.
 */
export function statusBadgeVariant(status: QueueExecutionStatus): 'info' | 'success' | 'destructive' | 'secondary' {
  switch (status) {
    case 'running':
      return 'info';
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'pending':
    default:
      return 'secondary';
  }
}

/**
 * Map execution status to a small icon element.
 */
export function statusIcon(status: QueueExecutionStatus): ReactElement {
  const base = 'w-3.5 h-3.5';
  switch (status) {
    case 'running':
      return createElement(Loader2, { className: `${base} animate-spin text-info` });
    case 'completed':
      return createElement(CheckCircle, { className: `${base} text-success` });
    case 'failed':
      return createElement(XCircle, { className: `${base} text-destructive` });
    case 'pending':
    default:
      return createElement(Clock, { className: `${base} text-muted-foreground` });
  }
}

/**
 * Format an ISO date string as a human-readable relative time.
 */
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
