// ========================================
// SkillDetailPanel Component
// ========================================
// Right-side slide-out panel for viewing skill details

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  X,
  FileText,
  Edit,
  Trash2,
  Folder,
  Lock,
  Tag,
  MapPin,
  Code,
  ChevronRight,
  ChevronDown,
  Eye,
  Loader2,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { Skill } from '@/lib/api';
import { buildSkillFileTree, getDefaultExpandedPaths } from '@/utils/skill-files';
import type { FileSystemNode } from '@/types/file-explorer';
import { readSkillFile } from '@/lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

export interface SkillDetailPanelProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
  onEditFile?: (skillName: string, fileName: string, location: 'project' | 'user') => void;
  isLoading?: boolean;
}

export function SkillDetailPanel({
  skill,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onEditFile,
  isLoading = false,
}: SkillDetailPanelProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);
  const [cliMode] = useState<'claude' | 'codex'>('claude');

  // Tree view state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Build file tree from supportingFiles
  const fileTree = useMemo(() => {
    if (!skill?.supportingFiles) return [];
    return buildSkillFileTree(skill.supportingFiles);
  }, [skill?.supportingFiles]);

  // Initialize expanded paths when skill changes
  useEffect(() => {
    if (fileTree.length > 0) {
      setExpandedPaths(getDefaultExpandedPaths(fileTree));
    }
  }, [fileTree]);

  // Load file content for preview
  const loadFilePreview = useCallback(async (filePath: string) => {
    if (!skill) return;

    setIsPreviewLoading(true);
    setShowPreviewPanel(true);
    setSelectedFile(filePath);
    setPreviewContent(null);

    try {
      const data = await readSkillFile({
        skillName: skill.folderName || skill.name,
        fileName: filePath,
        location: skill.location || 'project',
        projectPath: projectPath,
        cliType: cliMode,
      });
      setPreviewContent(data.content);
    } catch (error) {
      console.error('Failed to load file preview:', error);
      setPreviewContent(`Error loading preview: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [skill, projectPath, cliMode]);

  const handleClosePreview = () => {
    setShowPreviewPanel(false);
  };

  // Close preview on panel close
  useEffect(() => {
    if (!isOpen) {
      handleClosePreview();
    }
  }, [isOpen]);

  if (!isOpen || !skill) {
    return null;
  }

  const hasAllowedTools = skill.allowedTools && skill.allowedTools.length > 0;
  const hasSupportingFiles = skill.supportingFiles && skill.supportingFiles.length > 0;
  const folderName = skill.folderName || skill.name;

  const handleEditFile = (fileName: string) => {
    onEditFile?.(folderName, fileName, skill.location || 'project');
  };

  // Toggle directory expanded state
  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 w-full sm:w-[480px] md:w-[560px] lg:w-[640px] h-full bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              skill.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Tag className={cn('w-5 h-5', skill.enabled ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">{skill.name}</h3>
              {skill.version && (
                <p className="text-sm text-muted-foreground">v{skill.version}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin text-muted-foreground">
                <Tag className="w-8 h-8" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Description */}
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skills.card.description' })}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {skill.description || formatMessage({ id: 'skills.noDescription' })}
                </p>
              </section>

              {/* Metadata */}
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skills.metadata' })}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skills.location' })}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {skill.location === 'project' ? formatMessage({ id: 'skills.projectSkills' }) : formatMessage({ id: 'skills.userSkills' })}
                    </p>
                  </Card>
                  {skill.version && (
                    <Card className="p-3 bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">
                        {formatMessage({ id: 'skills.card.version' })}
                      </span>
                      <p className="text-sm font-medium text-foreground">v{skill.version}</p>
                    </Card>
                  )}
                  {skill.author && (
                    <Card className="p-3 bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">
                        {formatMessage({ id: 'skills.card.author' })}
                      </span>
                      <p className="text-sm font-medium text-foreground">{skill.author}</p>
                    </Card>
                  )}
                  {skill.source && (
                    <Card className="p-3 bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">
                        {formatMessage({ id: 'skills.card.source' })}
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {formatMessage({ id: `skills.source.${skill.source}` })}
                      </p>
                    </Card>
                  )}
                </div>
              </section>

              {/* Triggers */}
              {skill.triggers && skill.triggers.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {formatMessage({ id: 'skills.card.triggers' })}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skill.triggers.map((trigger) => (
                      <Badge key={trigger} variant="secondary" className="text-sm">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Allowed Tools */}
              {hasAllowedTools && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    {formatMessage({ id: 'skills.allowedTools' })}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skill.allowedTools!.map((tool) => (
                      <Badge key={tool} variant="outline" className="text-xs font-mono">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Files */}
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skills.files' })}
                </h4>
                <div className="space-y-3">
                  {/* SKILL.md (main file) */}
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-mono text-foreground font-medium">SKILL.md</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-primary hover:bg-primary/20"
                        onClick={() => loadFilePreview('SKILL.md')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {onEditFile && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-primary hover:bg-primary/20"
                          onClick={() => handleEditFile('SKILL.md')}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Supporting Files Tree */}
                  {hasSupportingFiles && fileTree.length > 0 && (
                    <div className="border border-border rounded-lg p-2 bg-muted/30">
                      <SkillFileTree
                        nodes={fileTree}
                        expandedPaths={expandedPaths}
                        onTogglePath={togglePath}
                        onEditFile={handleEditFile}
                        onPreviewFile={loadFilePreview}
                        depth={0}
                      />
                    </div>
                  )}

                  {/* Empty state */}
                  {hasSupportingFiles && fileTree.length === 0 && (
                    <div className="text-sm text-muted-foreground p-3">
                      {formatMessage({ id: 'skills.files.empty' })}
                    </div>
                  )}
                </div>
              </section>

              {/* File Preview Modal */}
              <FilePreviewModal
                fileName={selectedFile}
                content={previewContent}
                isLoading={isPreviewLoading}
                isOpen={showPreviewPanel}
                onClose={handleClosePreview}
              />

              {/* Path */}
              {skill.path && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    {formatMessage({ id: 'skills.path' })}
                  </h4>
                  <Card className="p-3 bg-muted">
                    <code className="text-xs font-mono text-muted-foreground break-all">
                      {skill.path}
                    </code>
                  </Card>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border flex justify-between">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => onDelete(skill)}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {formatMessage({ id: 'common.actions.delete' })}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => onEdit(skill)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {formatMessage({ id: 'common.actions.edit' })}
              </Button>
            )}
            <Button onClick={onClose}>
              {formatMessage({ id: 'common.actions.close' })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ========================================
// SkillFileTree Component
// ========================================
// Recursive tree view for skill files

interface SkillFileTreeNodeProps {
  node: FileSystemNode;
  depth: number;
  expandedPaths: Set<string>;
  onTogglePath: (path: string) => void;
  onEditFile: (fileName: string) => void;
  onPreviewFile: (fileName: string) => void;
}

function SkillFileTreeNode({
  node,
  depth,
  expandedPaths,
  onTogglePath,
  onEditFile,
  onPreviewFile,
}: SkillFileTreeNodeProps) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      onTogglePath(node.path);
    } else {
      // Preview file on click
      onPreviewFile(node.path);
    }
  };

  return (
    <div className="select-none group">
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted transition-colors cursor-pointer',
          isDirectory && 'font-medium'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Chevron for directories */}
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
            {hasChildren && (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )
            )}
          </span>
        )}

        {/* Icon */}
        {isDirectory ? (
          <Folder className={cn(
            'w-4 h-4 flex-shrink-0',
            isExpanded ? 'text-blue-500' : 'text-blue-400'
          )} />
        ) : (
          <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        )}

        {/* Name */}
        <span className="text-sm font-mono flex-1 truncate">{node.name}</span>

        {/* Preview button for files */}
        {!isDirectory && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary/20 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewFile(node.path);
              }}
              title="Preview file"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary/20 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onEditFile(node.path);
              }}
              title="Edit file"
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {isDirectory && isExpanded && hasChildren && (
        <div className="border-l border-border ml-4">
          {node.children!.map((child) => (
            <SkillFileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onTogglePath={onTogglePath}
              onEditFile={onEditFile}
              onPreviewFile={onPreviewFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SkillFileTreeProps {
  nodes: FileSystemNode[];
  expandedPaths: Set<string>;
  onTogglePath: (path: string) => void;
  onEditFile: (fileName: string) => void;
  onPreviewFile: (fileName: string) => void;
  depth: number;
}

function SkillFileTree({
  nodes,
  expandedPaths,
  onTogglePath,
  onEditFile,
  onPreviewFile,
  depth,
}: SkillFileTreeProps) {
  return (
    <div className="space-y-0.5" role="tree">
      {nodes.map((node) => (
        <SkillFileTreeNode
          key={node.path}
          node={node}
          depth={depth}
          expandedPaths={expandedPaths}
          onTogglePath={onTogglePath}
          onEditFile={onEditFile}
          onPreviewFile={onPreviewFile}
        />
      ))}
    </div>
  );
}

// ========================================
// File Preview Modal Component
// ========================================

interface FilePreviewModalProps {
  fileName: string | null;
  content: string | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function FilePreviewModal({ fileName, content, isLoading, isOpen, onClose }: FilePreviewModalProps) {
  const { formatMessage } = useIntl();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono font-medium">{fileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Full screen toggle could be implemented here
                }}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 min-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : content ? (
              <Card className="p-4 bg-muted/30">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground">
                  {content}
                </pre>
              </Card>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {formatMessage({ id: 'skills.files.preview.empty' })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border flex justify-end">
            <Button onClick={onClose}>
              {formatMessage({ id: 'common.actions.close' })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default SkillDetailPanel;
