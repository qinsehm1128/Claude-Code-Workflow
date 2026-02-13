// ========================================
// QueueCard Component Tests
// ========================================
// Tests for the queue card component with i18n

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import { QueueCard } from './QueueCard';
import type { IssueQueue, QueueItem } from '@/lib/api';

describe('QueueCard', () => {
  const mockQueueItems: Record<string, QueueItem[]> = {
    'group-1': [
      { item_id: 'issue-1', issue_id: 'issue-1', solution_id: 'sol-1', status: 'pending', execution_order: 1, execution_group: 'group-1', depends_on: [], semantic_priority: 1 },
      { item_id: 'solution-1', issue_id: 'issue-1', solution_id: 'sol-1', status: 'ready', execution_order: 2, execution_group: 'group-1', depends_on: [], semantic_priority: 1 },
    ],
  };

  const mockQueue: IssueQueue = {
    tasks: [
      { item_id: 'task1', issue_id: 'issue-1', solution_id: 'sol-1', status: 'pending', execution_order: 1, execution_group: 'group-1', depends_on: [], semantic_priority: 1 },
      { item_id: 'task2', issue_id: 'issue-1', solution_id: 'sol-1', status: 'pending', execution_order: 2, execution_group: 'group-1', depends_on: [], semantic_priority: 1 },
    ],
    solutions: [
      { item_id: 'solution1', issue_id: 'issue-1', solution_id: 'sol-1', status: 'pending', execution_order: 1, execution_group: 'group-1', depends_on: [], semantic_priority: 1 },
    ],
    conflicts: [],
    execution_groups: ['group-1'],
    grouped_items: mockQueueItems,
  };

  const defaultProps = {
    queue: mockQueue,
    isActive: false,
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    onDelete: vi.fn(),
    onMerge: vi.fn(),
    isActivating: false,
    isDeactivating: false,
    isDeleting: false,
    isMerging: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with en locale', () => {
    it('should render queue name', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getByText(/Queue/i)).toBeInTheDocument();
    });

    it('should render stats', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getAllByText(/Items/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/3/i)).toBeInTheDocument(); // total items: 2 tasks + 1 solution
      expect(screen.getAllByText(/Groups/i).length).toBeGreaterThan(0);
      // Note: "1" appears multiple times, so we just check the total items count (3) exists
    });

    it('should render execution groups', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'en' });
      expect(screen.getAllByText(/Execution/i).length).toBeGreaterThan(0);
    });

    it('should show active badge when isActive', () => {
      render(<QueueCard {...defaultProps} isActive={true} />, { locale: 'en' });
      expect(screen.getByText(/Active/i)).toBeInTheDocument();
    });
  });

  describe('with zh locale', () => {
    it('should render translated queue name', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getByText(/队列/i)).toBeInTheDocument();
    });

    it('should render translated stats', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getAllByText(/项目/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/执行组/i).length).toBeGreaterThan(0);
    });

    it('should render translated execution groups', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'zh' });
      expect(screen.getAllByText(/执行/i).length).toBeGreaterThan(0);
    });

    it('should show translated active badge when isActive', () => {
      render(<QueueCard {...defaultProps} isActive={true} />, { locale: 'zh' });
      expect(screen.getByText(/活跃/i)).toBeInTheDocument();
    });
  });

  describe('conflicts warning', () => {
    it('should show conflicts warning when conflicts exist', () => {
      const queueWithConflicts: IssueQueue = {
        ...mockQueue,
        conflicts: ['conflict1', 'conflict2'],
      };

      render(
        <QueueCard
          {...defaultProps}
          queue={queueWithConflicts}
        />,
        { locale: 'en' }
      );

      expect(screen.getByText(/2 conflicts/i)).toBeInTheDocument();
    });

    it('should show translated conflicts warning in Chinese', () => {
      const queueWithConflicts: IssueQueue = {
        ...mockQueue,
        conflicts: ['conflict1'],
      };

      render(
        <QueueCard
          {...defaultProps}
          queue={queueWithConflicts}
        />,
        { locale: 'zh' }
      );

      expect(screen.getByText(/1 冲突/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no items', () => {
      const emptyQueue: IssueQueue = {
        tasks: [],
        solutions: [],
        conflicts: [],
        execution_groups: [],
        grouped_items: {} as Record<string, QueueItem[]>,
      };

      render(
        <QueueCard
          {...defaultProps}
          queue={emptyQueue}
        />,
        { locale: 'en' }
      );

      expect(screen.getByText(/No items in queue/i)).toBeInTheDocument();
    });

    it('should show translated empty state in Chinese', () => {
      const emptyQueue: IssueQueue = {
        tasks: [],
        solutions: [],
        conflicts: [],
        execution_groups: [],
        grouped_items: {} as Record<string, QueueItem[]>,
      };

      render(
        <QueueCard
          {...defaultProps}
          queue={emptyQueue}
        />,
        { locale: 'zh' }
      );

      expect(screen.getByText(/队列中无项目/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper card structure', () => {
      const { container } = render(<QueueCard {...defaultProps} />, { locale: 'en' });
      const card = container.querySelector('[class*="rounded-lg"]');
      expect(card).toBeInTheDocument();
    });

    it('should have accessible title', () => {
      render(<QueueCard {...defaultProps} />, { locale: 'en' });
      const title = screen.getByText(/Queue/i);
      expect(title).toBeInTheDocument();
    });
  });

  describe('visual states', () => {
    it('should apply active styles when isActive', () => {
      const { container } = render(
        <QueueCard {...defaultProps} isActive={true} />,
        { locale: 'en' }
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-primary');
    });

    it('should not apply active styles when not active', () => {
      const { container } = render(
        <QueueCard {...defaultProps} isActive={false} />,
        { locale: 'en' }
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain('border-primary');
    });
  });
});
