// ========================================
// DocumentViewer Component
// ========================================
// Displays DeepWiki documentation content with table of contents

import { useMemo, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { FileText, Hash, Clock, Sparkles, AlertCircle, Link2, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
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
 * Get symbol type icon
 */
function getSymbolTypeIcon(type: string): { symbol: string; label: string } {
  const icons: Record<string, { symbol: string; label: string }> = {
    function: { symbol: 'λ', label: 'Function' },
    async_function: { symbol: 'λ', label: 'Async Function' },
    class: { symbol: '◇', label: 'Class' },
    method: { symbol: '◈', label: 'Method' },
    interface: { symbol: '△', label: 'Interface' },
    variable: { symbol: '•', label: 'Variable' },
    constant: { symbol: '⬡', label: 'Constant' },
  };
  return icons[type] || { symbol: '•', label: 'Symbol' };
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

/**
 * Markdown components with custom styling
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={cn('block bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto', className)}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted p-4 rounded-lg my-4 overflow-x-auto">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border border-border">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border px-3 py-2 text-left font-medium">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-3 py-2">{children}</td>
  ),
};

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
              {symbols.map(symbol => {
                const iconInfo = getSymbolTypeIcon(symbol.type);
                return (
                  <a
                    key={symbol.name}
                    href={`#${symbol.anchor.replace('#', '')}`}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                      'bg-muted/50 hover:bg-muted transition-colors',
                      getSymbolTypeColor(symbol.type)
                    )}
                    aria-label={`${iconInfo.label}: ${symbol.name}`}
                  >
                    <span aria-hidden="true">{iconInfo.symbol}</span>
                    <span>{symbol.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {symbol.type}
                    </Badge>
                  </a>
                );
              })}
            </div>
          )}

          {/* Document sections with safe markdown rendering */}
          <div className="space-y-6">
            {symbolSections.map((section, idx) => (
              <section
                key={`${section.name}-${idx}`}
                id={section.name.toLowerCase().replace(/\s+/g, '-')}
                className="scroll-mt-4"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={markdownComponents}
                >
                  {section.content}
                </ReactMarkdown>
              </section>
            ))}

            {symbolSections.length === 0 && content && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
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
            <nav className="space-y-1" role="list" aria-label="Document symbols">
              {symbols.map(symbol => {
                const iconInfo = getSymbolTypeIcon(symbol.type);
                return (
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
                      role="listitem"
                      aria-label={`${iconInfo.label}: ${symbol.name}`}
                    >
                      <span className={cn('mr-1', getSymbolTypeColor(symbol.type))} aria-hidden="true">
                        {iconInfo.symbol}
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
                      aria-label={
                        copiedSymbol === symbol.name
                          ? formatMessage({ id: 'deepwiki.viewer.linkCopied', defaultMessage: 'Link copied' })
                          : formatMessage({ id: 'deepwiki.viewer.copyLink', defaultMessage: 'Copy deep link to {name}' }, { name: symbol.name })
                      }
                    >
                      {copiedSymbol === symbol.name ? (
                        <Check className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <Link2 className="w-3 h-3" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </Card>
  );
}

export default DocumentViewer;
