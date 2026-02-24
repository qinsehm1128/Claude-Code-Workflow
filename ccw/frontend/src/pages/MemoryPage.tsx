// ========================================
// Memory Page
// ========================================
// View and manage core memory and context with CRUD operations
// Includes unified vector search across all memory categories

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import {
  Brain,
  Search,
  Plus,
  Database,
  FileText,
  RefreshCw,
  Trash2,
  Edit,
  Tag,
  Loader2,
  Copy,
  Star,
  Archive,
  ArchiveRestore,
  AlertCircle,
  Layers,
  Zap,
  Terminal,
  GitBranch,
  Hash,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Checkbox } from '@/components/ui/Checkbox';
import { useMemory, useMemoryMutations, useUnifiedSearch, useUnifiedStats, useRecommendations, useReindex } from '@/hooks';
import type { CoreMemory, UnifiedSearchResult } from '@/lib/api';
import { cn, parseMemoryMetadata } from '@/lib/utils';

// ========== Source Type Helpers ==========

const SOURCE_TYPE_COLORS: Record<string, string> = {
  core_memory: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cli_history: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  workflow: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  entity: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  pattern: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
};

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  core_memory: <Brain className="w-3 h-3" />,
  cli_history: <Terminal className="w-3 h-3" />,
  workflow: <GitBranch className="w-3 h-3" />,
  entity: <Hash className="w-3 h-3" />,
  pattern: <Layers className="w-3 h-3" />,
};

function SourceTypeBadge({ sourceType }: { sourceType: string }) {
  const colorClass = SOURCE_TYPE_COLORS[sourceType] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  const icon = SOURCE_TYPE_ICONS[sourceType] || <Database className="w-3 h-3" />;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', colorClass)}>
      {icon}
      {sourceType}
    </span>
  );
}

// ========== Memory Card Component ==========

interface MemoryCardProps {
  memory: CoreMemory;
  onView: (memory: CoreMemory) => void;
  onEdit: (memory: CoreMemory) => void;
  onDelete: (memory: CoreMemory) => void;
  onCopy: (content: string) => void;
  onToggleFavorite: (memory: CoreMemory) => void;
  onArchive: (memory: CoreMemory) => void;
  onUnarchive: (memory: CoreMemory) => void;
}

function MemoryCard({ memory, onView, onEdit, onDelete, onCopy, onToggleFavorite, onArchive, onUnarchive }: MemoryCardProps) {
  const formattedDate = new Date(memory.createdAt).toLocaleDateString();

  // Parse metadata from memory
  const metadata = parseMemoryMetadata(memory.metadata);
  const isFavorite = metadata.favorite === true;
  const priority = metadata.priority || 'medium';
  const isArchived = memory.archived || false;
  const formattedSize = memory.size
    ? memory.size < 1024
      ? `${memory.size} B`
      : `${(memory.size / 1024).toFixed(1)} KB`
    : 'Unknown';

  return (
    <Card className="overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => onView(memory)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {memory.id}
                </span>
                {memory.source && (
                  <Badge variant="outline" className="text-xs">
                    {memory.source}
                  </Badge>
                )}
                {priority !== 'medium' && (
                  <Badge variant={priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                    {priority}
                  </Badge>
                )}
                {isArchived && (
                  <Badge variant="secondary" className="text-xs">
                    Archived
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formattedDate} - {formattedSize}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 w-8 p-0", isFavorite && "text-yellow-500")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(memory);
              }}
            >
              <Star className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(memory.content);
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(memory);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            {!isArchived ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(memory);
                }}
              >
                <Archive className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnarchive(memory);
                }}
              >
                <ArchiveRestore className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(memory);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {memory.content}
        </p>

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {memory.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {memory.tags.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{memory.tags.length - 5}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ========== Unified Search Result Card ==========

interface UnifiedResultCardProps {
  result: UnifiedSearchResult;
  onCopy: (content: string) => void;
}

function UnifiedResultCard({ result, onCopy }: UnifiedResultCardProps) {
  const { formatMessage } = useIntl();
  const scorePercent = (result.score * 100).toFixed(1);

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <SourceTypeBadge sourceType={result.source_type} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">
                  {result.source_id}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatMessage({ id: 'memory.unified.score' })}: {scorePercent}%
                </Badge>
              </div>
              {/* Rank sources */}
              <div className="flex items-center gap-2 mt-1">
                {result.rank_sources.vector_rank != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'memory.unified.vectorRank' }, { rank: result.rank_sources.vector_rank })}
                  </span>
                )}
                {result.rank_sources.fts_rank != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'memory.unified.ftsRank' }, { rank: result.rank_sources.fts_rank })}
                  </span>
                )}
                {result.rank_sources.heat_score != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'memory.unified.heatScore' }, { score: result.rank_sources.heat_score.toFixed(2) })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => onCopy(result.content)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>

        {/* Content preview */}
        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
          {result.content}
        </p>
      </div>
    </Card>
  );
}

// ========== Recommendations Panel ==========

interface RecommendationsPanelProps {
  memoryId: string;
  onCopy: (content: string) => void;
}

function RecommendationsPanel({ memoryId, onCopy }: RecommendationsPanelProps) {
  const { formatMessage } = useIntl();
  const { recommendations, isLoading } = useRecommendations({
    memoryId,
    limit: 5,
    enabled: !!memoryId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{formatMessage({ id: 'memory.unified.searching' })}</span>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {formatMessage({ id: 'memory.unified.noRecommendations' })}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => (
        <div
          key={rec.source_id}
          className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <SourceTypeBadge sourceType={rec.source_type} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground truncate">
                {rec.source_id}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {(rec.score * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {rec.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => onCopy(rec.content)}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ========== View Memory Dialog ==========

interface ViewMemoryDialogProps {
  memory: CoreMemory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (memory: CoreMemory) => void;
  onCopy: (content: string) => void;
}

function ViewMemoryDialog({ memory, open, onOpenChange, onEdit, onCopy }: ViewMemoryDialogProps) {
  const { formatMessage } = useIntl();
  if (!memory) return null;

  const metadata = parseMemoryMetadata(memory.metadata);
  const priority = metadata.priority || 'medium';
  const formattedDate = new Date(memory.createdAt).toLocaleDateString();
  const formattedSize = memory.size
    ? memory.size < 1024
      ? `${memory.size} B`
      : `${(memory.size / 1024).toFixed(1)} KB`
    : 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {memory.id}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            {memory.source && (
              <Badge variant="outline" className="text-xs">
                {memory.source}
              </Badge>
            )}
            {priority !== 'medium' && (
              <Badge variant={priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                {priority}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formattedDate} - {formattedSize}
            </span>
          </div>
        </DialogHeader>

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {memory.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto mt-2">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg">
            {memory.content}
          </pre>
        </div>

        {/* Recommendations */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            {formatMessage({ id: 'memory.unified.recommendations' })}
          </h4>
          <RecommendationsPanel memoryId={memory.id} onCopy={onCopy} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onCopy(memory.content)}>
            <Copy className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'memory.actions.copy' })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit(memory); }}>
            <Edit className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'memory.actions.edit' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== New Memory Dialog ==========

interface NewMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { content: string; tags?: string[]; metadata?: Record<string, any> }) => void;
  isCreating: boolean;
  editingMemory?: CoreMemory | null;
}

function NewMemoryDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
  editingMemory,
}: NewMemoryDialogProps) {
  const { formatMessage } = useIntl();
  const [content, setContent] = useState(editingMemory?.content || '');
  const [tagsInput, setTagsInput] = useState(editingMemory?.tags?.join(', ') || '');
  const [isFavorite, setIsFavorite] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Initialize from editing memory metadata
  useEffect(() => {
    if (editingMemory) {
      // Sync content and tags
      setContent(editingMemory.content || '');
      setTagsInput(editingMemory.tags?.join(', ') || '');

      // Sync metadata
      const metadata = parseMemoryMetadata(editingMemory.metadata);
      setIsFavorite(metadata.favorite === true);
      setPriority(metadata.priority || 'medium');
    } else {
      // New mode: reset all state
      setContent('');
      setTagsInput('');
      setIsFavorite(false);
      setPriority('medium');
    }
  }, [editingMemory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // Build metadata object
      const metadata: Record<string, any> = {};
      if (isFavorite) metadata.favorite = true;
      if (priority !== 'medium') metadata.priority = priority;

      onSubmit({
        content: content.trim(),
        tags: tags.length > 0 ? tags : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
      setContent('');
      setTagsInput('');
      setIsFavorite(false);
      setPriority('medium');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingMemory ? formatMessage({ id: 'memory.createDialog.editTitle' }) : formatMessage({ id: 'memory.createDialog.title' })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'memory.createDialog.labels.content' })}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={formatMessage({ id: 'memory.createDialog.placeholders.content' })}
              className="mt-1 w-full min-h-[200px] p-3 bg-background border border-input rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'memory.createDialog.labels.tags' })}</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={formatMessage({ id: 'memory.createDialog.placeholders.tags' })}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="favorite"
                checked={isFavorite}
                onCheckedChange={(checked) => setIsFavorite(checked === true)}
              />
              <label htmlFor="favorite" className="text-sm font-medium cursor-pointer">
                {formatMessage({ id: 'memory.createDialog.labels.favorite' })}
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">{formatMessage({ id: 'memory.createDialog.labels.priority' })}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="mt-1 w-full p-2 bg-background border border-input rounded-md text-sm"
              >
                <option value="low">{formatMessage({ id: 'memory.priority.low' })}</option>
                <option value="medium">{formatMessage({ id: 'memory.priority.medium' })}</option>
                <option value="high">{formatMessage({ id: 'memory.priority.high' })}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage({ id: 'memory.createDialog.buttons.cancel' })}
            </Button>
            <Button type="submit" disabled={isCreating || !content.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingMemory ? formatMessage({ id: 'memory.createDialog.buttons.updating' }) : formatMessage({ id: 'memory.createDialog.buttons.creating' })}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {editingMemory ? formatMessage({ id: 'memory.createDialog.buttons.update' }) : formatMessage({ id: 'memory.createDialog.buttons.create' })}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Category Filter ==========

const CATEGORY_OPTIONS = [
  { value: '', labelId: 'memory.filters.categoryAll' },
  { value: 'core_memory', labelId: 'memory.filters.categoryCoreMemory' },
  { value: 'cli_history', labelId: 'memory.filters.categoryCliHistory' },
  { value: 'workflow', labelId: 'memory.filters.categoryWorkflow' },
  { value: 'entity', labelId: 'memory.filters.categoryEntity' },
  { value: 'pattern', labelId: 'memory.filters.categoryPattern' },
];

// ========== Main Page Component ==========

export function MemoryPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isNewMemoryOpen, setIsNewMemoryOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<CoreMemory | null>(null);
  const [viewingMemory, setViewingMemory] = useState<CoreMemory | null>(null);
  const [currentTab, setCurrentTab] = useState<'memories' | 'favorites' | 'archived' | 'unifiedSearch'>('memories');
  const [unifiedQuery, setUnifiedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  const isUnifiedTab = currentTab === 'unifiedSearch';

  // Build filter based on current tab (for non-unified tabs)
  const favoriteFilter = currentTab === 'favorites' ? { favorite: true } : undefined;
  const archivedFilter = currentTab === 'archived' ? { archived: true } : { archived: false };

  const {
    memories,
    totalSize,
    claudeMdCount,
    allTags,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMemory({
    filter: {
      search: searchQuery || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      ...favoriteFilter,
      ...archivedFilter,
    },
    enabled: !isUnifiedTab,
  });

  // Unified search
  const {
    results: unifiedResults,
    total: unifiedTotal,
    isLoading: unifiedLoading,
    isFetching: unifiedFetching,
    error: unifiedError,
    refetch: refetchUnified,
  } = useUnifiedSearch({
    query: unifiedQuery,
    categories: selectedCategory || undefined,
    topK: 20,
    enabled: isUnifiedTab && unifiedQuery.trim().length > 0,
  });

  // Unified stats
  const {
    stats: unifiedStats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useUnifiedStats();

  // Reindex mutation
  const { reindex, isReindexing } = useReindex();

  const { createMemory, updateMemory, deleteMemory, archiveMemory, unarchiveMemory, isCreating, isUpdating } =
    useMemoryMutations();

  const handleCreateMemory = async (data: { content: string; tags?: string[]; metadata?: Record<string, any> }) => {
    if (editingMemory) {
      await updateMemory(editingMemory.id, data);
      setEditingMemory(null);
    } else {
      await createMemory(data);
    }
    setIsNewMemoryOpen(false);
  };

  const handleEdit = (memory: CoreMemory) => {
    setEditingMemory(memory);
    setIsNewMemoryOpen(true);
  };

  const handleDelete = async (memory: CoreMemory) => {
    if (confirm(`Delete memory "${memory.id}"?`)) {
      await deleteMemory(memory.id);
    }
  };

  const handleToggleFavorite = async (memory: CoreMemory) => {
    try {
      const currentMetadata = parseMemoryMetadata(memory.metadata);
      const newFavorite = !(currentMetadata.favorite === true);
      await updateMemory(memory.id, {
        content: memory.content,
        metadata: { ...currentMetadata, favorite: newFavorite },
      });
      toast.success(
        formatMessage({
          id: newFavorite ? 'memory.actions.favoriteAdded' : 'memory.actions.favoriteRemoved',
        })
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast.error(formatMessage({ id: 'memory.actions.favoriteError' }));
    }
  };

  const handleArchive = async (memory: CoreMemory) => {
    try {
      await archiveMemory(memory.id);
      toast.success(formatMessage({ id: 'memory.actions.archiveSuccess' }));
    } catch (err) {
      console.error('Failed to archive:', err);
      toast.error(formatMessage({ id: 'memory.actions.archiveError' }));
    }
  };

  const handleUnarchive = async (memory: CoreMemory) => {
    try {
      await unarchiveMemory(memory.id);
      toast.success(formatMessage({ id: 'memory.actions.unarchiveSuccess' }));
    } catch (err) {
      console.error('Failed to unarchive:', err);
      toast.error(formatMessage({ id: 'memory.actions.unarchiveError' }));
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(formatMessage({ id: 'memory.actions.copySuccess' }));
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error(formatMessage({ id: 'memory.actions.copyError' }));
    }
  };

  const handleReindex = async () => {
    try {
      await reindex();
      toast.success(formatMessage({ id: 'memory.unified.reindexSuccess' }));
      refetchStats();
    } catch (err) {
      console.error('Failed to reindex:', err);
      toast.error(formatMessage({ id: 'memory.unified.reindexError' }));
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const formattedTotalSize = totalSize < 1024
    ? `${totalSize} B`
    : totalSize < 1024 * 1024
      ? `${(totalSize / 1024).toFixed(1)} KB`
      : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;

  const handleRefresh = () => {
    if (isUnifiedTab) {
      refetchUnified();
      refetchStats();
    } else {
      refetch();
    }
  };

  const isRefreshing = isUnifiedTab ? unifiedFetching : isFetching;
  const activeError = isUnifiedTab ? unifiedError : error;

  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'memory.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'memory.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleImmersiveMode}
            className={cn(
              'p-2 rounded-md transition-colors',
              isImmersiveMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={isImmersiveMode ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isImmersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {isUnifiedTab && (
            <Button
              variant="outline"
              onClick={handleReindex}
              disabled={isReindexing}
            >
              {isReindexing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {formatMessage({ id: isReindexing ? 'memory.unified.reindexing' : 'memory.unified.reindex' })}
            </Button>
          )}
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          {!isUnifiedTab && (
            <Button onClick={() => { setEditingMemory(null); setIsNewMemoryOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'memory.actions.add' })}
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <TabsNavigation
        value={currentTab}
        onValueChange={(v) => setCurrentTab(v as typeof currentTab)}
        tabs={[
          {
            value: 'memories',
            label: formatMessage({ id: 'memory.tabs.memories' }),
            icon: <Brain className="h-4 w-4" />,
          },
          {
            value: 'favorites',
            label: formatMessage({ id: 'memory.tabs.favorites' }),
            icon: <Star className="h-4 w-4" />,
          },
          {
            value: 'archived',
            label: formatMessage({ id: 'memory.tabs.archived' }),
            icon: <Archive className="h-4 w-4" />,
          },
          {
            value: 'unifiedSearch',
            label: formatMessage({ id: 'memory.tabs.unifiedSearch' }),
            icon: <Search className="h-4 w-4" />,
          },
        ]}
      />

      {/* Error alert */}
      {activeError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
            <p className="text-xs mt-0.5">{activeError.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            {formatMessage({ id: 'home.errors.retry' })}
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      {isUnifiedTab ? (
        /* Unified Stats Cards */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? '-' : (unifiedStats?.core_memories.total ?? 0)}
                </div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.count' })}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Hash className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? '-' : (unifiedStats?.entities ?? 0)}
                </div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.entities' })}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Layers className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? '-' : (unifiedStats?.vector_index.total_chunks ?? 0)}
                </div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.vectorChunks' })}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                unifiedStats?.vector_index.hnsw_available ? "bg-green-500/10" : "bg-muted"
              )}>
                <Zap className={cn(
                  "w-5 h-5",
                  unifiedStats?.vector_index.hnsw_available ? "text-green-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? '-' : (unifiedStats?.vector_index.hnsw_available ? unifiedStats.vector_index.hnsw_count : 'N/A')}
                </div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.hnswStatus' })}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Standard Stats Cards */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{memories.length}</div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.count' })}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <FileText className="w-5 h-5 text-info" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{claudeMdCount}</div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.claudeMdCount' })}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Brain className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{formattedTotalSize}</div>
                <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.totalSize' })}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      {isUnifiedTab ? (
        /* Unified Search Input + Category Filter */
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={formatMessage({ id: 'memory.filters.searchUnified' })}
                value={unifiedQuery}
                onChange={(e) => setUnifiedQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-md text-sm min-w-[160px]"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {formatMessage({ id: opt.labelId })}
                </option>
              ))}
            </select>
          </div>
          {unifiedQuery.trim().length > 0 && !unifiedLoading && (
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'memory.unified.resultCount' }, { count: unifiedTotal })}
            </p>
          )}
        </div>
      ) : (
        /* Standard Search + Tag Filters */
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={formatMessage({ id: 'memory.filters.search' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground py-1">{formatMessage({ id: 'memory.card.tags' })}:</span>
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  size="sm"
                  className="h-7"
                  onClick={() => toggleTag(tag)}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Button>
              ))}
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setSelectedTags([])}
                >
                  {formatMessage({ id: 'memory.filters.clear' })}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      {isUnifiedTab ? (
        /* Unified Search Results */
        unifiedLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">
              {formatMessage({ id: 'memory.unified.searching' })}
            </span>
          </div>
        ) : unifiedQuery.trim().length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {formatMessage({ id: 'memory.tabs.unifiedSearch' })}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {formatMessage({ id: 'memory.filters.searchUnified' })}
            </p>
          </Card>
        ) : unifiedResults.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {formatMessage({ id: 'memory.unified.noResults' })}
            </h3>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unifiedResults.map((result) => (
              <UnifiedResultCard
                key={`${result.source_type}-${result.source_id}`}
                result={result}
                onCopy={copyToClipboard}
              />
            ))}
          </div>
        )
      ) : (
        /* Standard Memory List */
        isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <Card className="p-8 text-center">
            <Brain className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {formatMessage({ id: 'memory.emptyState.title' })}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {formatMessage({ id: 'memory.emptyState.message' })}
            </p>
            <Button className="mt-4" onClick={() => { setEditingMemory(null); setIsNewMemoryOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'memory.emptyState.createFirst' })}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onView={setViewingMemory}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCopy={copyToClipboard}
                onToggleFavorite={handleToggleFavorite}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
              />
            ))}
          </div>
        )
      )}

      {/* View Memory Dialog */}
      <ViewMemoryDialog
        memory={viewingMemory}
        open={viewingMemory !== null}
        onOpenChange={(open) => { if (!open) setViewingMemory(null); }}
        onEdit={handleEdit}
        onCopy={copyToClipboard}
      />

      {/* New/Edit Memory Dialog */}
      <NewMemoryDialog
        open={isNewMemoryOpen}
        onOpenChange={(open) => {
          setIsNewMemoryOpen(open);
          if (!open) setEditingMemory(null);
        }}
        onSubmit={handleCreateMemory}
        isCreating={isCreating || isUpdating}
        editingMemory={editingMemory}
      />
    </div>
  );
}

export default MemoryPage;
