// ========================================
// TeamArtifacts Component
// ========================================
// Displays team artifacts with hybrid layout: tree navigation + file preview

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  FileJson,
  Package,
  Loader2,
} from 'lucide-react';
import { fetchTeamArtifacts, fetchArtifactContent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { ArtifactNode, ContentType } from '@/types/team';

// ========================================
// Types
// ========================================

interface TeamArtifactsProps {
  teamName: string;
}

// ========================================
// Helpers
// ========================================

function getContentTypeFromPath(path: string): ContentType {
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.txt') || path.endsWith('.log') || path.endsWith('.tsv') || path.endsWith('.csv')) return 'text';
  return 'unknown';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts?: string): string {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ========================================
// Sub-components
// ========================================

function FileIcon({ contentType }: { contentType?: ContentType }) {
  if (contentType === 'json') {
    return <FileJson className="w-4 h-4 text-blue-500" />;
  }
  return <FileText className="w-4 h-4 text-gray-500" />;
}

interface TreeNodeProps {
  node: ArtifactNode;
  depth: number;
  expanded: Set<string>;
  selectedPath?: string;
  onToggle: (path: string) => void;
  onSelect: (node: ArtifactNode) => void;
}

function TreeNode({
  node,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  if (node.type === 'directory') {
    const isExpanded = expanded.has(node.path);
    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-1 py-1.5 px-2 cursor-pointer hover:bg-accent/50 rounded transition-colors"
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => onToggle(node.path)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Folder
            className={cn(
              'w-4 h-4',
              isExpanded ? 'text-amber-500' : 'text-amber-400'
            )}
          />
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const isSelected = selectedPath === node.path;
  const contentType = node.contentType || getContentTypeFromPath(node.path);

  return (
    <div
      key={node.path}
      className={cn(
        'flex items-center gap-1 py-1.5 px-2 cursor-pointer hover:bg-accent/50 rounded transition-colors',
        isSelected && 'bg-accent'
      )}
      style={{ paddingLeft: depth * 16 + 28 }}
      onClick={() => onSelect(node)}
    >
      <FileIcon contentType={contentType} />
      <span className="text-sm truncate flex-1">{node.name}</span>
      {node.size !== undefined && (
        <span className="text-xs text-muted-foreground ml-2">
          {formatSize(node.size)}
        </span>
      )}
    </div>
  );
}

// ========================================
// Main Component
// ========================================

export function TeamArtifacts({ teamName }: TeamArtifactsProps) {
  const { formatMessage } = useIntl();
  const [tree, setTree] = React.useState<ArtifactNode[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = React.useState<ArtifactNode | null>(null);
  const [content, setContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [treeLoading, setTreeLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load artifacts tree
  React.useEffect(() => {
    if (!teamName) return;

    setTreeLoading(true);
    setError(null);

    fetchTeamArtifacts(teamName)
      .then((data) => {
        setTree(data.tree || []);
        // Auto-expand first level directories
        const firstLevelDirs = (data.tree || [])
          .filter((n) => n.type === 'directory')
          .map((n) => n.path);
        setExpanded(new Set(firstLevelDirs));
      })
      .catch((err) => {
        console.error('Failed to load artifacts:', err);
        setError(formatMessage({ id: 'team.artifacts.loadError', defaultMessage: 'Failed to load artifacts' }));
      })
      .finally(() => {
        setTreeLoading(false);
      });
  }, [teamName, formatMessage]);

  const handleToggle = React.useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = React.useCallback(
    async (node: ArtifactNode) => {
      if (node.type === 'directory') return;

      setSelectedFile(node);
      setLoading(true);
      setContent('');

      try {
        const result = await fetchArtifactContent(teamName, node.path);
        setContent(result.content);
      } catch (err) {
        console.error('Failed to load file content:', err);
        setContent(formatMessage({ id: 'team.artifacts.contentError', defaultMessage: 'Failed to load file content' }));
      } finally {
        setLoading(false);
      }
    },
    [teamName, formatMessage]
  );

  // Get content type for preview
  const previewContentType = selectedFile
    ? selectedFile.contentType || getContentTypeFromPath(selectedFile.path)
    : 'text';

  // Map to MarkdownModal content type
  const modalContentType: 'markdown' | 'json' | 'text' =
    previewContentType === 'json' ? 'json' : previewContentType === 'markdown' ? 'markdown' : 'text';

  // Loading state
  if (treeLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          {formatMessage({ id: 'team.artifacts.loading', defaultMessage: 'Loading artifacts...' })}
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-destructive mb-4" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Empty state
  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'team.artifacts.noArtifacts', defaultMessage: 'No artifacts yet' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'team.artifacts.emptyHint', defaultMessage: 'Artifacts will appear here when the team generates them' })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      {/* Left: Tree Navigation */}
      <div className="w-72 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {formatMessage({ id: 'team.artifacts.title', defaultMessage: 'Artifacts' })}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              selectedPath={selectedFile?.path}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* Right: File Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="p-3 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <FileIcon contentType={previewContentType} />
                <span className="text-sm font-medium truncate">
                  {selectedFile.name}
                </span>
                {selectedFile.size !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {formatSize(selectedFile.size)}
                  </span>
                )}
                {selectedFile.modifiedAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(selectedFile.modifiedAt)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PreviewContent
                  content={content}
                  contentType={modalContentType}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {formatMessage({ id: 'team.artifacts.selectFile', defaultMessage: 'Select a file to preview' })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// JSON Card Viewer
// ========================================

function JsonCardViewer({ data, depth = 0 }: { data: unknown; depth?: number }) {
  // Primitive values
  if (data === null) {
    return <span className="text-red-500 font-mono text-sm">null</span>;
  }
  if (data === undefined) {
    return <span className="text-muted-foreground font-mono text-sm">undefined</span>;
  }
  if (typeof data === 'boolean') {
    return (
      <span className={cn('font-mono text-sm', data ? 'text-orange-500' : 'text-red-500')}>
        {data ? 'true' : 'false'}
      </span>
    );
  }
  if (typeof data === 'number') {
    return <span className="text-blue-500 font-mono text-sm">{data}</span>;
  }
  if (typeof data === 'string') {
    // Check if it's a long string that should be truncated
    if (data.length > 200) {
      return (
        <span className="text-green-600 dark:text-green-400 font-mono text-sm break-all">
          "{data.slice(0, 200)}..."
        </span>
      );
    }
    return <span className="text-green-600 dark:text-green-400 font-mono text-sm">"{data}"</span>;
  }

  // Array
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground text-sm">[]</span>;
    }
    return (
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
              {index}
            </Badge>
            <div className="flex-1 min-w-0">
              {typeof item === 'object' && item !== null ? (
                <div className="bg-muted/30 rounded-lg p-2 border">
                  <JsonCardViewer data={item} depth={depth + 1} />
                </div>
              ) : (
                <JsonCardViewer data={item} depth={depth + 1} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Object
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <span className="text-muted-foreground text-sm">{'{}'}</span>;
    }

    return (
      <div className={cn('space-y-2', depth > 0 && 'pl-2 border-l-2 border-border')}>
        {entries.map(([key, value]) => {
          const isExpandable = typeof value === 'object' && value !== null;
          const isArray = Array.isArray(value);
          const itemCount = isArray ? value.length : isExpandable ? Object.keys(value).length : 0;

          return (
            <div key={key} className="group">
              <div className="flex items-center gap-2 py-1">
                <span className="text-purple-600 dark:text-purple-400 font-medium text-sm shrink-0">
                  {key}
                </span>
                {isExpandable && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {isArray ? `${itemCount} items` : `${itemCount} fields`}
                  </Badge>
                )}
              </div>
              <div className="ml-3">
                {isExpandable ? (
                  <div className="bg-muted/20 rounded-md p-2 border">
                    <JsonCardViewer data={value} depth={depth + 1} />
                  </div>
                ) : (
                  <JsonCardViewer data={value} depth={depth + 1} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-sm">{String(data)}</span>;
}

// ========================================
// JSON Summary Card
// ========================================

function JsonSummaryCard({ data }: { data: unknown }) {
  const stats = React.useMemo(() => {
    const result = {
      type: '',
      fields: 0,
      items: 0,
      depth: 0,
    };

    const analyze = (obj: unknown, currentDepth: number): void => {
      result.depth = Math.max(result.depth, currentDepth);

      if (Array.isArray(obj)) {
        result.type = 'Array';
        result.items = obj.length;
        obj.forEach(item => analyze(item, currentDepth + 1));
      } else if (typeof obj === 'object' && obj !== null) {
        result.type = 'Object';
        result.fields = Object.keys(obj).length;
        Object.values(obj).forEach(val => analyze(val, currentDepth + 1));
      }
    };

    analyze(data, 0);
    return result;
  }, [data]);

  return (
    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg mb-4 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{stats.type}</Badge>
      </div>
      {stats.type === 'Object' && (
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">{stats.fields}</span> fields
        </div>
      )}
      {stats.type === 'Array' && (
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">{stats.items}</span> items
        </div>
      )}
      <div className="text-muted-foreground">
        <span className="font-medium text-foreground">{stats.depth}</span> levels deep
      </div>
    </div>
  );
}

// ========================================
// Preview Content Component
// ========================================

function PreviewContent({
  content,
  contentType,
}: {
  content: string;
  contentType: 'markdown' | 'json' | 'text';
}) {
  if (!content) {
    return (
      <div className="text-muted-foreground text-sm">
        No content
      </div>
    );
  }

  if (contentType === 'json') {
    try {
      const parsed = JSON.parse(content);
      return (
        <div className="space-y-2">
          <JsonSummaryCard data={parsed} />
          <div className="bg-card rounded-lg">
            <JsonCardViewer data={parsed} />
          </div>
        </div>
      );
    } catch {
      return (
        <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto font-mono whitespace-pre-wrap break-words border">
          {content}
        </pre>
      );
    }
  }

  if (contentType === 'markdown') {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed bg-transparent p-0">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto font-mono whitespace-pre-wrap break-words border">
      {content}
    </pre>
  );
}

export default TeamArtifacts;
