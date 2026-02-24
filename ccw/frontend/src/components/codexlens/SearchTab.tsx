// ========================================
// CodexLens Search Tab
// ========================================
// Semantic code search interface with multiple search types
// Includes LSP availability check and hybrid search mode switching

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Search, FileCode, Code, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  useCodexLensSearch,
  useCodexLensFilesSearch,
  useCodexLensSymbolSearch,
  useCodexLensLspStatus,
  useCodexLensSemanticSearch,
} from '@/hooks/useCodexLens';
import type {
  CodexLensSearchParams,
  CodexLensSemanticSearchMode,
  CodexLensFusionStrategy,
  CodexLensStagedStage2Mode,
} from '@/lib/api';
import { cn } from '@/lib/utils';

type SearchType = 'search' | 'search_files' | 'symbol' | 'semantic';
type SearchMode = 'dense_rerank' | 'fts' | 'fuzzy';

interface SearchTabProps {
  enabled: boolean;
}

export function SearchTab({ enabled }: SearchTabProps) {
  const { formatMessage } = useIntl();
  const [searchType, setSearchType] = useState<SearchType>('search');
  const [searchMode, setSearchMode] = useState<SearchMode>('dense_rerank');
  const [semanticMode, setSemanticMode] = useState<CodexLensSemanticSearchMode>('fusion');
  const [fusionStrategy, setFusionStrategy] = useState<CodexLensFusionStrategy>('rrf');
  const [stagedStage2Mode, setStagedStage2Mode] = useState<CodexLensStagedStage2Mode>('precomputed');
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // LSP status check
  const lspStatus = useCodexLensLspStatus({ enabled });

  // Build search params based on search type
  const searchParams: CodexLensSearchParams = {
    query,
    limit: 20,
    mode: searchType !== 'symbol' && searchType !== 'semantic' ? searchMode : undefined,
    max_content_length: 200,
    extra_files_count: 10,
  };

  // Search hooks - only enable when hasSearched is true and query is not empty
  const contentSearch = useCodexLensSearch(
    searchParams,
    { enabled: enabled && hasSearched && searchType === 'search' && query.trim().length > 0 }
  );

  const fileSearch = useCodexLensFilesSearch(
    searchParams,
    { enabled: enabled && hasSearched && searchType === 'search_files' && query.trim().length > 0 }
  );

  const symbolSearch = useCodexLensSymbolSearch(
    { query, limit: 20 },
    { enabled: enabled && hasSearched && searchType === 'symbol' && query.trim().length > 0 }
  );

  const semanticSearch = useCodexLensSemanticSearch(
    {
      query,
      mode: semanticMode,
      fusion_strategy: semanticMode === 'fusion' ? fusionStrategy : undefined,
      staged_stage2_mode: semanticMode === 'fusion' && fusionStrategy === 'staged' ? stagedStage2Mode : undefined,
      limit: 20,
      include_match_reason: true,
    },
    { enabled: enabled && hasSearched && searchType === 'semantic' && query.trim().length > 0 }
  );

  // Get loading state based on search type
  const isLoading = searchType === 'search'
    ? contentSearch.isLoading
    : searchType === 'search_files'
      ? fileSearch.isLoading
      : searchType === 'symbol'
        ? symbolSearch.isLoading
        : semanticSearch.isLoading;

  const handleSearch = () => {
    if (query.trim()) {
      setHasSearched(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSearchTypeChange = (value: SearchType) => {
    setSearchType(value);
    setHasSearched(false);
  };

  const handleSearchModeChange = (value: SearchMode) => {
    setSearchMode(value);
    setHasSearched(false);
  };

  const handleSemanticModeChange = (value: CodexLensSemanticSearchMode) => {
    setSemanticMode(value);
    setHasSearched(false);
  };

  const handleFusionStrategyChange = (value: CodexLensFusionStrategy) => {
    setFusionStrategy(value);
    setHasSearched(false);
  };

  const handleStagedStage2ModeChange = (value: CodexLensStagedStage2Mode) => {
    setStagedStage2Mode(value);
    setHasSearched(false);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setHasSearched(false);
  };

  // Get result count for display
  const getResultCount = (): string => {
    if (searchType === 'symbol') {
      return symbolSearch.data?.success
        ? `${symbolSearch.data.symbols?.length ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
        : '';
    }
    if (searchType === 'search') {
      return contentSearch.data?.success
        ? `${contentSearch.data.results?.length ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
        : '';
    }
    if (searchType === 'search_files') {
      return fileSearch.data?.success
        ? `${fileSearch.data.files?.length ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
        : '';
    }
    if (searchType === 'semantic') {
      return semanticSearch.data?.success
        ? `${semanticSearch.data.count ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
        : '';
    }
    return '';
  };

  if (!enabled) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {formatMessage({ id: 'codexlens.search.notInstalled.title' })}
          </h3>
          <p className="text-muted-foreground">
            {formatMessage({ id: 'codexlens.search.notInstalled.description' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* LSP Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{formatMessage({ id: 'codexlens.search.lspStatus' })}:</span>
        {lspStatus.isLoading ? (
          <span className="text-muted-foreground">...</span>
        ) : lspStatus.available ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            {formatMessage({ id: 'codexlens.search.lspAvailable' })}
          </span>
        ) : !lspStatus.semanticAvailable ? (
          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {formatMessage({ id: 'codexlens.search.lspNoSemantic' })}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {formatMessage({ id: 'codexlens.search.lspNoVector' })}
          </span>
        )}
      </div>

      {/* Search Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Type */}
        <div className="space-y-2">
          <Label>{formatMessage({ id: 'codexlens.search.type' })}</Label>
          <Select value={searchType} onValueChange={handleSearchTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="search">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.content' })}
                </div>
              </SelectItem>
              <SelectItem value="search_files">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.files' })}
                </div>
              </SelectItem>
              <SelectItem value="symbol">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.symbol' })}
                </div>
              </SelectItem>
              <SelectItem value="semantic" disabled={!lspStatus.available}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.semantic' })}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search Mode - for CLI search types (content / file) */}
        {(searchType === 'search' || searchType === 'search_files') && (
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'codexlens.search.mode' })}</Label>
            <Select value={searchMode} onValueChange={handleSearchModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dense_rerank">
                  {formatMessage({ id: 'codexlens.search.mode.semantic' })}
                </SelectItem>
                <SelectItem value="fts">
                  {formatMessage({ id: 'codexlens.search.mode.exact' })}
                </SelectItem>
                <SelectItem value="fuzzy">
                  {formatMessage({ id: 'codexlens.search.mode.fuzzy' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Semantic Search Mode - for semantic search type */}
        {searchType === 'semantic' && (
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'codexlens.search.semanticMode' })}</Label>
            <Select value={semanticMode} onValueChange={handleSemanticModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fusion">
                  {formatMessage({ id: 'codexlens.search.semanticMode.fusion' })}
                </SelectItem>
                <SelectItem value="vector">
                  {formatMessage({ id: 'codexlens.search.semanticMode.vector' })}
                </SelectItem>
                <SelectItem value="structural">
                  {formatMessage({ id: 'codexlens.search.semanticMode.structural' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Fusion Strategy - only when semantic + fusion mode */}
      {searchType === 'semantic' && semanticMode === 'fusion' && (
        <div className="space-y-2">
          <Label>{formatMessage({ id: 'codexlens.search.fusionStrategy' })}</Label>
          <Select value={fusionStrategy} onValueChange={handleFusionStrategyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rrf">
                {formatMessage({ id: 'codexlens.search.fusionStrategy.rrf' })}
              </SelectItem>
              <SelectItem value="dense_rerank">
                {formatMessage({ id: 'codexlens.search.fusionStrategy.dense_rerank' })}
              </SelectItem>
              <SelectItem value="binary">
                {formatMessage({ id: 'codexlens.search.fusionStrategy.binary' })}
              </SelectItem>
              <SelectItem value="hybrid">
                {formatMessage({ id: 'codexlens.search.fusionStrategy.hybrid' })}
              </SelectItem>
              <SelectItem value="staged">
                {formatMessage({ id: 'codexlens.search.fusionStrategy.staged' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Staged Stage-2 Mode - only when semantic + fusion + staged */}
      {searchType === 'semantic' && semanticMode === 'fusion' && fusionStrategy === 'staged' && (
        <div className="space-y-2">
          <Label>{formatMessage({ id: 'codexlens.search.stagedStage2Mode' })}</Label>
          <Select value={stagedStage2Mode} onValueChange={handleStagedStage2ModeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="precomputed">
                {formatMessage({ id: 'codexlens.search.stagedStage2Mode.precomputed' })}
              </SelectItem>
              <SelectItem value="realtime">
                {formatMessage({ id: 'codexlens.search.stagedStage2Mode.realtime' })}
              </SelectItem>
              <SelectItem value="static_global_graph">
                {formatMessage({ id: 'codexlens.search.stagedStage2Mode.static_global_graph' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Query Input */}
      <div className="space-y-2">
        <Label htmlFor="search-query">{formatMessage({ id: 'codexlens.search.query' })}</Label>
        <Input
          id="search-query"
          placeholder={formatMessage({ id: 'codexlens.search.queryPlaceholder' })}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
      </div>

      {/* Search Button */}
      <Button
        onClick={handleSearch}
        disabled={!query.trim() || isLoading}
        className="w-full"
      >
        <Search className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
        {isLoading
          ? formatMessage({ id: 'codexlens.search.searching' })
          : formatMessage({ id: 'codexlens.search.button' })
        }
      </Button>

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {formatMessage({ id: 'codexlens.search.results' })}
            </h3>
            <span className="text-xs text-muted-foreground">
              {getResultCount()}
            </span>
          </div>

          {searchType === 'symbol' && symbolSearch.data && (
            symbolSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(symbolSearch.data.symbols, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {symbolSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}

          {searchType === 'search' && contentSearch.data && (
            contentSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(contentSearch.data.results, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {contentSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}

          {searchType === 'search_files' && fileSearch.data && (
            fileSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(fileSearch.data.files, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {fileSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}

          {searchType === 'semantic' && semanticSearch.data && (
            semanticSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(semanticSearch.data.results, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {semanticSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default SearchTab;
