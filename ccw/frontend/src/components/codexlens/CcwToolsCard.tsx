// ========================================
// CCW Tools Card Component
// ========================================
// Displays all registered CCW tools, highlighting codex-lens related tools

import { useIntl } from 'react-intl';
import { Wrench, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCcwToolsList } from '@/hooks';
import type { CcwToolInfo } from '@/lib/api';

const CODEX_LENS_PREFIX = 'codex_lens';

function isCodexLensTool(tool: CcwToolInfo): boolean {
  return tool.name.startsWith(CODEX_LENS_PREFIX);
}

export function CcwToolsCard() {
  const { formatMessage } = useIntl();
  const { tools, isLoading, error } = useCcwToolsList();

  const codexLensTools = tools.filter(isCodexLensTool);
  const otherTools = tools.filter((t) => !isCodexLensTool(t));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span>{formatMessage({ id: 'codexlens.mcp.title' })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{formatMessage({ id: 'codexlens.mcp.loading' })}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span>{formatMessage({ id: 'codexlens.mcp.title' })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">
                {formatMessage({ id: 'codexlens.mcp.error' })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatMessage({ id: 'codexlens.mcp.errorDesc' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span>{formatMessage({ id: 'codexlens.mcp.title' })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'codexlens.mcp.emptyDesc' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span>{formatMessage({ id: 'codexlens.mcp.title' })}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatMessage({ id: 'codexlens.mcp.totalCount' }, { count: tools.length })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CodexLens Tools Section */}
        {codexLensTools.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              {formatMessage({ id: 'codexlens.mcp.codexLensSection' })}
            </p>
            <div className="space-y-1.5">
              {codexLensTools.map((tool) => (
                <ToolRow key={tool.name} tool={tool} variant="default" />
              ))}
            </div>
          </div>
        )}

        {/* Other Tools Section */}
        {otherTools.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
              {formatMessage({ id: 'codexlens.mcp.otherSection' })}
            </p>
            <div className="space-y-1.5">
              {otherTools.map((tool) => (
                <ToolRow key={tool.name} tool={tool} variant="secondary" />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ToolRowProps {
  tool: CcwToolInfo;
  variant: 'default' | 'secondary';
}

function ToolRow({ tool, variant }: ToolRowProps) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
      <Badge variant={variant} className="text-xs font-mono shrink-0">
        {tool.name}
      </Badge>
      <span className="text-xs text-muted-foreground truncate" title={tool.description}>
        {tool.description}
      </span>
    </div>
  );
}

export default CcwToolsCard;
