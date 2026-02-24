// ========================================
// Flow Toolbar Component
// ========================================
// Toolbar for flow operations: Save, Load, Import Template, Export, Send to Terminal

import { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  FolderOpen,
  Download,
  Trash2,
  Copy,
  Workflow,
  Loader2,
  ChevronDown,
  Library,
  Terminal,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useFlowStore, toast } from '@/stores';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import type { Flow } from '@/types/flow';

interface FlowToolbarProps {
  className?: string;
  onOpenTemplateLibrary?: () => void;
}

export function FlowToolbar({ className, onOpenTemplateLibrary }: FlowToolbarProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [isFlowListOpen, setIsFlowListOpen] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Immersive mode state
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  // Flow store
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const isModified = useFlowStore((state) => state.isModified);
  const flows = useFlowStore((state) => state.flows);
  const isLoadingFlows = useFlowStore((state) => state.isLoadingFlows);
  const saveFlow = useFlowStore((state) => state.saveFlow);
  const loadFlow = useFlowStore((state) => state.loadFlow);
  const deleteFlow = useFlowStore((state) => state.deleteFlow);
  const duplicateFlow = useFlowStore((state) => state.duplicateFlow);
  const fetchFlows = useFlowStore((state) => state.fetchFlows);

  // Load flows on mount
  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Sync flow name with current flow
  useEffect(() => {
    setFlowName(currentFlow?.name || '');
  }, [currentFlow?.name]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const name = flowName.trim() || formatMessage({ id: 'orchestrator.toolbar.placeholder' });

      // Auto-create a new flow if none exists
      if (!currentFlow) {
        const now = new Date().toISOString();
        const newFlow: Flow = {
          id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          version: 1,
          created_at: now,
          updated_at: now,
          nodes: useFlowStore.getState().nodes,
          edges: useFlowStore.getState().edges,
          variables: {},
          metadata: {},
        };
        useFlowStore.setState({ currentFlow: newFlow });
      } else if (flowName && flowName !== currentFlow.name) {
        // Update flow name if changed
        useFlowStore.setState((state) => ({
          currentFlow: state.currentFlow
            ? { ...state.currentFlow, name }
            : null,
        }));
      }

      const saved = await saveFlow();
      if (saved) {
        toast.success(formatMessage({ id: 'orchestrator.notifications.flowSaved' }), formatMessage({ id: 'orchestrator.notifications.savedSuccessfully' }, { name }));
      } else {
        toast.error(formatMessage({ id: 'orchestrator.notifications.saveFailed' }), formatMessage({ id: 'orchestrator.notifications.couldNotSave' }));
      }
    } catch (err) {
      toast.error(formatMessage({ id: 'orchestrator.notifications.saveFailed' }), formatMessage({ id: 'orchestrator.notifications.saveError' }));
    } finally {
      setIsSaving(false);
    }
  }, [currentFlow, flowName, saveFlow, formatMessage]);

  // Handle load
  const handleLoad = useCallback(
    async (flow: Flow) => {
      const loaded = await loadFlow(flow.id);
      if (loaded) {
        setIsFlowListOpen(false);
        toast.success(formatMessage({ id: 'orchestrator.notifications.flowLoaded' }), formatMessage({ id: 'orchestrator.notifications.loadedSuccessfully' }, { name: flow.name }));
      } else {
        toast.error(formatMessage({ id: 'orchestrator.notifications.loadFailed' }), formatMessage({ id: 'orchestrator.notifications.couldNotLoad' }));
      }
    },
    [loadFlow]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (flow: Flow, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(formatMessage({ id: 'orchestrator.notifications.confirmDelete' }, { name: flow.name }))) return;

      const deleted = await deleteFlow(flow.id);
      if (deleted) {
        toast.success(formatMessage({ id: 'orchestrator.notifications.flowDeleted' }), formatMessage({ id: 'orchestrator.notifications.deletedSuccessfully' }, { name: flow.name }));
      } else {
        toast.error(formatMessage({ id: 'orchestrator.notifications.deleteFailed' }), formatMessage({ id: 'orchestrator.notifications.couldNotDelete' }));
      }
    },
    [deleteFlow]
  );

  // Handle duplicate
  const handleDuplicate = useCallback(
    async (flow: Flow, e: React.MouseEvent) => {
      e.stopPropagation();
      const duplicated = await duplicateFlow(flow.id);
      if (duplicated) {
        toast.success(formatMessage({ id: 'orchestrator.notifications.flowDuplicated' }), formatMessage({ id: 'orchestrator.notifications.duplicatedSuccessfully' }, { name: duplicated.name }));
      } else {
        toast.error(formatMessage({ id: 'orchestrator.notifications.duplicateFailed' }), formatMessage({ id: 'orchestrator.notifications.couldNotDuplicate' }));
      }
    },
    [duplicateFlow]
  );

  // Handle export
  const handleExport = useCallback(() => {
    if (!currentFlow) {
      toast.error(formatMessage({ id: 'orchestrator.notifications.noFlow' }), formatMessage({ id: 'orchestrator.notifications.noFlowToExport' }));
      return;
    }

    const nodes = useFlowStore.getState().nodes;
    const edges = useFlowStore.getState().edges;
    const exportData = {
      ...currentFlow,
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFlow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(formatMessage({ id: 'orchestrator.notifications.flowExported' }), formatMessage({ id: 'orchestrator.notifications.flowExported' }));
  }, [currentFlow]);

  // Handle send to terminal execution
  const handleSendToTerminal = useCallback(async () => {
    if (!currentFlow) {
      toast.error(formatMessage({ id: 'orchestrator.notifications.noFlow' }), formatMessage({ id: 'orchestrator.notifications.saveBeforeExecute' }));
      return;
    }

    // Save flow first if modified
    if (isModified) {
      const saved = await saveFlow();
      if (!saved) {
        toast.error(formatMessage({ id: 'orchestrator.notifications.saveFailed' }), formatMessage({ id: 'orchestrator.notifications.couldNotSave' }));
        return;
      }
    }

    // Navigate to terminal dashboard with flow execution request
    navigate(`/terminal?executeFlow=${currentFlow.id}`);
    toast.success(formatMessage({ id: 'orchestrator.notifications.flowSent' }), formatMessage({ id: 'orchestrator.notifications.sentToTerminal' }, { name: currentFlow.name }));
  }, [currentFlow, isModified, saveFlow, navigate, formatMessage]);

  return (
    <div className={cn('flex items-center gap-3 p-3 bg-card border-b border-border', className)}>
      {/* Flow Icon and Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Workflow className="w-5 h-5 text-primary flex-shrink-0" />
        <Input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder={formatMessage({ id: 'orchestrator.toolbar.placeholder' })}
          className="max-w-[200px] h-8 text-sm"
        />
        {isModified && (
          <span className="text-xs text-amber-500 flex-shrink-0">{formatMessage({ id: 'orchestrator.toolbar.unsavedChanges' })}</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Save & Load Group */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          {formatMessage({ id: 'orchestrator.toolbar.save' })}
        </Button>

        {/* Flow List Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFlowListOpen(!isFlowListOpen)}
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'orchestrator.toolbar.load' })}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>

          {isFlowListOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsFlowListOpen(false)}
              />

              {/* Dropdown */}
              <div className="absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {formatMessage({ id: 'orchestrator.toolbar.savedFlows' }, { count: flows.length })}
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {isLoadingFlows ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      {formatMessage({ id: 'orchestrator.toolbar.loading' })}
                    </div>
                  ) : flows.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {formatMessage({ id: 'orchestrator.toolbar.noSavedFlows' })}
                    </div>
                  ) : (
                    flows.map((flow) => (
                      <div
                        key={flow.id}
                        onClick={() => handleLoad(flow)}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors',
                          currentFlow?.id === flow.id && 'bg-primary/10'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {flow.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(flow.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => handleDuplicate(flow, e)}
                            title={formatMessage({ id: 'orchestrator.toolbar.duplicate' })}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => handleDelete(flow, e)}
                            title={formatMessage({ id: 'orchestrator.toolbar.delete' })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Import & Export Group */}
        <Button variant="outline" size="sm" onClick={onOpenTemplateLibrary}>
          <Library className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'orchestrator.toolbar.importTemplate' })}
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport} disabled={!currentFlow}>
          <Download className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'orchestrator.toolbar.export' })}
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Execute in Terminal */}
        <Button
          variant="default"
          size="sm"
          onClick={handleSendToTerminal}
          disabled={!currentFlow}
        >
          <Terminal className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'orchestrator.toolbar.sendToTerminal' })}
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleImmersiveMode}
          className={cn(
            'p-2 rounded-md transition-colors',
            isImmersiveMode
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isImmersiveMode ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isImmersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default FlowToolbar;
