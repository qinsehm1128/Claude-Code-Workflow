// ========================================
// Other Projects Section Component
// ========================================
// Section for discovering and importing servers from other projects

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { FolderOpen, Copy, ChevronRight, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useProjectOperations, useMcpServerMutations } from '@/hooks';
import { cn } from '@/lib/utils';
import type { McpServer } from '@/lib/api';
import { isHttpMcpServer, isStdioMcpServer } from '@/lib/api';

// ========== Types ==========

/**
 * Server from another project
 * Contains base server fields plus project metadata
 */
export interface OtherProjectServer {
  name: string;
  enabled: boolean;
  /** Display text - command for STDIO, URL for HTTP */
  displayText: string;
  /** Transport type */
  transport: 'stdio' | 'http';
  /** Project path */
  projectPath: string;
  /** Project name */
  projectName: string;
  /** Original server data */
  originalServer: McpServer;
}

export interface OtherProjectsSectionProps {
  /** Callback when server is successfully imported */
  onImportSuccess?: (serverName: string, sourceProject: string) => void;
  /** Additional class name */
  className?: string;
}

// ========== Component ==========

export function OtherProjectsSection({
  onImportSuccess,
  className,
}: OtherProjectsSectionProps) {
  const { formatMessage } = useIntl();
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [otherServers, setOtherServers] = useState<OtherProjectServer[]>([]);
  const [isFetchingServers, setIsFetchingServers] = useState(false);

  const { projects, currentProject, fetchOtherServers, isFetchingServers: isGlobalFetching } =
    useProjectOperations();
  const { createServer, isCreating } = useMcpServerMutations();

  // Get available projects (excluding current)
  const availableProjects = projects.filter((p) => p !== currentProject);

  // Handle project selection
  const handleProjectSelect = async (projectPath: string) => {
    setSelectedProjectPath(projectPath);
    setIsFetchingServers(true);

    try {
      const response = await fetchOtherServers([projectPath]);
      const servers: OtherProjectServer[] = [];

      for (const [path, serverList] of Object.entries(response.servers)) {
        const projectName = path.split(/[/\\]/).filter(Boolean).pop() || path;
        for (const server of (serverList as McpServer[])) {
          servers.push({
            name: server.name,
            enabled: server.enabled,
            displayText: isHttpMcpServer(server)
              ? server.url
              : (isStdioMcpServer(server) ? server.command : ''),
            transport: server.transport,
            projectPath: path,
            projectName,
            originalServer: server,
          });
        }
      }

      setOtherServers(servers);
    } catch (error) {
      console.error('Failed to fetch other projects servers:', error);
      setOtherServers([]);
    } finally {
      setIsFetchingServers(false);
    }
  };

  // Handle server import
  const handleImportServer = async (server: OtherProjectServer) => {
    try {
      // Generate a unique name by combining project name and server name
      const uniqueName = `${server.projectName}-${server.name}`.toLowerCase().replace(/\s+/g, '-');

      // Create server based on transport type
      const serverToCreate: McpServer = {
        ...server.originalServer,
        name: uniqueName,
        scope: 'project',
      };

      await createServer(serverToCreate);

      onImportSuccess?.(uniqueName, server.projectPath);
    } catch (error) {
      console.error('Failed to import server:', error);
    }
  };

  const isLoading = isFetchingServers || isGlobalFetching || isCreating;
  const selectedProjectName = selectedProjectPath
    ? selectedProjectPath.split(/[/\\]/).filter(Boolean).pop()
    : null;

  return (
    <Card className={cn('p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {formatMessage({ id: 'mcp.otherProjects.title' })}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectedProjectPath && handleProjectSelect(selectedProjectPath)}
          disabled={!selectedProjectPath || isLoading}
          className="h-8"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4">
        {formatMessage({ id: 'mcp.otherProjects.description' })}
      </p>

      {/* Project Selector */}
      <div className="mb-4">
        <label className="text-sm font-medium text-foreground mb-2 block">
          {formatMessage({ id: 'mcp.otherProjects.selectProject' })}
        </label>
        <Select value={selectedProjectPath ?? ''} onValueChange={handleProjectSelect}>
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={formatMessage({ id: 'mcp.otherProjects.selectProjectPlaceholder' })}
            />
          </SelectTrigger>
          <SelectContent>
            {availableProjects.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                {formatMessage({ id: 'mcp.otherProjects.noProjects' })}
              </div>
            ) : (
              availableProjects.map((path) => {
                const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
                return (
                  <SelectItem key={path} value={path}>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{name}</span>
                    </div>
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Servers List */}
      {selectedProjectPath && (
        <div className="space-y-2">
          {isFetchingServers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin text-muted-foreground">-</div>
              <span className="ml-2 text-sm text-muted-foreground">
                {formatMessage({ id: 'common.actions.loading' })}
              </span>
            </div>
          ) : otherServers.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
              {formatMessage(
                { id: 'mcp.otherProjects.noServers' },
                { project: selectedProjectName }
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {otherServers.map((server) => (
                <div
                  key={`${server.projectPath}-${server.name}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
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
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">{server.projectName}</span>
                      <ChevronRight className="inline w-3 h-3 mx-1" />
                      <span className="font-mono">{server.projectPath}</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImportServer(server)}
                    disabled={isCreating}
                    className="flex-shrink-0"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    {formatMessage({ id: 'mcp.otherProjects.import' })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {selectedProjectPath && otherServers.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {formatMessage({ id: 'mcp.otherProjects.hint' })}
        </p>
      )}
    </Card>
  );
}

export default OtherProjectsSection;
