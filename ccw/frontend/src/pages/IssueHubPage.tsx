// ========================================
// Issue Hub Page
// ========================================
// Unified page for issues, queue, and discovery with tab navigation

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Plus,
  RefreshCw,
  Github,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { IssueHubHeader } from '@/components/issue/hub/IssueHubHeader';
import { IssueHubTabs, type IssueTab } from '@/components/issue/hub/IssueHubTabs';

const VALID_TABS: IssueTab[] = ['issues', 'board', 'queue', 'discovery'];
import { IssuesPanel } from '@/components/issue/hub/IssuesPanel';
import { IssueBoardPanel } from '@/components/issue/hub/IssueBoardPanel';
import { QueuePanel } from '@/components/issue/hub/QueuePanel';
import { DiscoveryPanel } from '@/components/issue/hub/DiscoveryPanel';
// ExecutionPanel hidden - import { ExecutionPanel } from '@/components/issue/hub/ExecutionPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { useIssues, useIssueMutations, useIssueQueue } from '@/hooks';
import { pullIssuesFromGitHub, uploadAttachments } from '@/lib/api';
import type { Issue } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';

// Issue types
type IssueType = 'bug' | 'feature' | 'improvement' | 'other';

const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; description: string; color: string }> = {
  bug: { label: 'Bug', description: '功能异常或错误', color: 'bg-red-500' },
  feature: { label: 'Feature', description: '新功能需求', color: 'bg-green-500' },
  improvement: { label: 'Improvement', description: '现有功能改进', color: 'bg-blue-500' },
  other: { label: 'Other', description: '其他类型', color: 'bg-gray-500' },
};

function NewIssueDialog({ open, onOpenChange, onSubmit, isCreating }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; context?: string; priority?: Issue['priority']; type?: IssueType; attachments?: File[] }) => void;
  isCreating: boolean;
}) {
  const { formatMessage } = useIntl();
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [priority, setPriority] = useState<Issue['priority']>('medium');
  const [type, setType] = useState<IssueType>('other');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['image/', 'text/', 'application/pdf', '.md', '.txt', '.json'];
      return validTypes.some(t => file.type.includes(t) || file.name.endsWith(t));
    });
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit({ 
        title: title.trim(), 
        context: context.trim() || undefined, 
        priority, 
        type,
        attachments: attachments.length > 0 ? attachments : undefined 
      });
      // Reset
      setTitle('');
      setContext('');
      setPriority('medium');
      setType('other');
      setAttachments([]);
      onOpenChange(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'issues.createDialog.title' })}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* 标题 */}
          <div>
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'issues.createDialog.labels.title' })}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={formatMessage({ id: 'issues.createDialog.placeholders.title' })}
              className="mt-1.5"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">{title.length}/200</p>
          </div>

          {/* 描述 */}
          <div>
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'issues.createDialog.labels.context' })}
            </Label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={formatMessage({ id: 'issues.createDialog.placeholders.context' })}
              className="mt-1.5 w-full min-h-[120px] p-3 bg-background border border-input rounded-md text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground mt-1">{context.length}/10000</p>
          </div>

          {/* 类型选择 */}
          <div>
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'issues.createDialog.labels.type', defaultMessage: '类型' })}
            </Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {(Object.keys(ISSUE_TYPE_CONFIG) as IssueType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'px-3 py-2 rounded-md border text-sm transition-all',
                    type === t
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full', ISSUE_TYPE_CONFIG[t].color)} />
                    <span>{ISSUE_TYPE_CONFIG[t].label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 优先级 */}
          <div>
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'issues.createDialog.labels.priority' })}
            </Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Issue['priority'])}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{formatMessage({ id: 'issues.priority.low' })}</SelectItem>
                <SelectItem value="medium">{formatMessage({ id: 'issues.priority.medium' })}</SelectItem>
                <SelectItem value="high">{formatMessage({ id: 'issues.priority.high' })}</SelectItem>
                <SelectItem value="critical">{formatMessage({ id: 'issues.priority.critical' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 文件/图片上传 */}
          <div>
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'issues.createDialog.labels.attachments', defaultMessage: '附件' })}
            </Label>
            <div
              className={cn(
                'mt-1.5 border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer',
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'image/*,.md,.txt,.json,.pdf';
                input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
                input.click();
              }}
            >
              <div className="flex flex-col items-center justify-center text-muted-foreground py-2">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">拖拽文件到此处，或点击上传</p>
                <p className="text-xs mt-1">支持图片、Markdown、文本、PDF</p>
              </div>
            </div>

            {/* 已上传文件列表 */}
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={file.name}
                          className="w-8 h-8 object-cover rounded"
                        />
                      ) : (
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)}KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeAttachment(index); }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage({ id: 'issues.createDialog.buttons.cancel' })}
            </Button>
            <Button type="submit" disabled={isCreating || !title.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'issues.createDialog.buttons.creating' })}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'issues.createDialog.buttons.create' })}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function IssueHubPage() {
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as IssueTab;
  const currentTab = VALID_TABS.includes(rawTab) ? rawTab : 'issues';

  // Redirect invalid tabs to 'issues'
  useEffect(() => {
    if (!VALID_TABS.includes(rawTab)) {
      setSearchParams({ tab: 'issues' });
    }
  }, [rawTab, setSearchParams]);

  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  const [isGithubSyncing, setIsGithubSyncing] = useState(false);

  // Immersive mode (fullscreen) - hide app chrome
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  // Issues data
  const { refetch: refetchIssues, isFetching: isFetchingIssues } = useIssues();
  // Queue data
  const { refetch: refetchQueue, isFetching: isFetchingQueue } = useIssueQueue();

  const { createIssue, isCreating } = useIssueMutations();

  const setCurrentTab = (tab: IssueTab) => {
    setSearchParams({ tab });
  };

  // Issues tab handlers
  const handleIssuesRefresh = useCallback(() => {
    refetchIssues();
  }, [refetchIssues]);

  const handleGithubSync = useCallback(async () => {
    setIsGithubSyncing(true);
    try {
      const result = await pullIssuesFromGitHub({ state: 'open', limit: 100 });
      console.log('GitHub sync result:', result);
      await refetchIssues();
    } catch (error) {
      console.error('GitHub sync failed:', error);
    } finally {
      setIsGithubSyncing(false);
    }
  }, [refetchIssues]);

  const handleCreateIssue = async (data: { title: string; context?: string; priority?: Issue['priority']; type?: IssueType; attachments?: File[] }) => {
    try {
      // Create the issue first
      const newIssue = await createIssue({
        title: data.title,
        context: data.context,
        priority: data.priority,
      });

      // Upload attachments if any
      if (data.attachments && data.attachments.length > 0 && newIssue.id) {
        try {
          await uploadAttachments(newIssue.id, data.attachments);
        } catch (uploadError) {
          console.error('Failed to upload attachments:', uploadError);
          // Don't fail the whole operation, just log the error
        }
      }

      setIsNewIssueOpen(false);
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  // Queue tab handler
  const handleQueueRefresh = useCallback(() => {
    refetchQueue();
  }, [refetchQueue]);

  // Render action buttons based on current tab
  const renderActionButtons = () => {
    switch (currentTab) {
      case 'issues':
      case 'board':
        return (
          <>
            <Button variant="outline" onClick={handleIssuesRefresh} disabled={isFetchingIssues}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isFetchingIssues && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
            <Button variant="outline" onClick={handleGithubSync} disabled={isGithubSyncing}>
              <Github className={cn('w-4 h-4 mr-2', isGithubSyncing && 'animate-spin')} />
              {formatMessage({ id: 'issues.actions.github' })}
            </Button>
            <Button onClick={() => setIsNewIssueOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'issues.actions.create' })}
            </Button>
          </>
        );

      case 'queue':
        return (
          <>
            <Button variant="outline" onClick={handleQueueRefresh} disabled={isFetchingQueue}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isFetchingQueue && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
          </>
        );

      case 'discovery':
        return null; // Discovery panel has its own controls

      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Header and action buttons on same row */}
      <div className="flex items-center justify-between">
        <IssueHubHeader currentTab={currentTab} />

        <div className="flex items-center gap-2">
          {/* Action buttons - dynamic based on current tab */}
          {renderActionButtons()}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleImmersiveMode}
            className={cn(
              'p-2 rounded-md transition-colors',
              isImmersiveMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={isImmersiveMode
              ? formatMessage({ id: 'issueHub.exitFullscreen', defaultMessage: 'Exit Fullscreen' })
              : formatMessage({ id: 'issueHub.fullscreen', defaultMessage: 'Fullscreen' })
            }
          >
            {isImmersiveMode ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <IssueHubTabs currentTab={currentTab} onTabChange={setCurrentTab} />
      {currentTab === 'issues' && <IssuesPanel onCreateIssue={() => setIsNewIssueOpen(true)} />}
      {currentTab === 'board' && <IssueBoardPanel />}
      {currentTab === 'queue' && <QueuePanel />}
      {currentTab === 'discovery' && <DiscoveryPanel />}

      <NewIssueDialog open={isNewIssueOpen} onOpenChange={setIsNewIssueOpen} onSubmit={handleCreateIssue} isCreating={isCreating} />
    </div>
  );
}

export default IssueHubPage;
