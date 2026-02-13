// ========================================
// Cross-CLI Sync Panel Component
// ========================================
// Inline panel for synchronizing MCP servers between Claude and Codex

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMcpServers } from '@/hooks';
import { crossCliCopy, fetchCodexMcpServers } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Types ==========

export interface CrossCliSyncPanelProps {
  /** Callback when copy is successful */
  onSuccess?: (copiedCount: number, direction: 'to-codex' | 'from-codex') => void;
  /** Additional class name */
  className?: string;
}

interface ServerCheckboxItem {
  name: string;
  command: string;
  enabled: boolean;
  selected: boolean;
}

// ========== Component ==========

export function CrossCliSyncPanel({ onSuccess, className }: CrossCliSyncPanelProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Claude servers state
  const { servers: claudeServers } = useMcpServers();
  const [selectedClaude, setSelectedClaude] = useState<Set<string>>(new Set());

  // Codex servers state
  const [codexServers, setCodexServers] = useState<ServerCheckboxItem[]>([]);
  const [selectedCodex, setSelectedCodex] = useState<Set<string>>(new Set());
  const [isLoadingCodex, setIsLoadingCodex] = useState(false);
  const [codexError, setCodexError] = useState<string | null>(null);

  // Copy operation state
  const [isCopying, setIsCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<{
    type: 'success' | 'partial' | null;
    copied: number;
    failed: number;
  }>({ type: null, copied: 0, failed: 0 });

  // Load Codex servers on mount
  useEffect(() => {
    const loadCodexServers = async () => {
      setIsLoadingCodex(true);
      setCodexError(null);
      try {
        const codex = await fetchCodexMcpServers();
        setCodexServers(
          (codex.servers ?? []).map((s) => ({
            name: s.name,
            command: s.command,
            enabled: s.enabled,
            selected: false,
          }))
        );
      } catch (error) {
        console.error('Failed to load Codex MCP servers:', error);
        setCodexError(formatMessage({ id: 'mcp.sync.codexLoadError' }));
        setCodexServers([]);
      } finally {
        setIsLoadingCodex(false);
      }
    };

    void loadCodexServers();
  }, [formatMessage]);

  // Claude server handlers
  const toggleClaudeServer = (name: string) => {
    setSelectedClaude((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAllClaude = () => {
    setSelectedClaude(new Set(claudeServers.map((s) => s.name)));
  };

  const clearAllClaude = () => {
    setSelectedClaude(new Set());
  };

  // Codex server handlers
  const toggleCodexServer = (name: string) => {
    setSelectedCodex((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    setCodexServers((prev) =>
      prev.map((s) => (s.name === name ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectAllCodex = () => {
    const allNames = codexServers.map((s) => s.name);
    setSelectedCodex(new Set(allNames));
    setCodexServers((prev) => prev.map((s) => ({ ...s, selected: true })));
  };

  const clearAllCodex = () => {
    setSelectedCodex(new Set());
    setCodexServers((prev) => prev.map((s) => ({ ...s, selected: false })));
  };

  // Copy handlers
  const handleCopyToCodex = async () => {
    if (selectedClaude.size === 0) return;

    setIsCopying(true);
    setCopyResult({ type: null, copied: 0, failed: 0 });

    try {
      const result = await crossCliCopy({
        source: 'claude',
        target: 'codex',
        serverNames: Array.from(selectedClaude),
        projectPath: projectPath ?? undefined,
      });

      if (result.success) {
        const failedCount = result.failed.length;
        const copiedCount = result.copied.length;

        setCopyResult({
          type: failedCount > 0 ? 'partial' : 'success',
          copied: copiedCount,
          failed: failedCount,
        });

        onSuccess?.(copiedCount, 'to-codex');

        // Clear selection after successful copy
        setSelectedClaude(new Set());

        // Auto-hide result after 3 seconds
        setTimeout(() => {
          setCopyResult({ type: null, copied: 0, failed: 0 });
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to copy to Codex:', error);
      setCopyResult({ type: 'partial', copied: 0, failed: selectedClaude.size });
    } finally {
      setIsCopying(false);
    }
  };

  const handleCopyFromCodex = async () => {
    if (selectedCodex.size === 0 || !projectPath) {
      return;
    }

    setIsCopying(true);
    setCopyResult({ type: null, copied: 0, failed: 0 });

    try {
      const result = await crossCliCopy({
        source: 'codex',
        target: 'claude',
        serverNames: Array.from(selectedCodex),
        projectPath,
      });

      if (result.success) {
        const failedCount = result.failed.length;
        const copiedCount = result.copied.length;

        setCopyResult({
          type: failedCount > 0 ? 'partial' : 'success',
          copied: copiedCount,
          failed: failedCount,
        });

        onSuccess?.(copiedCount, 'from-codex');

        // Clear selection after successful copy
        setSelectedCodex(new Set());
        setCodexServers((prev) => prev.map((s) => ({ ...s, selected: false })));

        // Auto-hide result after 3 seconds
        setTimeout(() => {
          setCopyResult({ type: null, copied: 0, failed: 0 });
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to copy from Codex:', error);
      setCopyResult({ type: 'partial', copied: 0, failed: selectedCodex.size });
    } finally {
      setIsCopying(false);
    }
  };

  // Computed values
  const claudeTotal = claudeServers.length;
  const claudeSelected = selectedClaude.size;
  const codexTotal = codexServers.length;
  const codexSelected = selectedCodex.size;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="text-center">
        <h3 className="text-base font-semibold text-foreground">
          {formatMessage({ id: 'mcp.sync.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: 'mcp.sync.description' })}
        </p>
      </div>

      {/* Result Message */}
      {copyResult.type !== null && (
        <div
          className={cn(
            'flex items-center gap-2 p-3 rounded-lg border',
            copyResult.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-warning/10 border-warning/30 text-warning'
          )}
        >
          {copyResult.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm">
            {copyResult.type === 'success'
              ? formatMessage(
                  { id: 'mcp.sync.copySuccess' },
                  { count: copyResult.copied }
                )
              : formatMessage(
                  { id: 'mcp.sync.copyPartial' },
                  { copied: copyResult.copied, failed: copyResult.failed }
                )}
          </span>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claude Column */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Column Header */}
          <div className="bg-muted/50 px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'mcp.sync.claudeColumn' })}
              </h4>
              <Badge variant="outline" className="text-xs">
                {formatMessage(
                  { id: 'mcp.sync.selectedCount' },
                  { count: claudeSelected, total: claudeTotal }
                )}
              </Badge>
            </div>
          </div>

          {/* Claude Server List */}
          <div className="p-2 max-h-64 overflow-y-auto">
            {claudeTotal === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {formatMessage({ id: 'mcp.sync.noServers' })}
              </div>
            ) : (
              <div className="space-y-1">
                {claudeServers.map((server) => (
                  <div
                    key={server.name}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors',
                      selectedClaude.has(server.name)
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleClaudeServer(server.name)}
                  >
                    <Checkbox
                      id={`claude-${server.name}`}
                      checked={selectedClaude.has(server.name)}
                      onChange={() => toggleClaudeServer(server.name)}
                      className="w-4 h-4 mt-0.5"
                    />
                    <label
                      htmlFor={`claude-${server.name}`}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {server.name}
                        </span>
                        {server.enabled && (
                          <Badge variant="success" className="text-xs">
                            {formatMessage({ id: 'mcp.status.enabled' })}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {server.command}
                      </p>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Claude Footer Actions */}
          {claudeTotal > 0 && (
            <div className="px-2 py-2 bg-muted/30 border-t border-border flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllClaude}
                className="flex-1 text-xs"
              >
                {formatMessage({ id: 'mcp.sync.selectAll' })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllClaude}
                className="flex-1 text-xs"
                disabled={claudeSelected === 0}
              >
                {formatMessage({ id: 'mcp.sync.clearAll' })}
              </Button>
            </div>
          )}
        </div>

        {/* Codex Column */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Column Header */}
          <div className="bg-muted/50 px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'mcp.sync.codexColumn' })}
              </h4>
              <Badge variant="outline" className="text-xs">
                {formatMessage(
                  { id: 'mcp.sync.selectedCount' },
                  { count: codexSelected, total: codexTotal }
                )}
              </Badge>
            </div>
          </div>

          {/* Codex Server List */}
          <div className="p-2 max-h-64 overflow-y-auto">
            {isLoadingCodex ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : codexError ? (
              <div className="py-8 text-center text-sm text-destructive">
                {codexError}
              </div>
            ) : codexTotal === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {formatMessage({ id: 'mcp.sync.noServers' })}
              </div>
            ) : (
              <div className="space-y-1">
                {codexServers.map((server) => (
                  <div
                    key={server.name}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors',
                      server.selected
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleCodexServer(server.name)}
                  >
                    <Checkbox
                      id={`codex-${server.name}`}
                      checked={server.selected}
                      onChange={() => toggleCodexServer(server.name)}
                      className="w-4 h-4 mt-0.5"
                    />
                    <label
                      htmlFor={`codex-${server.name}`}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {server.name}
                        </span>
                        {server.enabled && (
                          <Badge variant="success" className="text-xs">
                            {formatMessage({ id: 'mcp.status.enabled' })}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {server.command}
                      </p>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Codex Footer Actions */}
          {codexTotal > 0 && (
            <div className="px-2 py-2 bg-muted/30 border-t border-border flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllCodex}
                className="flex-1 text-xs"
              >
                {formatMessage({ id: 'mcp.sync.selectAll' })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllCodex}
                className="flex-1 text-xs"
                disabled={codexSelected === 0}
              >
                {formatMessage({ id: 'mcp.sync.clearAll' })}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Copy Buttons */}
      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={handleCopyToCodex}
          disabled={claudeSelected === 0 || isCopying}
          variant="default"
          className="min-w-40"
        >
          {isCopying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {formatMessage({ id: 'mcp.sync.syncInProgress' })}
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              {formatMessage(
                { id: 'mcp.sync.copyToCodex' },
                { count: claudeSelected }
              )}
            </>
          )}
        </Button>

        <Button
          onClick={handleCopyFromCodex}
          disabled={codexSelected === 0 || isCopying || !projectPath}
          variant="default"
          className="min-w-40"
        >
          {isCopying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {formatMessage({ id: 'mcp.sync.syncInProgress' })}
            </>
          ) : (
            <>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {formatMessage(
                { id: 'mcp.sync.copyFromCodex' },
                { count: codexSelected }
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default CrossCliSyncPanel;
