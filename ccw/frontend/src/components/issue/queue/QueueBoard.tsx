// ========================================
// QueueBoard
// ========================================
// Kanban-style view of queue execution groups with DnD reordering/moving.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DropResult } from '@hello-pangea/dnd';
import { useIntl } from 'react-intl';
import { LayoutGrid } from 'lucide-react';
import { KanbanBoard, type KanbanColumn, type KanbanItem } from '@/components/shared/KanbanBoard';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useQueueMutations } from '@/hooks';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import type { IssueQueue, QueueItem } from '@/lib/api';

type QueueBoardItem = QueueItem & KanbanItem;

function groupSortKey(groupId: string): [number, string] {
  const n = parseInt(groupId.match(/\d+/)?.[0] || '999');
  return [Number.isFinite(n) ? n : 999, groupId];
}

function buildColumns(queue: IssueQueue): KanbanColumn<QueueBoardItem>[] {
  const entries = Object.entries(queue.grouped_items || {});
  entries.sort(([a], [b]) => {
    const [an, aid] = groupSortKey(a);
    const [bn, bid] = groupSortKey(b);
    if (an !== bn) return an - bn;
    return aid.localeCompare(bid);
  });

  return entries.map(([groupId, items]) => {
    const sorted = [...(items || [])].sort((a, b) => (a.execution_order || 0) - (b.execution_order || 0));
    const mapped = sorted.map((it) => ({
      ...it,
      id: it.item_id,
      title: `${it.issue_id} · ${it.solution_id}`,
      status: it.status,
    }));
    return {
      id: groupId,
      title: groupId,
      items: mapped,
      icon: <LayoutGrid className="w-4 h-4" />,
    };
  });
}

function applyDrag(columns: KanbanColumn<QueueBoardItem>[], result: DropResult): KanbanColumn<QueueBoardItem>[] {
  if (!result.destination) return columns;
  const { source, destination, draggableId } = result;

  const startCol = columns.find(c => c.id === source.droppableId);
  const endCol = columns.find(c => c.id === destination.droppableId);
  if (!startCol || !endCol) return columns;

  const itemToMove = startCol.items.find(item => item.id === draggableId);
  if (!itemToMove) return columns;

  // 如果在同一列中移动
  if (startCol.id === endCol.id) {
    const items = [...startCol.items];
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    return columns.map(c => c.id === startCol.id ? { ...c, items } : c);
  }

  // 如果跨列移动
  const newStartItems = startCol.items.filter(item => item.id !== draggableId);
  const newEndItems = [
    ...endCol.items.slice(0, destination.index),
    itemToMove,
    ...endCol.items.slice(destination.index),
  ];

  return columns.map(c => {
    if (c.id === startCol.id) return { ...c, items: newStartItems };
    if (c.id === endCol.id) return { ...c, items: newEndItems };
    return c;
  });
}

export function QueueBoard({
  queue,
  onItemClick,
  className,
}: {
  queue: IssueQueue;
  onItemClick?: (item: QueueItem) => void;
  className?: string;
}) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { reorderQueueGroup, moveQueueItem, isReordering, isMoving } = useQueueMutations();

  const baseColumns = useMemo(() => buildColumns(queue), [queue]);
  const [columns, setColumns] = useState<KanbanColumn<QueueBoardItem>[]>(baseColumns);

  useEffect(() => {
    setColumns(baseColumns);
  }, [baseColumns]);

  const handleDragEnd = useCallback(
    async (result: DropResult, sourceColumn: string, destColumn: string) => {
      if (!projectPath) return;
      if (!result.destination) return;
      if (sourceColumn === destColumn && result.source.index === result.destination.index) return;

      try {
        const nextColumns = applyDrag(columns, result);
        setColumns(nextColumns);

        const itemId = result.draggableId;

        if (sourceColumn === destColumn) {
          const column = nextColumns.find((c) => c.id === sourceColumn);
          const nextOrder = (column?.items ?? []).map((i) => i.item_id);
          await reorderQueueGroup(sourceColumn, nextOrder);
        } else {
          await moveQueueItem(itemId, destColumn, result.destination.index);
        }
      } catch (e) {
        // Revert by resetting to server-derived columns
        setColumns(baseColumns);
      }
    },
    [baseColumns, columns, moveQueueItem, projectPath, reorderQueueGroup]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="gap-1">
          {formatMessage({ id: 'issues.queue.stats.executionGroups' })}
        </Badge>
        {(isReordering || isMoving) && (
          <span>
            {formatMessage({ id: 'common.status.running' })}
          </span>
        )}
      </div>

      <KanbanBoard<QueueBoardItem>
        columns={columns}
        onDragEnd={handleDragEnd}
        onItemClick={(item) => onItemClick?.(item as unknown as QueueItem)}
        emptyColumnMessage={formatMessage({ id: 'issues.queue.empty' })}
        renderItem={(item, provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onItemClick?.(item as unknown as QueueItem)}
            className={cn(
              'p-3 bg-card border border-border rounded-lg shadow-sm cursor-pointer',
              'hover:shadow-md hover:border-primary/50 transition-all',
              item.status === 'blocked' && 'border-destructive/50 bg-destructive/5',
              item.status === 'failed' && 'border-destructive/50 bg-destructive/5',
              item.status === 'executing' && 'border-primary/40'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono text-muted-foreground">{item.item_id}</div>
                <div className="text-sm font-medium text-foreground truncate">
                  {item.issue_id} · {item.solution_id}
                </div>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {formatMessage({ id: `issues.queue.status.${item.status}` })}
              </Badge>
            </div>
            {item.depends_on?.length ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {formatMessage({ id: 'issues.solution.overview.dependencies' })}: {item.depends_on.length}
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

export default QueueBoard;
