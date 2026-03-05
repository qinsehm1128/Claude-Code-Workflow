// ========================================
// FileList Component
// ========================================
// List of documented files for DeepWiki

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { FileText, Search, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { DeepWikiFile } from '@/hooks/useDeepWiki';

export interface FileListProps {
  files: DeepWikiFile[];
  selectedPath: string | null;
  onSelectFile: (filePath: string) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  onRefresh?: () => void;
}

/**
 * Get relative file path from full path
 */
function getRelativePath(fullPath: string): string {
  // Try to extract a more readable path
  const parts = fullPath.replace(/\\/g, '/').split('/');
  const srcIndex = parts.findIndex(p => p === 'src');
  if (srcIndex >= 0) {
    return parts.slice(srcIndex).join('/');
  }
  // Return last 3 segments if path is long
  if (parts.length > 3) {
    return '.../' + parts.slice(-3).join('/');
  }
  return parts.join('/');
}

/**
 * Get file extension for icon coloring
 */
function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Get color class by file extension
 */
function getExtensionColor(ext: string): string {
  const colors: Record<string, string> = {
    ts: 'text-blue-500',
    tsx: 'text-blue-500',
    js: 'text-yellow-500',
    jsx: 'text-yellow-500',
    py: 'text-green-500',
    go: 'text-cyan-500',
    rs: 'text-orange-500',
    java: 'text-red-500',
    swift: 'text-orange-500',
  };
  return colors[ext] || 'text-gray-500';
}

export function FileList({
  files,
  selectedPath,
  onSelectFile,
  isLoading = false,
  isFetching = false,
  onRefresh,
}: FileListProps) {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(query));
  }, [files, searchQuery]);

  // Group files by directory
  const groupedFiles = useMemo(() => {
    const groups: Record<string, DeepWikiFile[]> = {};
    for (const file of filteredFiles) {
      const parts = file.path.replace(/\\/g, '/').split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
      if (!groups[dir]) {
        groups[dir] = [];
      }
      groups[dir].push(file);
    }
    return groups;
  }, [filteredFiles]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {formatMessage({ id: 'deepwiki.files.title', defaultMessage: 'Documented Files' })}
            <Badge variant="secondary" className="text-xs">
              {files.length}
            </Badge>
          </h3>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onRefresh()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'deepwiki.files.search', defaultMessage: 'Search files...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? formatMessage({ id: 'deepwiki.files.noResults', defaultMessage: 'No files match your search' })
                : formatMessage({ id: 'deepwiki.files.empty', defaultMessage: 'No documented files yet' })}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {Object.entries(groupedFiles).map(([dir, dirFiles]) => (
              <div key={dir}>
                {/* Directory header (collapsed for brevity) */}
                <div className="space-y-0.5">
                  {dirFiles.map(file => {
                    const ext = getFileExtension(file.path);
                    const extColor = getExtensionColor(ext);
                    const isSelected = selectedPath === file.path;

                    return (
                      <button
                        key={file.path}
                        onClick={() => onSelectFile(file.path)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                          'hover:bg-muted/70',
                          isSelected && 'bg-primary/10 border border-primary/30'
                        )}
                      >
                        <FileText className={cn('w-4 h-4 flex-shrink-0', extColor)} />
                        <span className="flex-1 text-sm truncate font-mono" title={file.path}>
                          {getRelativePath(file.path)}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {file.docsGenerated ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-yellow-500" />
                          )}
                          {file.symbolsCount > 0 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {file.symbolsCount}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default FileList;
