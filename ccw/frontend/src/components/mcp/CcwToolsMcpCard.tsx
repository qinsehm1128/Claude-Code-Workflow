// ========================================
// CCW Tools MCP Card Component
// ========================================
// Special card component for CCW Tools MCP server configuration
// Displays tool checkboxes, path settings, and install/uninstall actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation } from '@tanstack/react-query';
import {
  Settings,
  Check,
  FolderTree,
  Shield,
  Database,
  FileText,
  Files,
  HardDrive,
  MessageCircleQuestion,
  MessagesSquare,
  SearchCode,
  ChevronDown,
  ChevronRight,
  Globe,
  Folder,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  installCcwMcp,
  uninstallCcwMcp,
  updateCcwConfig,
  installCcwMcpToCodex,
  uninstallCcwMcpFromCodex,
  updateCcwConfigForCodex,
} from '@/lib/api';
import { mcpServersKeys, useNotifications } from '@/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Types ==========

/**
 * CCW Tool definition with name, description, and core flag
 */
export interface CcwTool {
  name: string;
  desc: string;
  core: boolean;
}

/**
 * CCW MCP configuration interface
 */
export interface CcwConfig {
  enabledTools: string[];
  projectRoot?: string;
  allowedDirs?: string;
  enableSandbox?: boolean;
}

/**
 * Props for CcwToolsMcpCard component
 */
export interface CcwToolsMcpCardProps {
  /** Whether CCW MCP is installed */
  isInstalled: boolean;
  /** List of enabled tool names */
  enabledTools: string[];
  /** Project root path */
  projectRoot?: string;
  /** Comma-separated list of allowed directories */
  allowedDirs?: string;
  /** Whether sandbox is disabled */
  enableSandbox?: boolean;
  /** Callback when a tool is toggled */
  onToggleTool: (tool: string, enabled: boolean) => void;
  /** Callback when configuration is updated */
  onUpdateConfig: (config: Partial<CcwConfig>) => void;
  /** Callback when install/uninstall is triggered */
  onInstall: () => void;
  /** Installation target: Claude or Codex */
  target?: 'claude' | 'codex';
  /** Scopes where CCW MCP is currently installed */
  installedScopes?: ('global' | 'project')[];
  /** Callback to uninstall from a specific scope */
  onUninstallScope?: (scope: 'global' | 'project') => void;
  /** Callback to install to an additional scope */
  onInstallToScope?: (scope: 'global' | 'project') => void;
}

// ========== Constants ==========

/**
 * CCW MCP Tools definition
 * Available tools that can be enabled/disabled in CCW MCP server
 */
export const CCW_MCP_TOOLS: CcwTool[] = [
  { name: 'write_file', desc: 'Write/create files', core: true },
  { name: 'edit_file', desc: 'Edit/replace content', core: true },
  { name: 'read_file', desc: 'Read single file', core: true },
  { name: 'read_many_files', desc: 'Read multiple files/dirs', core: true },
  { name: 'core_memory', desc: 'Core memory management', core: true },
  { name: 'ask_question', desc: 'Interactive questions (A2UI)', core: false },
  { name: 'smart_search', desc: 'Intelligent code search', core: true },
  { name: 'team_msg', desc: 'Agent team message bus', core: false },
];

// ========== Component ==========

export function CcwToolsMcpCard({
  isInstalled,
  enabledTools,
  projectRoot,
  allowedDirs,
  enableSandbox,
  onToggleTool,
  onUpdateConfig,
  onInstall,
  target = 'claude',
  installedScopes = [],
  onUninstallScope,
  onInstallToScope,
}: CcwToolsMcpCardProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const currentProjectPath = useWorkflowStore(selectProjectPath);

  // Local state for config inputs
  const [projectRootInput, setProjectRootInput] = useState(projectRoot || '');
  const [allowedDirsInput, setAllowedDirsInput] = useState(allowedDirs || '');
  const [enableSandboxInput, setEnableSandboxInput] = useState(enableSandbox || false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [installScope, setInstallScope] = useState<'global' | 'project'>('global');

  const isCodex = target === 'codex';

  // Mutations for install/uninstall
  const installMutation = useMutation({
    mutationFn: isCodex
      ? () => installCcwMcpToCodex()
      : (params: { scope: 'global' | 'project'; projectPath?: string }) =>
          installCcwMcp(params.scope, params.projectPath),
    onSuccess: () => {
      if (isCodex) {
        queryClient.invalidateQueries({ queryKey: ['codexMcpServers'] });
        queryClient.invalidateQueries({ queryKey: ['ccwMcpConfigCodex'] });
      } else {
        queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
        queryClient.invalidateQueries({ queryKey: ['ccwMcpConfig'] });
      }
      onInstall();
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: isCodex ? uninstallCcwMcpFromCodex : uninstallCcwMcp,
    onSuccess: () => {
      if (isCodex) {
        queryClient.invalidateQueries({ queryKey: ['codexMcpServers'] });
        queryClient.invalidateQueries({ queryKey: ['ccwMcpConfigCodex'] });
      } else {
        queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
        queryClient.invalidateQueries({ queryKey: ['ccwMcpConfig'] });
      }
      onInstall();
    },
    onError: (error) => {
      console.error('Failed to uninstall CCW MCP:', error);
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: isCodex ? updateCcwConfigForCodex : updateCcwConfig,
    onSuccess: () => {
      if (isCodex) {
        queryClient.invalidateQueries({ queryKey: ['codexMcpServers'] });
        queryClient.invalidateQueries({ queryKey: ['ccwMcpConfigCodex'] });
      } else {
        queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
        queryClient.invalidateQueries({ queryKey: ['ccwMcpConfig'] });
      }
      notifySuccess(formatMessage({ id: 'mcp.ccw.feedback.saveSuccess' }));
    },
    onError: (error) => {
      console.error('Failed to update CCW config:', error);
      notifyError(
        formatMessage({ id: 'mcp.ccw.feedback.saveError' }),
        error instanceof Error ? error.message : String(error)
      );
    },
  });

  // Handlers
  const handleToggleTool = (toolName: string, enabled: boolean) => {
    onToggleTool(toolName, enabled);
  };

  const handleEnableAll = () => {
    const allToolNames = CCW_MCP_TOOLS.map((t) => t.name);
    onUpdateConfig({ enabledTools: allToolNames });
  };

  const handleDisableAll = () => {
    onUpdateConfig({ enabledTools: [] });
  };

  const handleConfigSave = () => {
    updateConfigMutation.mutate({
      // Preserve current tool selection; otherwise updateCcwConfig* falls back to defaults
      // and can unintentionally overwrite user-chosen enabled tools.
      enabledTools,
      projectRoot: projectRootInput || undefined,
      allowedDirs: allowedDirsInput || undefined,
      enableSandbox: enableSandboxInput,
    });
  };

  const handleInstallClick = () => {
    if (isCodex) {
      (installMutation as any).mutate(undefined);
    } else {
      (installMutation as any).mutate({
        scope: installScope,
        projectPath: installScope === 'project' ? currentProjectPath : undefined,
      });
    }
  };

  const handleUninstallClick = () => {
    if (confirm(formatMessage({ id: 'mcp.ccw.actions.uninstallConfirm' }))) {
      uninstallMutation.mutate();
    }
  };

  const isPending = installMutation.isPending || uninstallMutation.isPending || updateConfigMutation.isPending;

  return (
    <Card className={cn(
      'overflow-hidden border-2',
      isInstalled ? 'border-primary/50 bg-primary/5' : 'border-dashed'
    )}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isInstalled ? 'bg-primary/20' : 'bg-muted'
            )}>
              <Settings className={cn(
                'w-5 h-5',
                isInstalled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.ccw.title' })}
                </span>
                {isInstalled && installedScopes.length > 0 ? (
                  <>
                    {installedScopes.map((s) => (
                      <Badge key={s} variant="default" className="text-xs">
                        {s === 'global' ? <Globe className="w-3 h-3 mr-1" /> : <Folder className="w-3 h-3 mr-1" />}
                        {formatMessage({ id: `mcp.ccw.scope.${s}` })}
                      </Badge>
                    ))}
                    {installedScopes.length >= 2 && (
                      <Badge variant="outline" className="text-xs text-orange-500 border-orange-300">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {formatMessage({ id: 'mcp.conflict.badge' })}
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge variant={isInstalled ? 'default' : 'secondary'} className="text-xs">
                    {isInstalled ? formatMessage({ id: 'mcp.ccw.status.installed' }) : formatMessage({ id: 'mcp.ccw.status.notInstalled' })}
                  </Badge>
                )}
                {isCodex && (
                  <Badge variant="outline" className="text-xs text-blue-500">
                    Codex
                  </Badge>
                )}
                {isInstalled && (
                  <Badge variant="outline" className="text-xs text-info">
                    {formatMessage({ id: 'mcp.ccw.status.special' })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatMessage({ id: 'mcp.ccw.description' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnableAll}
              disabled={!isInstalled}
            >
              <Check className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'mcp.ccw.actions.enableAll' })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisableAll}
              disabled={!isInstalled}
            >
              {formatMessage({ id: 'mcp.ccw.actions.disableAll' })}
            </Button>
          </div>

          {/* Tool Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {formatMessage({ id: 'mcp.ccw.tools.label' })}
              </p>
              {!isInstalled && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {formatMessage({ id: 'mcp.ccw.tools.hint' })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CCW_MCP_TOOLS.map((tool) => {
                const isEnabled = enabledTools.includes(tool.name);
                const icon = getToolIcon(tool.name);

                return (
                  <div
                    key={tool.name}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg transition-colors border',
                      isEnabled ? 'bg-background border-primary/40' : 'bg-background border-border'
                    )}
                  >
                    <input
                      type="checkbox"
                      id={`ccw-tool-${tool.name}`}
                      checked={isEnabled}
                      onChange={(e) => handleToggleTool(tool.name, e.target.checked)}
                      disabled={!isInstalled}
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor={`ccw-tool-${tool.name}`}
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                    >
                      {icon}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {formatMessage({ id: `mcp.ccw.tools.${tool.name}.name` })}
                          </span>
                          {tool.core && (
                            <Badge variant="secondary" className="text-xs">
                              {formatMessage({ id: 'mcp.ccw.tools.core' })}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMessage({ id: `mcp.ccw.tools.${tool.name}.desc` })}
                        </p>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Path Configuration */}
          <div className="space-y-3 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {formatMessage({ id: 'mcp.ccw.paths.label' })}
            </p>

            {/* Project Root */}
            <div className="space-y-1">
              <label className="text-sm text-foreground flex items-center gap-1">
                <FolderTree className="w-4 h-4" />
                {formatMessage({ id: 'mcp.ccw.paths.projectRoot' })}
              </label>
              <Input
                value={projectRootInput}
                onChange={(e) => setProjectRootInput(e.target.value)}
                placeholder={formatMessage({ id: 'mcp.ccw.paths.projectRootPlaceholder' })}
                disabled={!isInstalled}
                className="font-mono text-sm"
              />
            </div>

            {/* Allowed Dirs */}
            <div className="space-y-1">
              <label className="text-sm text-foreground flex items-center gap-1">
                <HardDrive className="w-4 h-4" />
                {formatMessage({ id: 'mcp.ccw.paths.allowedDirs' })}
              </label>
              <Input
                value={allowedDirsInput}
                onChange={(e) => setAllowedDirsInput(e.target.value)}
                placeholder={formatMessage({ id: 'mcp.ccw.paths.allowedDirsPlaceholder' })}
                disabled={!isInstalled}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'mcp.ccw.paths.allowedDirsHint' })}
              </p>
            </div>

            {/* Enable Sandbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ccw-enable-sandbox"
                checked={enableSandboxInput}
                onChange={(e) => setEnableSandboxInput(e.target.checked)}
                disabled={!isInstalled}
                className="w-4 h-4"
              />
              <label
                htmlFor="ccw-enable-sandbox"
                className="text-sm text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                {formatMessage({ id: 'mcp.ccw.paths.enableSandbox' })}
              </label>
            </div>

            {/* Save Config Button */}
            {isInstalled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConfigSave}
                disabled={isPending}
                className="w-full"
              >
                {isPending
                  ? formatMessage({ id: 'mcp.ccw.actions.saving' })
                  : formatMessage({ id: 'mcp.ccw.actions.saveConfig' })
                }
              </Button>
            )}
          </div>

          {/* Install/Uninstall Button */}
          <div className="pt-3 border-t border-border space-y-3">
            {/* Scope Selection - Claude only, only when not installed */}
            {!isInstalled && !isCodex && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {formatMessage({ id: 'mcp.scope' })}
                </p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ccw-install-scope"
                      value="global"
                      checked={installScope === 'global'}
                      onChange={() => setInstallScope('global')}
                      className="w-4 h-4"
                    />
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{formatMessage({ id: 'mcp.scope.global' })}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ccw-install-scope"
                      value="project"
                      checked={installScope === 'project'}
                      onChange={() => setInstallScope('project')}
                      className="w-4 h-4"
                    />
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{formatMessage({ id: 'mcp.scope.project' })}</span>
                  </label>
                </div>
              </div>
            )}
            {/* Codex note */}
            {isCodex && !isInstalled && (
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'mcp.ccw.codexNote' })}
              </p>
            )}

            {/* Dual-scope conflict warning */}
            {isInstalled && !isCodex && installedScopes.length >= 2 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{formatMessage({ id: 'mcp.conflict.title' })}</span>
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400/80">
                  {formatMessage({ id: 'mcp.conflict.description' }, { scope: formatMessage({ id: 'mcp.scope.global' }) })}
                </p>
              </div>
            )}

            {!isInstalled ? (
              <Button
                onClick={handleInstallClick}
                disabled={isPending}
                className="w-full"
              >
                {isPending
                  ? formatMessage({ id: 'mcp.ccw.actions.installing' })
                  : formatMessage({ id: isCodex ? 'mcp.ccw.actions.installCodex' : 'mcp.ccw.actions.install' })
                }
              </Button>
            ) : isCodex ? (
              /* Codex: single uninstall button */
              <Button
                variant="destructive"
                onClick={handleUninstallClick}
                disabled={isPending}
                className="w-full"
              >
                {isPending
                  ? formatMessage({ id: 'mcp.ccw.actions.uninstalling' })
                  : formatMessage({ id: 'mcp.ccw.actions.uninstall' })
                }
              </Button>
            ) : (
              /* Claude: per-scope install/uninstall */
              <div className="space-y-2">
                {/* Install to missing scope */}
                {installedScopes.length === 1 && onInstallToScope && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const missingScope = installedScopes.includes('global') ? 'project' : 'global';
                      onInstallToScope(missingScope);
                    }}
                    disabled={isPending}
                    className="w-full"
                  >
                    {installedScopes.includes('global')
                      ? formatMessage({ id: 'mcp.ccw.scope.installToProject' })
                      : formatMessage({ id: 'mcp.ccw.scope.installToGlobal' })
                    }
                  </Button>
                )}

                {/* Per-scope uninstall buttons */}
                {onUninstallScope && installedScopes.map((s) => (
                  <Button
                    key={s}
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(formatMessage({ id: 'mcp.ccw.actions.uninstallScopeConfirm' }, { scope: formatMessage({ id: `mcp.ccw.scope.${s}` }) }))) {
                        onUninstallScope(s);
                      }
                    }}
                    disabled={isPending}
                    className="w-full"
                  >
                    {s === 'global'
                      ? formatMessage({ id: 'mcp.ccw.scope.uninstallGlobal' })
                      : formatMessage({ id: 'mcp.ccw.scope.uninstallProject' })
                    }
                  </Button>
                ))}

                {/* Fallback: full uninstall if no scope info */}
                {(!onUninstallScope || installedScopes.length === 0) && (
                  <Button
                    variant="destructive"
                    onClick={handleUninstallClick}
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending
                      ? formatMessage({ id: 'mcp.ccw.actions.uninstalling' })
                      : formatMessage({ id: 'mcp.ccw.actions.uninstall' })
                    }
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ========== Helper Functions ==========

/**
 * Get icon component for a tool name
 */
function getToolIcon(toolName: string): React.ReactElement {
  const iconProps = { className: 'w-4 h-4 text-muted-foreground' };

  switch (toolName) {
    case 'write_file':
      return <FileText {...iconProps} />;
    case 'edit_file':
      return <Check {...iconProps} />;
    case 'read_file':
      return <Database {...iconProps} />;
    case 'read_many_files':
      return <Files {...iconProps} />;
    case 'core_memory':
      return <Settings {...iconProps} />;
    case 'ask_question':
      return <MessageCircleQuestion {...iconProps} />;
    case 'smart_search':
      return <SearchCode {...iconProps} />;
    case 'team_msg':
      return <MessagesSquare {...iconProps} />;
    default:
      return <Settings {...iconProps} />;
  }
}

export default CcwToolsMcpCard;
