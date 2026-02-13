// ========================================
// QueueActions Component
// ========================================
// Queue operations with direct action buttons (no dropdown menu)

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Play, Pause, Trash2, Merge, GitBranch, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';
import type { IssueQueue, QueueItem } from '@/lib/api';

// ========== Types ==========

export interface QueueActionsProps {
  queue: IssueQueue;
  queueId?: string;
  isActive?: boolean;
  onActivate?: (queueId: string) => void;
  onDeactivate?: () => void;
  onDelete?: (queueId: string) => void;
  onMerge?: (sourceId: string, targetId: string) => void;
  onSplit?: (sourceQueueId: string, itemIds: string[]) => void;
  isActivating?: boolean;
  isDeactivating?: boolean;
  isDeleting?: boolean;
  isMerging?: boolean;
  isSplitting?: boolean;
}

// ========== Component ==========

export function QueueActions({
  queue,
  queueId: queueIdProp,
  isActive = false,
  onActivate,
  onDeactivate,
  onDelete,
  onMerge,
  onSplit,
  isActivating = false,
  isDeactivating = false,
  isDeleting = false,
  isMerging = false,
  isSplitting = false,
}: QueueActionsProps) {
  const { formatMessage } = useIntl();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const queueId = queueIdProp;

  // Get all items from grouped_items for split dialog
  const allItems: QueueItem[] = Object.values(queue.grouped_items || {}).flat();

  const handleDelete = () => {
    if (!queueId) return;
    onDelete?.(queueId);
    setIsDeleteOpen(false);
  };

  const handleMerge = () => {
    if (mergeTargetId.trim()) {
      if (!queueId) return;
      onMerge?.(queueId, mergeTargetId.trim());
      setIsMergeOpen(false);
      setMergeTargetId('');
    }
  };

  const handleSplit = () => {
    if (selectedItemIds.length > 0 && selectedItemIds.length < allItems.length) {
      if (!queueId) return;
      onSplit?.(queueId, selectedItemIds);
      setIsSplitOpen(false);
      setSelectedItemIds([]);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAll = () => {
    setSelectedItemIds(allItems.map(item => item.item_id));
  };

  const clearAll = () => {
    setSelectedItemIds([]);
  };

  // Calculate item count
  const totalItems = (queue.tasks?.length || 0) + (queue.solutions?.length || 0);
  const canSplit = totalItems > 1;

  return (
    <>
      {/* Direct action buttons */}
      <div className="flex items-center gap-1">
        {/* Activate/Deactivate button */}
        {!isActive && onActivate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (queueId) onActivate(queueId);
            }}
            disabled={isActivating || !queueId}
            title={formatMessage({ id: 'issues.queue.actions.activate' })}
          >
            {isActivating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 text-success" />
            )}
          </Button>
        )}
        {isActive && onDeactivate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onDeactivate()}
            disabled={isDeactivating}
            title={formatMessage({ id: 'issues.queue.actions.deactivate' })}
          >
            {isDeactivating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Pause className="w-4 h-4 text-warning" />
            )}
          </Button>
        )}

        {/* Merge button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsMergeOpen(true)}
          disabled={isMerging || !queueId}
          title={formatMessage({ id: 'issues.queue.actions.merge' })}
        >
          {isMerging ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Merge className="w-4 h-4 text-info" />
          )}
        </Button>

        {/* Split button - only show if more than 1 item */}
        {canSplit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsSplitOpen(true)}
            disabled={isSplitting || !queueId}
            title={formatMessage({ id: 'issues.queue.actions.split' })}
          >
            {isSplitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GitBranch className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        )}

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsDeleteOpen(true)}
          disabled={isDeleting || !queueId}
          title={formatMessage({ id: 'issues.queue.actions.delete' })}
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin text-destructive" />
          ) : (
            <Trash2 className="w-4 h-4 text-destructive" />
          )}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'issues.queue.deleteDialog.title' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({ id: 'issues.queue.deleteDialog.description' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {formatMessage({ id: 'common.actions.cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'common.actions.deleting' })}
                </>
              ) : (
                formatMessage({ id: 'issues.queue.actions.delete' })
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formatMessage({ id: 'issues.queue.mergeDialog.title' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="merge-target" className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'issues.queue.mergeDialog.targetQueueLabel' })}
              </label>
              <Input
                id="merge-target"
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                placeholder={formatMessage({ id: 'issues.queue.mergeDialog.targetQueuePlaceholder' })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMergeOpen(false);
                setMergeTargetId('');
              }}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeTargetId.trim() || isMerging}
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'common.actions.merging' })}
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'issues.queue.actions.merge' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Dialog */}
      <Dialog open={isSplitOpen} onOpenChange={setIsSplitOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {formatMessage({ id: 'issues.queue.splitDialog.title' })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col py-4">
            {/* Selection info */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <span className="text-sm text-muted-foreground">
                {formatMessage({ id: 'issues.queue.splitDialog.selected' }, { count: selectedItemIds.length, total: allItems.length })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {formatMessage({ id: 'issues.queue.splitDialog.selectAll' })}
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  {formatMessage({ id: 'issues.queue.splitDialog.clearAll' })}
                </Button>
              </div>
            </div>

            {/* Items list with checkboxes */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {allItems.map((item) => {
                const isSelected = selectedItemIds.includes(item.item_id);
                return (
                  <div
                    key={item.item_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md border transition-colors cursor-pointer",
                      isSelected ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted/50"
                    )}
                    onClick={() => toggleItemSelection(item.item_id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleItemSelection(item.item_id)}
                    />
                    <span className="font-mono text-xs flex-1 truncate">
                      {item.item_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMessage({ id: `issues.queue.status.${item.status}` })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Validation message */}
            {selectedItemIds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                {formatMessage({ id: 'issues.queue.splitDialog.noSelection' })}
              </p>
            )}
            {selectedItemIds.length >= allItems.length && (
              <p className="text-sm text-destructive text-center py-2">
                {formatMessage({ id: 'issues.queue.splitDialog.cannotSplitAll' })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSplitOpen(false);
                setSelectedItemIds([]);
              }}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              onClick={handleSplit}
              disabled={selectedItemIds.length === 0 || selectedItemIds.length >= allItems.length || isSplitting}
            >
              {isSplitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'common.actions.splitting' })}
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'issues.queue.actions.split' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QueueActions;
