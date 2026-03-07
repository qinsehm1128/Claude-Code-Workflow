// ========================================
// DeepWiki Page
// ========================================
// Documentation deep-linking page with file browser and document viewer

import { useState, useEffect, useRef, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, RefreshCw, FileText, Hash, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { FileList } from '@/components/deepwiki/FileList';
import { DocumentViewer } from '@/components/deepwiki/DocumentViewer';
import {
  useDeepWikiFiles,
  useDeepWikiDoc,
  useDeepWikiStats,
  useDeepWikiSearch,
} from '@/hooks/useDeepWiki';
import { cn } from '@/lib/utils';

type ActiveTab = 'documents' | 'index' | 'stats';

/**
 * Stats card component
 */
function StatsCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

export function DeepWikiPage() {
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollAttemptedRef = useRef(false);

  // Get file from URL query parameter
  const fileParam = searchParams.get('file');
  const hashParam = window.location.hash.slice(1); // Remove leading #

  const [selectedFile, setSelectedFile] = useState<string | null>(fileParam);

  // Data hooks
  const {
    files,
    isLoading: filesLoading,
    isFetching: filesFetching,
    refetch: refetchFiles,
  } = useDeepWikiFiles();

  const {
    stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useDeepWikiStats();

  const {
    doc,
    content,
    symbols,
    isLoading: docLoading,
    error: docError,
  } = useDeepWikiDoc(selectedFile);

  const {
    symbols: searchResults,
    isLoading: searchLoading,
  } = useDeepWikiSearch(searchQuery, { enabled: activeTab === 'index' });

  // Handle file selection with URL sync
  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFile(filePath);
    setSearchParams({ file: filePath });
    scrollAttemptedRef.current = false; // Reset scroll flag for new file
  }, [setSearchParams]);

  // Scroll to symbol anchor when content loads
  useEffect(() => {
    if (hashParam && content && !docLoading && !scrollAttemptedRef.current) {
      scrollAttemptedRef.current = true;
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        const element = document.getElementById(hashParam);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [hashParam, content, docLoading]);

  // Refresh all data
  const handleRefresh = () => {
    refetchFiles();
    refetchStats();
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'deepwiki.title', defaultMessage: 'DeepWiki' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'deepwiki.description', defaultMessage: 'Code documentation with deep-linking to source symbols' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={filesFetching}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', filesFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh', defaultMessage: 'Refresh' })}
          </Button>
        </div>
      </div>

      {/* Tabbed Interface */}
      <TabsNavigation
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ActiveTab)}
        tabs={[
          { value: 'documents', label: formatMessage({ id: 'deepwiki.tabs.documents', defaultMessage: 'Documents' }) },
          { value: 'index', label: formatMessage({ id: 'deepwiki.tabs.index', defaultMessage: 'Symbol Index' }) },
          { value: 'stats', label: formatMessage({ id: 'deepwiki.tabs.stats', defaultMessage: 'Statistics' }) },
        ]}
      />

      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* File List Sidebar */}
          <div className="w-80 flex-shrink-0">
            <FileList
              files={files}
              selectedPath={selectedFile}
              onSelectFile={handleSelectFile}
              isLoading={filesLoading}
              isFetching={filesFetching}
              onRefresh={() => refetchFiles()}
            />
          </div>

          {/* Document Viewer */}
          <DocumentViewer
            doc={doc}
            content={content}
            symbols={symbols}
            isLoading={docLoading}
            error={docError}
            filePath={selectedFile ?? undefined}
          />
        </div>
      )}

      {/* Tab Content: Symbol Index */}
      {activeTab === 'index' && (
        <div className="flex-1 overflow-y-auto">
          <Card className="p-4 h-full flex flex-col">
            {/* Search input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder={formatMessage({ id: 'deepwiki.index.search', defaultMessage: 'Search symbols...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Search results */}
            {searchLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2">
                {searchResults.map(symbol => (
                  <button
                    key={`${symbol.name}-${symbol.sourceFile}`}
                    onClick={() => {
                      setSelectedFile(symbol.sourceFile);
                      setActiveTab('documents');
                    }}
                    className="w-full p-3 rounded-md border border-border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">{symbol.name}</span>
                      <Badge variant="outline" className="text-xs">{symbol.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                      {symbol.sourceFile}:{symbol.lineRange[0]}-{symbol.lineRange[1]}
                    </p>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Hash className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {formatMessage({ id: 'deepwiki.index.noResults', defaultMessage: 'No symbols found' })}
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Hash className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {formatMessage({ id: 'deepwiki.index.placeholder', defaultMessage: 'Enter a search query to find symbols' })}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab Content: Statistics */}
      {activeTab === 'stats' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {statsLoading ? (
            <Card className="p-6">
              <div className="space-y-4 animate-pulse">
                <div className="h-20 bg-muted rounded" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 bg-muted rounded" />
                  <div className="h-24 bg-muted rounded" />
                  <div className="h-24 bg-muted rounded" />
                  <div className="h-24 bg-muted rounded" />
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Status card */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full',
                        stats?.available ? 'bg-green-500' : 'bg-red-500'
                      )}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {stats?.available
                        ? formatMessage({ id: 'deepwiki.stats.available', defaultMessage: 'Database Connected' })
                        : formatMessage({ id: 'deepwiki.stats.unavailable', defaultMessage: 'Database Not Available' })}
                    </span>
                  </div>
                  {stats?.dbPath && (
                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {stats.dbPath}
                    </code>
                  )}
                </div>
              </Card>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard
                  label={formatMessage({ id: 'deepwiki.stats.files', defaultMessage: 'Files' })}
                  value={stats?.files ?? 0}
                  icon={FileText}
                  color="bg-blue-500/10 text-blue-500"
                />
                <StatsCard
                  label={formatMessage({ id: 'deepwiki.stats.symbols', defaultMessage: 'Symbols' })}
                  value={stats?.symbols ?? 0}
                  icon={Hash}
                  color="bg-purple-500/10 text-purple-500"
                />
                <StatsCard
                  label={formatMessage({ id: 'deepwiki.stats.docs', defaultMessage: 'Documents' })}
                  value={stats?.docs ?? 0}
                  icon={BookOpen}
                  color="bg-green-500/10 text-green-500"
                />
                <StatsCard
                  label={formatMessage({ id: 'deepwiki.stats.needingDocs', defaultMessage: 'Need Docs' })}
                  value={stats?.filesNeedingDocs ?? 0}
                  icon={BarChart3}
                  color="bg-amber-500/10 text-amber-500"
                />
              </div>

              {/* Help text */}
              <Card className="p-4">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  {formatMessage({ id: 'deepwiki.stats.howTo.title', defaultMessage: 'Documentation Index' })}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatMessage({ id: 'deepwiki.stats.howTo.description', defaultMessage: 'DeepWiki automatically indexes symbols and documentation from code. Currently in read-only mode.' })}
                </p>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DeepWikiPage;
