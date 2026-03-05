// ========================================
// DocumentViewer Component
// ========================================
// Displays DeepWiki documentation content with table of contents

import { useMemo, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { FileText, Hash, Clock, Sparkles, AlertCircle, Link2, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { DeepWikiSymbol, DeepWikiDoc } from '@/hooks/useDeepWiki';

export interface DocumentViewerProps {
  doc: DeepWikiDoc | null;
  content: string;
  symbols: DeepWikiSymbol[];
  isLoading?: boolean;
  error?: Error | null;
  /** Current file path for generating deep links */
  filePath?: string;
}

/**
 * Simple markdown-to-HTML converter for basic formatting
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code class="language-$1">$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3 class="doc-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="doc-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1 class="doc-h1">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link">$1</a>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="doc-paragraph">');
  html = html.replace(/\n/g, '<br />');

  return `<div class="doc-content"><p class="doc-paragraph">${html}</p></div>`;
}

/**
 * Get symbol type icon
 */
function getSymbolTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    function: 'λ',
    async_function: 'λ',
    class: '◇',
    method: '◈',
    interface: '△',
    variable: '•',
    constant: '⬡',
  };
  return icons[type] || '•';
}

/**
 * Get symbol type color
 */
function getSymbolTypeColor(type: string): string {
  const colors: Record<string, string> = {
    function: 'text-blue-500',
    async_function: 'text-blue-400',
    class: 'text-purple-500',
    method: 'text-purple-400',
    interface: 'text-teal-500',
    variable: 'text-gray-500',
    constant: 'text-amber-500',
  };
  return colors[type] || 'text-gray-500';
}

export function DocumentViewer({
  doc,
  content,
  symbols,
  isLoading = false,
  error = null,
  filePath,
}: DocumentViewerProps) {
  const { formatMessage } = useIntl();
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  // Copy deep link to clipboard
  const copyDeepLink = useCallback((symbolName: string, anchor: string) => {
    const url = new URL(window.location.href);
    if (filePath) {
      url.searchParams.set('file', filePath);
    }
    url.hash = anchor.replace('#', '');

    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedSymbol(symbolName);
      setTimeout(() => setCopiedSymbol(null), 2000);
    });
  }, [filePath]);

  // Parse HTML comments for symbol metadata
  const symbolSections = useMemo(() => {
    if (!content) return [];

    // Extract sections marked with deepwiki-symbol-start/end comments
    const regex = /<!-- deepwiki-symbol-start name="([^"]+)" type="([^"]+)" -->([\s\S]*?)<!-- deepwiki-symbol-end -->/g;
    const sections: Array<{ name: string; type: string; content: string }> = [];

    let match;
    while ((match = regex.exec(content)) !== null) {
      sections.push({
        name: match[1],
        type: match[2],
        content: match[3].trim(),
      });
    }

    // If no sections found, treat entire content as one section
    if (sections.length === 0 && content.trim()) {
      sections.push({
        name: 'Documentation',
        type: 'document',
        content: content.trim(),
      });
    }

    return sections;
  }, [content]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex-1 p-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-32 bg-muted rounded mt-6" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="flex-1 p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-destructive/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'deepwiki.viewer.error.title', defaultMessage: 'Error Loading Document' })}
        </h3>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </Card>
    );
  }

  // Empty state
  if (!doc && !content) {
    return (
      <Card className="flex-1 p-6 flex flex-col items-center justify-center text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'deepwiki.viewer.empty.title', defaultMessage: 'Select a File' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'deepwiki.viewer.empty.message', defaultMessage: 'Choose a file from the list to view its documentation' })}
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-mono text-sm" title={doc?.path}>
                {doc?.path?.split('/').pop() || 'Documentation'}
              </span>
            </h2>
            {doc && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {doc.generatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(doc.generatedAt).toLocaleString()}
                  </span>
                )}
                {doc.llmTool && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {doc.llmTool}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content area with TOC sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Symbols list */}
          {symbols.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {symbols.map(symbol => (
                <a
                  key={symbol.name}
                  href={`#${symbol.anchor.replace('#', '')}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                    'bg-muted/50 hover:bg-muted transition-colors',
                    getSymbolTypeColor(symbol.type)
                  )}
                >
                  <span>{getSymbolTypeIcon(symbol.type)}</span>
                  <span>{symbol.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1">
                    {symbol.type}
                  </Badge>
                </a>
              ))}
            </div>
          )}

          {/* Document sections */}
          <div className="space-y-6">
            {symbolSections.map((section, idx) => (
              <section
                key={`${section.name}-${idx}`}
                id={section.name.toLowerCase().replace(/\s+/g, '-')}
                className="scroll-mt-4"
              >
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(section.content) }}
                />
              </section>
            ))}

            {symbolSections.length === 0 && content && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
              />
            )}
          </div>
        </div>

        {/* Table of contents sidebar (if symbols exist) */}
        {symbols.length > 0 && (
          <div className="w-48 border-l border-border p-4 overflow-y-auto hidden lg:block">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Hash className="w-3 h-3" />
              {formatMessage({ id: 'deepwiki.viewer.toc', defaultMessage: 'Symbols' })}
            </h4>
            <nav className="space-y-1">
              {symbols.map(symbol => (
                <div
                  key={symbol.name}
                  className="group flex items-center gap-1"
                >
                  <a
                    href={`#${symbol.anchor.replace('#', '')}`}
                    className={cn(
                      'flex-1 text-xs py-1.5 px-2 rounded transition-colors',
                      'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      'font-mono'
                    )}
                  >
                    <span className={cn('mr-1', getSymbolTypeColor(symbol.type))}>
                      {getSymbolTypeIcon(symbol.type)}
                    </span>
                    {symbol.name}
                  </a>
                  <button
                    onClick={() => copyDeepLink(symbol.name, symbol.anchor)}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 p-1 rounded transition-all',
                      'hover:bg-muted/50',
                      copiedSymbol === symbol.name
                        ? 'text-green-500'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title={copiedSymbol === symbol.name ? 'Copied!' : 'Copy deep link'}
                  >
                    {copiedSymbol === symbol.name ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Link2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Styles for rendered markdown */}
      <style>{`
        .doc-content { line-height: 1.7; }
        .doc-paragraph { margin-bottom: 1rem; }
        .doc-h1 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 1rem; color: var(--foreground); }
        .doc-h2 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.75rem; color: var(--foreground); }
        .doc-h3 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.5rem; color: var(--foreground); }
        .doc-link { color: var(--primary); text-decoration: underline; }
        .inline-code {
          background: var(--muted);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.85em;
          font-family: ui-monospace, monospace;
        }
        .code-block {
          background: var(--muted);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
          font-family: ui-monospace, monospace;
          font-size: 0.85rem;
          line-height: 1.5;
        }
      `}</style>
    </Card>
  );
}

export default DocumentViewer;
