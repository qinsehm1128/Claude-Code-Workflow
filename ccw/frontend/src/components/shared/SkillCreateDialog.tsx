// ========================================
// Skill Create Dialog Component
// ========================================
// Modal dialog for creating/importing skills with two modes:
// - Import: import existing skill folder
// - CLI Generate: AI-generated skill from description

import { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Folder,
  User,
  FolderInput,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
  FolderOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { validateSkillImport, createSkill } from '@/lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { FloatingFileBrowser } from '@/components/terminal-dashboard/FloatingFileBrowser';
import { cn } from '@/lib/utils';

export interface SkillCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  cliType?: 'claude' | 'codex';
}

type CreateMode = 'import' | 'cli-generate';
type SkillLocation = 'project' | 'user';

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  skillInfo?: { name: string; description: string; version?: string; supportingFiles?: string[] };
}

export function SkillCreateDialog({ open, onOpenChange, onCreated, cliType = 'claude' }: SkillCreateDialogProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  const [mode, setMode] = useState<CreateMode>('import');
  const [location, setLocation] = useState<SkillLocation>('project');

  // Import mode state
  const [sourcePath, setSourcePath] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // CLI Generate mode state
  const [skillName, setSkillName] = useState('');
  const [description, setDescription] = useState('');

  const [isCreating, setIsCreating] = useState(false);

  // File browser state
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  const resetState = useCallback(() => {
    setMode('import');
    setLocation('project');
    setSourcePath('');
    setValidationResult(null);
    setIsValidating(false);
    setSkillName('');
    setDescription('');
    setIsCreating(false);
    setIsFileBrowserOpen(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }, [onOpenChange, resetState]);

  const handleValidate = useCallback(async () => {
    if (!sourcePath.trim()) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await validateSkillImport(sourcePath.trim());
      setValidationResult(result);
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    } finally {
      setIsValidating(false);
    }
  }, [sourcePath]);

  const handleCreate = useCallback(async () => {
    if (mode === 'import') {
      if (!sourcePath.trim()) return;
      if (!validationResult?.valid) return;
    } else {
      if (!skillName.trim()) return;
      if (!description.trim()) return;
    }

    setIsCreating(true);

    try {
      await createSkill({
        mode,
        location,
        sourcePath: mode === 'import' ? sourcePath.trim() : undefined,
        skillName: mode === 'cli-generate' ? skillName.trim() : undefined,
        description: mode === 'cli-generate' ? description.trim() : undefined,
        generationType: mode === 'cli-generate' ? 'description' : undefined,
        projectPath,
        cliType,
      });

      handleOpenChange(false);
      onCreated();
    } catch (err) {
      console.error('Failed to create skill:', err);
      if (mode === 'import') {
        setValidationResult({
          valid: false,
          errors: [err instanceof Error ? err.message : formatMessage({ id: 'skills.create.createError' })],
        });
      }
    } finally {
      setIsCreating(false);
    }
  }, [mode, location, sourcePath, skillName, description, validationResult, projectPath, handleOpenChange, onCreated, formatMessage]);

  const canCreate = mode === 'import'
    ? sourcePath.trim() && validationResult?.valid && !isCreating
    : skillName.trim() && description.trim() && !isCreating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'skills.create.title' })}</DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'skills.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Location Selection */}
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'skills.create.location' })}</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  'px-4 py-3 text-left border-2 rounded-lg transition-all',
                  location === 'project'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setLocation('project')}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5" />
                  <div>
                    <div className="font-medium text-sm">{formatMessage({ id: 'skills.create.locationProject' })}</div>
                    <div className="text-xs text-muted-foreground">{`.${cliType}/skills/`}</div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className={cn(
                  'px-4 py-3 text-left border-2 rounded-lg transition-all',
                  location === 'user'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setLocation('user')}
              >
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  <div>
                    <div className="font-medium text-sm">{formatMessage({ id: 'skills.create.locationUser' })}</div>
                    <div className="text-xs text-muted-foreground">{`~/.${cliType}/skills/`}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'skills.create.mode' })}</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  'px-4 py-3 text-left border-2 rounded-lg transition-all',
                  mode === 'import'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setMode('import')}
              >
                <div className="flex items-center gap-2">
                  <FolderInput className="w-5 h-5" />
                  <div>
                    <div className="font-medium text-sm">{formatMessage({ id: 'skills.create.modeImport' })}</div>
                    <div className="text-xs text-muted-foreground">{formatMessage({ id: 'skills.create.modeImportHint' })}</div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className={cn(
                  'px-4 py-3 text-left border-2 rounded-lg transition-all',
                  mode === 'cli-generate'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setMode('cli-generate')}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <div>
                    <div className="font-medium text-sm">{formatMessage({ id: 'skills.create.modeGenerate' })}</div>
                    <div className="text-xs text-muted-foreground">{formatMessage({ id: 'skills.create.modeGenerateHint' })}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Import Mode Content */}
          {mode === 'import' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sourcePath">{formatMessage({ id: 'skills.create.sourcePath' })}</Label>
                <div className="flex gap-2">
                  <Input
                    id="sourcePath"
                    value={sourcePath}
                    onChange={(e) => {
                      setSourcePath(e.target.value);
                      setValidationResult(null);
                    }}
                    placeholder={formatMessage({ id: 'skills.create.sourcePathPlaceholder' })}
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsFileBrowserOpen(true)}
                    title={formatMessage({ id: 'skills.create.browseFolder' })}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{formatMessage({ id: 'skills.create.sourcePathHint' })}</p>
              </div>

              {/* Validation Result */}
              {isValidating && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{formatMessage({ id: 'skills.create.validating' })}</span>
                </div>
              )}
              {validationResult && !isValidating && (
                validationResult.valid ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">{formatMessage({ id: 'skills.create.validSkill' })}</span>
                    </div>
                    {validationResult.skillInfo && (
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">{formatMessage({ id: 'skills.card.description' })}: </span>
                          <span>{validationResult.skillInfo.name}</span>
                        </div>
                        {validationResult.skillInfo.description && (
                          <div>
                            <span className="text-muted-foreground">{formatMessage({ id: 'skills.card.description' })}: </span>
                            <span>{validationResult.skillInfo.description}</span>
                          </div>
                        )}
                        {validationResult.skillInfo.version && (
                          <div>
                            <span className="text-muted-foreground">{formatMessage({ id: 'skills.card.version' })}: </span>
                            <span>{validationResult.skillInfo.version}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">{formatMessage({ id: 'skills.create.invalidSkill' })}</span>
                    </div>
                    {validationResult.errors && (
                      <ul className="space-y-1 text-sm">
                        {validationResult.errors.map((error, i) => (
                          <li key={i} className="text-destructive">{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* CLI Generate Mode Content */}
          {mode === 'cli-generate' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="skillName">
                  {formatMessage({ id: 'skills.create.skillName' })} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="skillName"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder={formatMessage({ id: 'skills.create.skillNamePlaceholder' })}
                />
                <p className="text-xs text-muted-foreground">{formatMessage({ id: 'skills.create.skillNameHint' })}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {formatMessage({ id: 'skills.create.descriptionLabel' })} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={formatMessage({ id: 'skills.create.descriptionPlaceholder' })}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">{formatMessage({ id: 'skills.create.descriptionHint' })}</p>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-600">
                    <p className="font-medium">{formatMessage({ id: 'skills.create.generateInfo' })}</p>
                    <p className="text-xs mt-1">{formatMessage({ id: 'skills.create.generateTimeHint' })}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            {formatMessage({ id: 'skills.actions.cancel' })}
          </Button>
          {mode === 'import' && (
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={!sourcePath.trim() || isValidating || isCreating}
            >
              {isValidating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {formatMessage({ id: 'skills.create.validate' })}
            </Button>
          )}
          <Button
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isCreating
              ? formatMessage({ id: 'skills.create.creating' })
              : mode === 'import'
                ? formatMessage({ id: 'skills.create.import' })
                : formatMessage({ id: 'skills.create.generate' })
            }
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* File Browser for selecting source folder */}
      <FloatingFileBrowser
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        rootPath={projectPath}
        onInsertPath={(path) => {
          setSourcePath(path);
          setValidationResult(null);
          setIsFileBrowserOpen(false);
        }}
        initialSelectedPath={sourcePath || null}
      />
    </Dialog>
  );
}

export default SkillCreateDialog;
