// ========================================
// SpecContentDialog Component
// ========================================
// Dialog for viewing and editing spec markdown content

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Eye, Edit2, Save, FileText, Loader2 } from 'lucide-react';
import type { Spec } from './SpecCard';

// ========== Types ==========

/**
 * SpecContentDialog component props
 */
export interface SpecContentDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Called when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Spec being viewed/edited */
  spec: Spec | null;
  /** Initial content of the spec */
  content?: string;
  /** Called when content is saved */
  onSave?: (specId: string, content: string) => Promise<void> | void;
  /** Whether in read-only mode */
  readOnly?: boolean;
  /** Optional loading state */
  isLoading?: boolean;
}

// ========== Helper Functions ==========

/**
 * Extract frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = match[1].split('\n');
  const frontmatter: Record<string, unknown> = {};

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Parse arrays (keywords: [a, b, c])
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else {
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return { frontmatter, body: match[2] };
}

// ========== Component ==========

/**
 * SpecContentDialog component for viewing and editing spec content
 */
export function SpecContentDialog({
  open,
  onOpenChange,
  spec,
  content: initialContent,
  onSave,
  readOnly = false,
  isLoading = false,
}: SpecContentDialogProps) {
  const { formatMessage } = useIntl();
  const [mode, setMode] = React.useState<'view' | 'edit'>('view');
  const [content, setContent] = React.useState(initialContent || '');
  const [editedContent, setEditedContent] = React.useState('');

  // Parse frontmatter for display
  const { body } = React.useMemo(() => {
    return parseFrontmatter(content);
  }, [content]);

  // Reset when spec changes
  React.useEffect(() => {
    if (spec && open) {
      // Fetch spec content
      const fetchContent = async () => {
        try {
          const response = await fetch(`/api/specs/detail?file=${encodeURIComponent(spec.file)}`);
          if (response.ok) {
            const data = await response.json();
            setContent(data.content || '');
            setEditedContent(data.content || '');
          }
        } catch (error) {
          console.error('Failed to fetch spec content:', error);
        }
      };
      fetchContent();
      setMode('view');
    }
  }, [spec, open]);

  // Handle save
  const handleSave = async () => {
    if (!spec || !onSave) return;
    await onSave(spec.id, editedContent);
    setContent(editedContent);
    setMode('view');
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditedContent(content);
    setMode('view');
  };

  if (!spec) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[800px] max-h-[80vh]', mode === 'edit' && 'flex flex-col')}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {spec.title}
              </DialogTitle>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mode === 'view' ? setMode('edit') : handleCancelEdit()}
                  disabled={isLoading}
                >
                  {mode === 'view' ? (
                    <>
                      <Edit2 className="h-4 w-4 mr-1" />
                      {formatMessage({ id: 'specs.content.edit', defaultMessage: 'Edit' })}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      {formatMessage({ id: 'specs.content.view', defaultMessage: 'View' })}
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={spec.readMode === 'required' ? 'default' : 'secondary'}>
                {formatMessage({ id: `specs.readMode.${spec.readMode}` })}
              </Badge>
              <Badge variant="outline">
                {formatMessage({ id: `specs.priority.${spec.priority}` })}
              </Badge>
            </div>
          </div>
          <DialogDescription>
            {spec.file}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {mode === 'view' ? (
            <div className="space-y-4">
              {/* Frontmatter Info */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-2">
                  {formatMessage({ id: 'specs.content.metadata', defaultMessage: 'Metadata' })}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      {formatMessage({ id: 'specs.form.readMode', defaultMessage: 'Read Mode' })}:
                    </span>{' '}
                    <Badge variant="secondary" className="text-xs">
                      {formatMessage({ id: `specs.readMode.${spec.readMode}` })}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {formatMessage({ id: 'specs.form.priority', defaultMessage: 'Priority' })}:
                    </span>{' '}
                    <Badge variant="outline" className="text-xs">
                      {formatMessage({ id: `specs.priority.${spec.priority}` })}
                    </Badge>
                  </div>
                </div>
                {spec.keywords.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatMessage({ id: 'specs.form.keywords', defaultMessage: 'Keywords' })}:
                    </span>{' '}
                    {spec.keywords.map(k => (
                      <Badge key={k} variant="outline" className="text-xs mr-1">{k}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Markdown Content */}
              <div className="border rounded-lg">
                <div className="bg-muted/30 px-3 py-2 border-b text-sm font-medium">
                  {formatMessage({ id: 'specs.content.markdownContent', defaultMessage: 'Markdown Content' })}
                </div>
                <pre className="p-4 text-sm overflow-auto max-h-[400px] whitespace-pre-wrap break-words">
                  {body || formatMessage({ id: 'specs.content.noContent', defaultMessage: 'No content available' })}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {formatMessage({ id: 'specs.content.editHint', defaultMessage: 'Edit the full markdown content including frontmatter. Changes to frontmatter will be reflected in the spec metadata.' })}
              </div>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="font-mono text-sm min-h-[400px] resize-none"
                placeholder={formatMessage({ id: 'specs.content.placeholder', defaultMessage: '# Spec Title\n\nContent here...' })}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === 'edit' ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isLoading}>
                {formatMessage({ id: 'specs.common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {formatMessage({ id: 'specs.common.saving', defaultMessage: 'Saving...' })}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {formatMessage({ id: 'specs.common.save', defaultMessage: 'Save' })}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage({ id: 'specs.common.close', defaultMessage: 'Close' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SpecContentDialog;
