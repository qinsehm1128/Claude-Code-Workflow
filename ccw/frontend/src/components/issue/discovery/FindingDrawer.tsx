// ========================================
// FindingDrawer Component
// ========================================
// Right-side finding detail drawer for displaying discovery finding details

import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { X, FileText, AlertTriangle, ExternalLink, MapPin, Code, Lightbulb, Target } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Finding } from '@/lib/api';

// ========== Types ==========
export interface FindingDrawerProps {
  finding: Finding | null;
  isOpen: boolean;
  onClose: () => void;
}

// ========== Severity Configuration ==========
const severityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  critical: { label: 'issues.discovery.findings.severity.critical', variant: 'destructive' },
  high: { label: 'issues.discovery.findings.severity.high', variant: 'destructive' },
  medium: { label: 'issues.discovery.findings.severity.medium', variant: 'warning' },
  low: { label: 'issues.discovery.findings.severity.low', variant: 'secondary' },
};

function getSeverityConfig(severity: string) {
  return severityConfig[severity] || { label: 'issues.discovery.findings.severity.unknown', variant: 'outline' };
}

// ========== Component ==========

export function FindingDrawer({ finding, isOpen, onClose }: FindingDrawerProps) {
  const { formatMessage } = useIntl();

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!finding || !isOpen) {
    return null;
  }

  const severity = getSeverityConfig(finding.severity);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-1/2 bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        style={{ minWidth: '400px', maxWidth: '800px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{finding.id}</span>
              <Badge variant={severity.variant}>
                {formatMessage({ id: severity.label })}
              </Badge>
              {finding.type && (
                <Badge variant="outline">{finding.type}</Badge>
              )}
              {finding.category && (
                <Badge variant="info">{finding.category}</Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {finding.title}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0 hover:bg-secondary">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {formatMessage({ id: 'issues.discovery.findings.description' })}
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {finding.description}
            </p>
          </div>

          {/* File Location */}
          {finding.file && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {formatMessage({ id: 'issues.discovery.findings.location' })}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <code className="px-2 py-1 bg-muted rounded text-xs">
                  {finding.file}
                  {finding.line && `:${finding.line}`}
                </code>
              </div>
            </div>
          )}

          {/* Code Snippet */}
          {finding.code_snippet && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Code className="h-4 w-4" />
                {formatMessage({ id: 'issues.discovery.findings.codeSnippet' })}
              </h3>
              <pre className="p-3 bg-muted rounded-md overflow-x-auto text-xs border border-border">
                <code>{finding.code_snippet}</code>
              </pre>
            </div>
          )}

          {/* Suggested Fix */}
          {finding.suggested_issue && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                {formatMessage({ id: 'issues.discovery.findings.suggestedFix' })}
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {finding.suggested_issue}
              </p>
            </div>
          )}

          {/* Confidence */}
          {finding.confidence !== undefined && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                {formatMessage({ id: 'issues.discovery.findings.confidence' })}
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      finding.confidence >= 0.9 ? "bg-green-500" :
                      finding.confidence >= 0.7 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${finding.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {Math.round(finding.confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Reference */}
          {finding.reference && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                {formatMessage({ id: 'issues.discovery.findings.reference' })}
              </h3>
              <a
                href={finding.reference}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {finding.reference}
              </a>
            </div>
          )}

          {/* Perspective */}
          {finding.perspective && (
            <div className="pt-4 border-t border-border">
              <Badge variant="secondary" className="text-xs">
                {formatMessage({ id: 'issues.discovery.findings.perspective' })}: {finding.perspective}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default FindingDrawer;
