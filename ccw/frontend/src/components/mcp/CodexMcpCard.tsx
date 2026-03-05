// ========================================
// Codex MCP Card Component
// ========================================
// Read-only display card for Codex MCP servers (no edit/delete)

import { useIntl } from 'react-intl';
import {
  Server,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  Lock,
  Link,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { McpServer } from '@/lib/api';
import { isHttpMcpServer, isStdioMcpServer } from '@/lib/api';

// ========== Types ==========

export interface CodexMcpCardProps {
  server: McpServer;
  enabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Optional: When true, indicates this card is in editable mode (for CodexMcpEditableCard extension) */
  isEditable?: boolean;
}

// ========== Component ==========

export function CodexMcpCard({
  server,
  enabled,
  isExpanded,
  onToggleExpand,
  // isEditable prop is for CodexMcpEditableCard extension compatibility
  isEditable: _isEditable = false,
}: CodexMcpCardProps) {
  const { formatMessage } = useIntl();

  const isHttp = isHttpMcpServer(server);
  const isStdio = isStdioMcpServer(server);

  // Get display text for server summary line
  const getServerSummary = () => {
    if (isHttp) {
      return server.url;
    }
    if (isStdio) {
      return `${server.command || ''} ${server.args?.join(' ') || ''}`.trim();
    }
    return '';
  };

  return (
    <Card className={cn('overflow-hidden', !enabled && 'opacity-60')}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Server className={cn(
                'w-5 h-5',
                enabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {server.name}
                </span>
                {/* Transport type badge */}
                {isHttp && (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                    <Link className="w-3 h-3 mr-1" />
                    {formatMessage({ id: 'mcp.transport.http' })}
                  </Badge>
                )}
                {/* Read-only badge */}
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {formatMessage({ id: 'mcp.codex.readOnly' })}
                </Badge>
                {enabled && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <Power className="w-3 h-3 mr-1" />
                    {formatMessage({ id: 'mcp.status.enabled' })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-mono truncate max-w-md" title={getServerSummary()}>
                {getServerSummary()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Disabled toggle button (visual only, no edit capability) */}
            <div className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center',
              enabled ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
            )}>
              {enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/30">
          {/* HTTP Server Details */}
          {isHttp && (
            <>
              {/* URL */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.http.url' })}</p>
                <code className="text-sm bg-background px-2 py-1 rounded block overflow-x-auto break-all">
                  {server.url}
                </code>
              </div>

              {/* HTTP Headers - show count only for read-only card */}
              {(server.headers || server.httpHeaders || server.bearerTokenEnvVar) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.http.headers' })}</p>
                  <div className="space-y-1">
                    {server.headers && Object.entries(server.headers).map(([name]) => (
                      <div key={name} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono">{name}</Badge>
                        <span className="text-muted-foreground">=</span>
                        <code className="text-xs bg-background px-2 py-1 rounded flex-1 overflow-x-auto">
                          ****
                        </code>
                      </div>
                    ))}
                    {server.httpHeaders && Object.entries(server.httpHeaders).map(([name]) => (
                      <div key={name} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono">{name}</Badge>
                        <span className="text-muted-foreground">=</span>
                        <code className="text-xs bg-background px-2 py-1 rounded flex-1 overflow-x-auto">
                          ****
                        </code>
                      </div>
                    ))}
                    {server.bearerTokenEnvVar && (
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono">Authorization</Badge>
                        <span className="text-muted-foreground">=</span>
                        <code className="text-xs bg-background px-2 py-1 rounded flex-1 overflow-x-auto">
                          Bearer $${server.bearerTokenEnvVar}
                        </code>
                        <Badge variant="outline" className="text-xs text-blue-500">
                          {formatMessage({ id: 'mcp.http.envVar' })}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STDIO Server Details */}
          {isStdio && (
            <>
              {/* Command details */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.command' })}</p>
                <code className="text-sm bg-background px-2 py-1 rounded block overflow-x-auto">
                  {server.command}
                </code>
              </div>

              {/* Args */}
              {server.args && server.args.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.args' })}</p>
                  <div className="flex flex-wrap gap-1">
                    {server.args.map((arg: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {arg}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Environment variables */}
              {server.env && Object.keys(server.env).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.env' })}</p>
                  <div className="space-y-1">
                    {Object.entries(server.env).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono">{key}</Badge>
                        <span className="text-muted-foreground">=</span>
                        <code className="text-xs bg-background px-2 py-1 rounded flex-1 overflow-x-auto">
                          {value as string}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Read-only notice */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'mcp.codex.readOnlyNotice' })}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default CodexMcpCard;
