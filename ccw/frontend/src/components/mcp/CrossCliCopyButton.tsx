// ========================================
// Cross-CLI Copy Button Component
// ========================================
// Button component for copying MCP servers between Claude and Codex configurations

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Copy, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { useMcpServers } from '@/hooks';
import { crossCliCopy, fetchCodexMcpServers, isHttpMcpServer, isStdioMcpServer } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Types ==========

export type CliType = 'claude' | 'codex';
export type CopyDirection = 'claude-to-codex' | 'codex-to-claude';

export interface CrossCliCopyButtonProps {
  /** Current CLI mode */
  currentMode?: CliType;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'icon';
  /** Additional class name */
  className?: string;
  /** Callback when copy is successful */
  onSuccess?: (copiedCount: number) => void;
}

interface ServerCheckboxItem {
  name: string;
  /** Display text - command for STDIO, URL for HTTP */
  displayText: string;
  enabled: boolean;
  selected: boolean;
}

// ========== Constants ==========

const CLI_LABELS: Record<CliType, string> = {
  claude: 'Claude',
  codex: 'Codex',
};

// ========== Component ==========

export function CrossCliCopyButton({
  currentMode = 'claude',
  variant = 'outline',
  size = 'sm',
  className,
  onSuccess,
}: CrossCliCopyButtonProps) {
  const { formatMessage } = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<CopyDirection>(
    currentMode === 'claude' ? 'claude-to-codex' : 'codex-to-claude'
  );
  const [serverItems, setServerItems] = useState<ServerCheckboxItem[]>([]);

  const { servers } = useMcpServers();
  const projectPath = useWorkflowStore(selectProjectPath);
  const [isCopying, setIsCopying] = useState(false);

  const loadServerItems = async (nextDirection: CopyDirection) => {
    if (nextDirection === 'claude-to-codex') {
      setServerItems(
        servers.map((s) => ({
          name: s.name,
          displayText: isHttpMcpServer(s) ? s.url : (isStdioMcpServer(s) ? s.command : ''),
          enabled: s.enabled,
          selected: false,
        }))
      );
      return;
    }

    try {
      const codex = await fetchCodexMcpServers();
      setServerItems(
        (codex.servers ?? []).map((s) => ({
          name: s.name,
          displayText: isHttpMcpServer(s) ? s.url : (isStdioMcpServer(s) ? s.command : ''),
          enabled: s.enabled,
          selected: false,
        }))
      );
    } catch (error) {
      console.error('Failed to load Codex MCP servers:', error);
      setServerItems([]);
    }
  };

  // Initialize server items when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      const nextDirection = currentMode === 'claude' ? 'claude-to-codex' : 'codex-to-claude';
      setDirection(nextDirection);
      void loadServerItems(nextDirection);
    } else {
      setServerItems([]);
    }
  };

  // Get source and target CLI labels
  const sourceCli = direction === 'claude-to-codex' ? 'claude' : 'codex';
  const targetCli = direction === 'claude-to-codex' ? 'codex' : 'claude';

  // Toggle direction
  const handleToggleDirection = () => {
    const next = direction === 'claude-to-codex' ? 'codex-to-claude' : 'claude-to-codex';
    setDirection(next);
    void loadServerItems(next);
  };

  // Toggle server selection
  const handleToggleServer = (serverName: string) => {
    setServerItems((prev) =>
      prev.map((item) =>
        item.name === serverName ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Select/deselect all
  const handleToggleAll = () => {
    const allSelected = serverItems.every((item) => item.selected);
    setServerItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  // Handle copy operation
  const handleCopy = async () => {
    const selectedServers = serverItems.filter((item) => item.selected).map((item) => item.name);

    if (selectedServers.length === 0) {
      return;
    }

    setIsCopying(true);
    try {
      if (targetCli === 'claude' && !projectPath) {
        throw new Error('Project path is required to copy servers into Claude project');
      }

      const result = await crossCliCopy({
        source: sourceCli,
        target: targetCli,
        serverNames: selectedServers,
        projectPath: projectPath ?? undefined,
      });

      if (result.success) {
        onSuccess?.(result.copied.length);
        setIsOpen(false);

        if (result.failed.length > 0) {
          console.warn('Some servers failed to copy:', result.failed);
        }
      }
    } catch (error) {
      console.error('Failed to copy servers:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const selectedCount = serverItems.filter((item) => item.selected).length;
  const allSelected = serverItems.length > 0 && serverItems.every((item) => item.selected);
  const someSelected = serverItems.some((item) => item.selected);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => handleOpenChange(true)}
        className={className}
      >
        <Copy className="w-4 h-4 mr-2" />
        {formatMessage({ id: 'mcp.crossCli.button' })}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              {formatMessage({ id: 'mcp.crossCli.title' })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Direction Selector */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm font-mono">
                  {CLI_LABELS[sourceCli]}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleDirection}
                  className="p-2"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Badge variant="default" className="text-sm font-mono">
                  {CLI_LABELS[targetCli]}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                disabled={serverItems.length === 0}
              >
                {allSelected
                  ? formatMessage({ id: 'common.actions.deselectAll' })
                  : formatMessage({ id: 'common.actions.selectAll' })
                }
              </Button>
            </div>

            {/* Server Selection List */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {formatMessage(
                  { id: 'mcp.crossCli.selectServers' },
                  { source: CLI_LABELS[sourceCli] }
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'mcp.crossCli.selectServersHint' })}
              </p>

              {serverItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
                  {formatMessage({ id: 'mcp.crossCli.noServers' })}
                </div>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {serverItems.map((server) => (
                    <div
                      key={server.name}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer',
                        server.selected ? 'bg-primary/10' : 'hover:bg-muted/50'
                      )}
                      onClick={() => handleToggleServer(server.name)}
                    >
                      <Checkbox
                        id={`server-${server.name}`}
                        checked={server.selected}
                        onChange={() => handleToggleServer(server.name)}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor={`server-${server.name}`}
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <div className="flex items-center gap-2">
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
                          {server.displayText}
                        </p>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selection Summary */}
            {someSelected && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm text-foreground">
                  {formatMessage(
                    { id: 'mcp.crossCli.selectedCount' },
                    { count: selectedCount }
                  )}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCopying}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              onClick={handleCopy}
              disabled={selectedCount === 0 || isCopying}
            >
              {isCopying ? (
                <>
                  <span className="animate-spin mr-2">-</span>
                  {formatMessage({ id: 'mcp.crossCli.copying' })}
                </>
              ) : (
                <>
                  {direction === 'claude-to-codex' ? (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  ) : (
                    <ArrowLeft className="w-4 h-4 mr-2" />
                  )}
                  {formatMessage(
                    { id: 'mcp.crossCli.copyButton' },
                    { count: selectedCount, target: CLI_LABELS[targetCli] }
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CrossCliCopyButton;
