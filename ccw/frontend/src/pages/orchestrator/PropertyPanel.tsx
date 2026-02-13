// ========================================
// Property Panel Component
// ========================================
// Dynamic property editor for unified PromptTemplate nodes

import { useCallback, useMemo, useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useIntl } from 'react-intl';
import { Settings, X, MessageSquare, Trash2, AlertCircle, CheckCircle2, Plus, Save, ChevronDown, ChevronRight, BookmarkPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CommandCombobox, type CommandSelectDetails } from '@/components/ui/CommandCombobox';
import { useFlowStore } from '@/stores';
import { useCommands } from '@/hooks/useCommands';
import type { PromptTemplateNodeData, ExecutionMode } from '@/types/flow';

// ========== Tag-based Instruction Editor ==========

/**
 * Built-in template definitions
 */
interface TemplateItem {
  id: string;
  label: string;
  color: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'slate' | 'cyan' | 'indigo';
  content: string;
  hasInput?: boolean;
  inputLabel?: string;
  inputDefault?: string;
  isCustom?: boolean;
}

const BUILTIN_TEMPLATES: TemplateItem[] = [
  // Output variable
  {
    id: 'output-var',
    label: '输出变量',
    color: 'emerald',
    content: '将结果记为 {{$INPUT}} 变量，供后面节点引用。',
    hasInput: true,
    inputLabel: '变量名',
    inputDefault: 'result',
  },
  // File operations
  {
    id: 'file-read',
    label: '读取文件',
    color: 'sky',
    content: '读取文件 $INPUT 的内容。',
    hasInput: true,
    inputLabel: '文件路径',
    inputDefault: './path/to/file',
  },
  {
    id: 'file-write',
    label: '写入文件',
    color: 'sky',
    content: '将结果写入到文件 $INPUT。',
    hasInput: true,
    inputLabel: '文件路径',
    inputDefault: './output/result.md',
  },
  // Conditional
  {
    id: 'condition-if',
    label: '条件判断',
    color: 'amber',
    content: '如果 $INPUT，则继续执行；否则停止并报告。',
    hasInput: true,
    inputLabel: '条件',
    inputDefault: '结果成功',
  },
  // CLI Analysis Tools
  {
    id: 'cli-gemini',
    label: 'Gemini分析',
    color: 'cyan',
    content: '使用 Gemini 分析：$INPUT\n\n分析要点：\n- 代码结构和架构\n- 潜在问题和改进建议\n- 最佳实践对比',
    hasInput: true,
    inputLabel: '分析目标',
    inputDefault: '当前模块的代码质量',
  },
  {
    id: 'cli-codex',
    label: 'Codex执行',
    color: 'indigo',
    content: '使用 Codex 执行：$INPUT\n\n执行要求：\n- 遵循现有代码风格\n- 确保类型安全\n- 添加必要注释',
    hasInput: true,
    inputLabel: '执行任务',
    inputDefault: '实现指定功能',
  },
  // Git commits
  {
    id: 'git-feat',
    label: 'feat',
    color: 'violet',
    content: 'feat: $INPUT',
    hasInput: true,
    inputLabel: '功能描述',
    inputDefault: '新功能',
  },
  {
    id: 'git-fix',
    label: 'fix',
    color: 'rose',
    content: 'fix: $INPUT',
    hasInput: true,
    inputLabel: 'Bug描述',
    inputDefault: '修复问题',
  },
  {
    id: 'git-refactor',
    label: 'refactor',
    color: 'slate',
    content: 'refactor: $INPUT',
    hasInput: true,
    inputLabel: '重构描述',
    inputDefault: '代码重构',
  },
];

const TEMPLATE_COLORS = {
  emerald: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300',
  sky: 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300',
  amber: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900/50 dark:text-slate-300',
  cyan: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300',
  indigo: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300',
};

const COLOR_OPTIONS: Array<{ value: TemplateItem['color']; label: string }> = [
  { value: 'emerald', label: '绿色' },
  { value: 'sky', label: '天蓝' },
  { value: 'cyan', label: '青色' },
  { value: 'indigo', label: '靛蓝' },
  { value: 'amber', label: '黄色' },
  { value: 'rose', label: '红色' },
  { value: 'violet', label: '紫色' },
  { value: 'slate', label: '灰色' },
];

// Local storage key for custom templates
const CUSTOM_TEMPLATES_KEY = 'orchestrator-custom-templates';

/**
 * Load custom templates from localStorage
 */
function loadCustomTemplates(): TemplateItem[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save custom templates to localStorage
 */
function saveCustomTemplates(templates: TemplateItem[]): void {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

// ========== Custom Template Modal ==========

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: TemplateItem) => void;
}

function TemplateModal({ isOpen, onClose, onSave }: TemplateModalProps) {
  const { formatMessage } = useIntl();
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<TemplateItem['color']>('slate');
  const [hasInput, setHasInput] = useState(false);
  const [inputLabel, setInputLabel] = useState('');
  const [inputDefault, setInputDefault] = useState('');

  const handleSave = useCallback(() => {
    if (!label.trim() || !content.trim()) return;

    const template: TemplateItem = {
      id: `custom-${Date.now()}`,
      label: label.trim(),
      content: content.trim(),
      color,
      isCustom: true,
      ...(hasInput && {
        hasInput: true,
        inputLabel: inputLabel.trim() || '输入',
        inputDefault: inputDefault.trim(),
      }),
    };

    onSave(template);
    // Reset form
    setLabel('');
    setContent('');
    setColor('slate');
    setHasInput(false);
    setInputLabel('');
    setInputDefault('');
    onClose();
  }, [label, content, color, hasInput, inputLabel, inputDefault, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.createCustomTemplate' })}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.templateNameLabel' })}</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：代码审查"
            className="text-sm"
          />
        </div>

        {/* Template content */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {formatMessage({ id: 'orchestrator.propertyPanel.templateContent' })}
            <span className="text-muted-foreground font-normal ml-1">{formatMessage({ id: 'orchestrator.propertyPanel.templateContentHint' })}</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例如：请审查以下代码：$INPUT"
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none"
          />
        </div>

        {/* Color selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.tagColor' })}</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColor(opt.value)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-all',
                  TEMPLATE_COLORS[opt.value],
                  color === opt.value && 'ring-2 ring-primary ring-offset-1'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Has input toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="has-input"
            checked={hasInput}
            onChange={(e) => setHasInput(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="has-input" className="text-sm text-foreground">
            {formatMessage({ id: 'orchestrator.propertyPanel.requiresInput' })}
          </label>
        </div>

        {/* Input configuration */}
        {hasInput && (
          <div className="grid grid-cols-2 gap-2 pl-6">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.inputPrompt' })}</label>
              <Input
                value={inputLabel}
                onChange={(e) => setInputLabel(e.target.value)}
                placeholder="请输入..."
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.defaultValue' })}</label>
              <Input
                value={inputDefault}
                onChange={(e) => setInputDefault(e.target.value)}
                placeholder="默认值"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {formatMessage({ id: 'orchestrator.propertyPanel.cancel' })}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!label.trim() || !content.trim()}
            className="gap-1"
          >
            <Save className="w-4 h-4" />
            {formatMessage({ id: 'orchestrator.propertyPanel.saveTemplate' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TagEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableVariables: string[];
  minHeight?: number;
}

/**
 * Token types for the editor
 */
type TokenType = 'text' | 'variable' | 'artifact';

interface Token {
  type: TokenType;
  value: string;
  isValid?: boolean;
}

/**
 * Parse text into tokens (text segments, {{variables}}, and [[artifacts]])
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Match both {{variable}} and [[artifact]] patterns
  const regex = /\{\{([^}]+)\}\}|\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before token
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      // {{variable}} match
      tokens.push({ type: 'variable', value: match[1].trim() });
    } else if (match[2] !== undefined) {
      // [[artifact]] match
      tokens.push({ type: 'artifact', value: match[2].trim() });
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Extract unique variable names from text
 */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

/**
 * Extract unique artifact names from text
 */
function extractArtifacts(text: string): string[] {
  const matches = text.match(/\[\[([^\]]+)\]\]/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

/**
 * Tag-based instruction editor with inline variable tags
 */
function TagEditor({ value, onChange, placeholder, availableVariables, minHeight = 120 }: TagEditorProps) {
  const { formatMessage } = useIntl();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newArtifactName, setNewArtifactName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>(() => loadCustomTemplates());

  const tokens = useMemo(() => tokenize(value || ''), [value]);
  const detectedVars = useMemo(() => extractVariables(value || ''), [value]);
  const detectedArtifacts = useMemo(() => extractArtifacts(value || ''), [value]);
  const hasContent = (value || '').length > 0;

  // All templates (builtin + custom)
  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTemplates], [customTemplates]);

  // Save custom template
  const handleSaveTemplate = useCallback((template: TemplateItem) => {
    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
  }, [customTemplates]);

  // Delete custom template
  const handleDeleteTemplate = useCallback((templateId: string) => {
    const updated = customTemplates.filter(t => t.id !== templateId);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
  }, [customTemplates]);

  // Handle content changes from contenteditable
  // Convert tag elements back to {{variable}} / [[artifact]] format for storage
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      // Clone the content to avoid modifying the actual DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;

      // Convert variable tags back to {{variable}} format
      const varTags = clone.querySelectorAll('[data-var]');
      varTags.forEach((tag) => {
        const varName = tag.getAttribute('data-var');
        if (varName) {
          tag.replaceWith(`{{${varName}}}`);
        }
      });

      // Convert artifact tags back to [[artifact]] format
      const artTags = clone.querySelectorAll('[data-artifact]');
      artTags.forEach((tag) => {
        const artName = tag.getAttribute('data-artifact');
        if (artName) {
          tag.replaceWith(`[[${artName}]]`);
        }
      });

      // Convert <br> to newlines
      clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));

      // Get the text content
      const content = clone.textContent || '';
      onChange(content);
    }
  }, [onChange]);

  // Handle paste - convert to plain text
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Insert variable at cursor position
  const insertVariable = useCallback((varName: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const varText = `{{${varName}}}`;
      document.execCommand('insertText', false, varText);
    }
  }, []);

  // Insert artifact at cursor position
  const insertArtifact = useCallback((artName: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const artText = `[[${artName}]]`;
      document.execCommand('insertText', false, artText);
    }
  }, []);

  // Insert text at cursor position (or append if no focus)
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, text);
    }
  }, []);

  // Add new variable
  const handleAddVariable = useCallback(() => {
    if (newVarName.trim()) {
      insertVariable(newVarName.trim());
      setNewVarName('');
    }
  }, [newVarName, insertVariable]);

  // Add new artifact
  const handleAddArtifact = useCallback(() => {
    if (newArtifactName.trim()) {
      insertArtifact(newArtifactName.trim());
      setNewArtifactName('');
    }
  }, [newArtifactName, insertArtifact]);

  // Handle key press in new variable input
  const handleVarInputKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddVariable();
    }
  }, [handleAddVariable]);

  // Render tokens as HTML - variables show as green tags, artifacts as blue tags
  const renderContent = useMemo(() => {
    if (!hasContent) return '';

    return tokens.map((token) => {
      if (token.type === 'variable') {
        const isValid = availableVariables.includes(token.value) || token.value.includes('.');
        return `<span class="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold align-baseline cursor-default select-none ${
          isValid
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
        }" contenteditable="false" data-var="${token.value}">${token.value}</span>`;
      }
      if (token.type === 'artifact') {
        return `<span class="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold align-baseline cursor-default select-none bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" contenteditable="false" data-artifact="${token.value}">\u2192 ${token.value}</span>`;
      }
      // Escape HTML in text and preserve whitespace
      return token.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }).join('');
  }, [tokens, availableVariables, hasContent]);

  // Sync content when value changes externally
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = renderContent;
    }
  }, [renderContent, isFocused]);

  return (
    <div className="space-y-2">
      {/* Main editor */}
      <div
        className={cn(
          'relative rounded-md border transition-colors',
          isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        )}
      >
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          data-placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 text-sm font-mono leading-relaxed',
            'focus:outline-none',
            'whitespace-pre-wrap break-words',
            '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground'
          )}
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: renderContent }}
        />
      </div>

      {/* Variable & Artifact toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-muted/30 border border-border">
        {/* Add new variable input */}
        <div className="flex items-center gap-1">
          <Input
            value={newVarName}
            onChange={(e) => setNewVarName(e.target.value)}
            onKeyDown={handleVarInputKeyDown}
            placeholder="{{变量}}"
            className="h-7 w-20 text-xs font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddVariable}
            disabled={!newVarName.trim()}
            className="h-7 px-2"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Add new artifact input */}
        <div className="flex items-center gap-1">
          <Input
            value={newArtifactName}
            onChange={(e) => setNewArtifactName(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); handleAddArtifact(); } }}
            placeholder="[[产物]]"
            className="h-7 w-20 text-xs font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddArtifact}
            disabled={!newArtifactName.trim()}
            className="h-7 px-2"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Quick insert available variables */}
        {availableVariables.length > 0 && (
          <>
            <div className="w-px h-5 bg-border" />
            <span className="text-xs text-muted-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.available' })}</span>
            {availableVariables.slice(0, 5).map((varName) => (
              <button
                key={varName}
                type="button"
                onClick={() => insertVariable(varName)}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70 transition-colors"
              >
                {varName}
              </button>
            ))}
          </>
        )}

        {/* Detected variables summary */}
        {detectedVars.length > 0 && (
          <>
            <div className="w-px h-5 bg-border" />
            <span className="text-xs text-muted-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.variables' })}</span>
            {detectedVars.map((varName) => {
              const isValid = availableVariables.includes(varName) || varName.includes('.');
              return (
                <span
                  key={varName}
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono',
                    isValid
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  )}
                >
                  {isValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {varName}
                </span>
              );
            })}
          </>
        )}

        {/* Detected artifacts summary */}
        {detectedArtifacts.length > 0 && (
          <>
            <div className="w-px h-5 bg-border" />
            <span className="text-xs text-muted-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.artifactsLabel' })}</span>
            {detectedArtifacts.map((artName) => (
              <span
                key={artName}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
              >
                {'\u2192'} {artName}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Templates - categorized */}
      <div className="space-y-2">
        {/* Template buttons by category */}
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-muted/30 border border-border">
          <span className="text-xs text-muted-foreground shrink-0">{formatMessage({ id: 'orchestrator.propertyPanel.templateLabel' })}</span>

          {allTemplates.map((template) => (
            <div key={template.id} className="relative group">
              <button
                type="button"
                onClick={() => {
                  if (template.hasInput) {
                    const inputValue = prompt(template.inputLabel + ':', template.inputDefault);
                    if (inputValue !== null) {
                      const content = template.content.replace(/\$INPUT/g, inputValue);
                      insertText('\n\n' + content);
                    }
                  } else {
                    insertText('\n\n' + template.content);
                  }
                }}
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors',
                  TEMPLATE_COLORS[template.color]
                )}
              >
                {template.label}
              </button>
              {/* Delete button for custom templates */}
              {template.isCustom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(formatMessage({ id: 'orchestrator.propertyPanel.confirmDeleteTemplate' }, { name: template.label }))) {
                      handleDeleteTemplate(template.id);
                    }
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-xs hidden group-hover:flex"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* Add custom template button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            <Plus className="w-3 h-3" />
            {formatMessage({ id: 'orchestrator.propertyPanel.newTemplate' })}
          </button>
        </div>
      </div>

      {/* Custom Template Modal */}
      <TemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}

// ========== Form Field Components ==========

interface LabelInputProps {
  value: string;
  onChange: (value: string) => void;
}

function LabelInput({ value, onChange }: LabelInputProps) {
  const { formatMessage } = useIntl();
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {formatMessage({ id: 'orchestrator.propertyPanel.labels.label' })}
      </label>
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.nodeLabel' })}
      />
    </div>
  );
}

// ========== Slash Command Section ==========

interface SlashCommandSectionProps {
  data: PromptTemplateNodeData;
  onChange: (updates: Partial<PromptTemplateNodeData>) => void;
  availableVariables: string[];
}

function SlashCommandSection({ data, onChange, availableVariables }: SlashCommandSectionProps) {
  const { formatMessage } = useIntl();
  const [argumentHint, setArgumentHint] = useState<string>('');

  // Look up argumentHint from loaded commands when mounting with pre-selected command
  const { commands } = useCommands({ filter: { showDisabled: false } });
  useEffect(() => {
    if (data.slashCommand && commands.length > 0) {
      const cmd = commands.find((c) => c.name === data.slashCommand);
      if (cmd?.argumentHint) {
        setArgumentHint(cmd.argumentHint);
      }
    }
  }, [data.slashCommand, commands]);

  const handleCommandSelect = useCallback(
    (name: string) => {
      const updates: Partial<PromptTemplateNodeData> = { slashCommand: name };
      // Auto-set label if still default
      if (!data.label || data.label === 'Slash Command' || data.label === 'Slash Command (Async)' || data.label === 'New Step') {
        updates.label = `/${name}`;
      }
      onChange(updates);
    },
    [data.label, onChange]
  );

  const handleSelectDetails = useCallback(
    (details: CommandSelectDetails) => {
      setArgumentHint(details.argumentHint || '');
    },
    []
  );

  return (
    <div className="space-y-3">
      {/* Slash Command Picker */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.slashCommand' })}
        </label>
        <CommandCombobox
          value={data.slashCommand || ''}
          onChange={handleCommandSelect}
          onSelectDetails={handleSelectDetails}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.slashCommand' })}
        />
      </div>

      {/* Args Input */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.slashArgs' })}
        </label>
        <Input
          value={data.slashArgs || ''}
          onChange={(e) => onChange({ slashArgs: e.target.value })}
          placeholder={argumentHint || formatMessage({ id: 'orchestrator.propertyPanel.placeholders.slashArgs' })}
          className="font-mono"
        />
        {argumentHint && (
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate" title={argumentHint}>
            {argumentHint}
          </p>
        )}
      </div>

      {/* Additional instruction for context */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.additionalInstruction' })}
        </label>
        <TagEditor
          value={data.instruction || ''}
          onChange={(value) => onChange({ instruction: value })}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.additionalInstruction' })}
          minHeight={80}
          availableVariables={availableVariables}
        />
      </div>
    </div>
  );
}

// ========== Collapsible Section ==========

function CollapsibleSection({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {isExpanded && <div className="space-y-3">{children}</div>}
    </div>
  );
}

// ========== Tags Input ==========

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { formatMessage } = useIntl();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim() && !tags.includes(input.trim())) {
      onChange([...tags, input.trim()]);
      setInput('');
    }
  };

  const handleRemove = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {tag}
            <button onClick={() => handleRemove(tag)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={formatMessage({ id: 'orchestrator.propertyPanel.addTag' })}
          className="h-7 text-xs"
        />
        <Button variant="ghost" size="sm" onClick={handleAdd} disabled={!input.trim()} className="h-7 px-2">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ========== Artifacts List ==========

function ArtifactsList({ artifacts, onChange }: { artifacts: string[]; onChange: (artifacts: string[]) => void }) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim()) {
      onChange([...artifacts, input.trim()]);
      setInput('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(artifacts.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {artifacts.map((artifact, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{'->'}</span>
          <span className="flex-1 font-mono truncate">{artifact}</span>
          <button onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder="output-file.json"
          className="h-7 text-xs font-mono"
        />
        <Button variant="ghost" size="sm" onClick={handleAdd} disabled={!input.trim()} className="h-7 px-2">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ========== Unified PromptTemplate Property Editor ==========

interface PromptTemplatePropertiesProps {
  data: PromptTemplateNodeData;
  onChange: (updates: Partial<PromptTemplateNodeData>) => void;
}

function PromptTemplateProperties({ data, onChange }: PromptTemplatePropertiesProps) {
  const { formatMessage } = useIntl();
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);

  const isSlashCommandMode = data.mode === 'mainprocess' || data.mode === 'async';

  // Build available outputNames from other nodes for contextRefs picker
  const availableOutputNames = useMemo(() => {
    return nodes
      .filter((n) => n.id !== selectedNodeId && n.data?.outputName)
      .map((n) => ({
        id: n.data.outputName as string,
        label: n.data.label || n.id,
      }));
  }, [nodes, selectedNodeId]);

  // Extract variable names for VariableTextarea validation
  const availableVariables = useMemo(() => {
    return availableOutputNames.map((n) => n.id);
  }, [availableOutputNames]);

  return (
    <div className="space-y-4">
      {/* Label */}
      <LabelInput value={data.label} onChange={(value) => onChange({ label: value })} />

      {/* Mode Select - different options for Slash Commands vs CLI Tools */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'orchestrator.propertyPanel.labels.mode' })}
        </label>
        <select
          value={data.mode || 'mainprocess'}
          onChange={(e) => {
            const newMode = e.target.value as ExecutionMode;
            const updates: Partial<PromptTemplateNodeData> = { mode: newMode };
            // Clear slash command fields when switching to CLI mode
            if (newMode === 'analysis' || newMode === 'write') {
              updates.slashCommand = '';
              updates.slashArgs = '';
            }
            onChange(updates);
          }}
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
        >
          <optgroup label={formatMessage({ id: 'orchestrator.propertyPanel.slashCommandsGroup' })}>
            <option value="mainprocess">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeMainprocess' })}</option>
            <option value="async">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeAsync' })}</option>
          </optgroup>
          <optgroup label={formatMessage({ id: 'orchestrator.propertyPanel.cliToolsGroup' })}>
            <option value="analysis">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeAnalysis' })}</option>
            <option value="write">{formatMessage({ id: 'orchestrator.propertyPanel.options.modeWrite' })}</option>
          </optgroup>
        </select>
      </div>

      {/* Conditional: Slash Command Section vs Instruction textarea */}
      {isSlashCommandMode ? (
        <SlashCommandSection data={data} onChange={onChange} availableVariables={availableVariables} />
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {formatMessage({ id: 'orchestrator.propertyPanel.labels.instruction' })}
          </label>
          <TagEditor
            value={data.instruction || ''}
            onChange={(value) => {
              // Auto-extract [[artifact]] names and sync to artifacts field
              const arts = extractArtifacts(value);
              onChange({ instruction: value, artifacts: arts.length > 0 ? arts : undefined });
            }}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.placeholders.instruction' })}
            minHeight={120}
            availableVariables={availableVariables}
          />
        </div>
      )}

      {/* Classification Section */}
      <CollapsibleSection title={formatMessage({ id: 'orchestrator.propertyPanel.classificationSection' })} defaultExpanded={false}>
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.description' })}</label>
          <textarea
            value={data.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.descriptionPlaceholder' })}
            rows={2}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.tags' })}</label>
          <TagsInput
            tags={data.tags || []}
            onChange={(tags) => onChange({ tags })}
          />
        </div>
      </CollapsibleSection>

      {/* Execution Section */}
      <CollapsibleSection title={formatMessage({ id: 'orchestrator.propertyPanel.executionSection' })} defaultExpanded={false}>
        {/* Condition */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.condition' })}</label>
          <Input
            value={data.condition || ''}
            onChange={(e) => onChange({ condition: e.target.value || undefined })}
            placeholder={formatMessage({ id: 'orchestrator.propertyPanel.conditionPlaceholder' })}
            className="font-mono text-sm"
          />
        </div>

        {/* Artifacts */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{formatMessage({ id: 'orchestrator.propertyPanel.artifacts' })}</label>
          <ArtifactsList
            artifacts={data.artifacts || []}
            onChange={(artifacts) => onChange({ artifacts })}
          />
        </div>

        {/* CLI Session Routing (tmux-like) */}
        {!isSlashCommandMode && (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {formatMessage({ id: 'orchestrator.propertyPanel.delivery' })}
              </label>
              <select
                value={(data.delivery as string) || 'newExecution'}
                onChange={(e) => {
                  const next = e.target.value as 'newExecution' | 'sendToSession';
                  const updates: Partial<PromptTemplateNodeData> = { delivery: next };
                  if (next !== 'sendToSession') {
                    updates.targetSessionKey = undefined;
                    updates.resumeKey = undefined;
                    updates.resumeStrategy = undefined;
                  }
                  onChange(updates);
                }}
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
              >
                <option value="newExecution">
                  {formatMessage({ id: 'orchestrator.propertyPanel.options.deliveryNewExecution' })}
                </option>
                <option value="sendToSession">
                  {formatMessage({ id: 'orchestrator.propertyPanel.options.deliverySendToSession' })}
                </option>
              </select>
            </div>

            {((data.delivery as string) || 'newExecution') === 'sendToSession' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {formatMessage({ id: 'orchestrator.propertyPanel.targetSessionKey' })}
                  </label>
                  <Input
                    value={(data.targetSessionKey as string) || ''}
                    onChange={(e) => onChange({ targetSessionKey: e.target.value || undefined })}
                    placeholder={formatMessage({ id: 'orchestrator.propertyPanel.targetSessionKeyPlaceholder' })}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {formatMessage({ id: 'orchestrator.propertyPanel.resumeKey' })}
                  </label>
                  <Input
                    value={(data.resumeKey as string) || ''}
                    onChange={(e) => onChange({ resumeKey: e.target.value || undefined })}
                    placeholder={formatMessage({ id: 'orchestrator.propertyPanel.resumeKeyPlaceholder' })}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {formatMessage({ id: 'orchestrator.propertyPanel.resumeStrategy' })}
                  </label>
                  <select
                    value={(data.resumeStrategy as string) || 'nativeResume'}
                    onChange={(e) => onChange({ resumeStrategy: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                  >
                    <option value="nativeResume">
                      {formatMessage({ id: 'orchestrator.propertyPanel.options.resumeStrategyNative' })}
                    </option>
                    <option value="promptConcat">
                      {formatMessage({ id: 'orchestrator.propertyPanel.options.resumeStrategyPromptConcat' })}
                    </option>
                  </select>
                </div>
              </>
            )}
          </>
        )}
      </CollapsibleSection>
    </div>
  );
}

// ========== Save As Template Button ==========

const SAVE_COLOR_OPTIONS = [
  { value: 'bg-blue-500', label: 'Blue' },
  { value: 'bg-green-500', label: 'Green' },
  { value: 'bg-purple-500', label: 'Purple' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-cyan-500', label: 'Cyan' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-orange-500', label: 'Orange' },
];

function SaveAsTemplateButton({ nodeId, nodeLabel }: { nodeId: string; nodeLabel: string }) {
  const { formatMessage } = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState('bg-blue-500');
  const addCustomTemplate = useFlowStore((s) => s.addCustomTemplate);
  const nodes = useFlowStore((s) => s.nodes);

  const handleSave = () => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !name.trim()) return;

    const { executionStatus, executionError, executionResult, ...templateData } = node.data;
    addCustomTemplate({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: name.trim(),
      description: desc.trim() || name.trim(),
      icon: 'MessageSquare',
      color,
      category: 'command',
      data: { ...templateData, label: name.trim() },
    });

    setIsOpen(false);
    setName('');
    setDesc('');
    setColor('bg-blue-500');
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => { setName(nodeLabel); setIsOpen(true); }}
      >
        <BookmarkPlus className="w-4 h-4 mr-2" />
        {formatMessage({ id: 'orchestrator.propertyPanel.saveToLibrary' })}
      </Button>
    );
  }

  return (
    <div className="p-2 rounded-md border border-primary/50 bg-muted/50 space-y-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={formatMessage({ id: 'orchestrator.propertyPanel.templateName' })}
        className="h-8 text-sm"
        autoFocus
      />
      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder={formatMessage({ id: 'orchestrator.propertyPanel.descriptionOptional' })}
        className="h-8 text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {SAVE_COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setColor(opt.value)}
            className={cn(
              'w-5 h-5 rounded-full transition-all',
              opt.value,
              color === opt.value ? 'ring-2 ring-offset-1 ring-offset-background ring-primary' : '',
            )}
            title={opt.label}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsOpen(false)}>
          {formatMessage({ id: 'orchestrator.propertyPanel.cancel' })}
        </Button>
        <Button size="sm" className="flex-1" onClick={handleSave} disabled={!name.trim()}>
          <Save className="w-3.5 h-3.5 mr-1" />
          {formatMessage({ id: 'orchestrator.propertyPanel.save' })}
        </Button>
      </div>
    </div>
  );
}

// ========== Main PropertyPanel Component ==========

interface PropertyPanelProps {
  className?: string;
}

export function PropertyPanel({ className }: PropertyPanelProps) {
  const { formatMessage } = useIntl();
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const nodes = useFlowStore((state) => state.nodes);
  const updateNode = useFlowStore((state) => state.updateNode);
  const removeNode = useFlowStore((state) => state.removeNode);
  const setIsPropertyPanelOpen = useFlowStore((state) => state.setIsPropertyPanelOpen);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleChange = useCallback(
    (updates: Partial<PromptTemplateNodeData>) => {
      if (selectedNodeId) {
        updateNode(selectedNodeId, updates);
      }
    },
    [selectedNodeId, updateNode]
  );

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      removeNode(selectedNodeId);
    }
  }, [selectedNodeId, removeNode]);

  // No node selected
  if (!selectedNode) {
    return (
      <div className={cn('w-72 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl flex flex-col', className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.title' })}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsPropertyPanelOpen(false)}
            title={formatMessage({ id: 'orchestrator.propertyPanel.close' })}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{formatMessage({ id: 'orchestrator.propertyPanel.selectNode' })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-72 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">{formatMessage({ id: 'orchestrator.propertyPanel.title' })}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsPropertyPanelOpen(false)}
          title={formatMessage({ id: 'orchestrator.propertyPanel.close' })}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Node Type Badge */}
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {formatMessage({ id: 'orchestrator.propertyPanel.nodeType' })}
        </span>
      </div>

      {/* Properties Form - unified for all nodes */}
      <div className="flex-1 overflow-y-auto p-4">
        <PromptTemplateProperties
          data={selectedNode.data as PromptTemplateNodeData}
          onChange={handleChange}
        />
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-border space-y-2">
        <SaveAsTemplateButton nodeId={selectedNodeId!} nodeLabel={selectedNode.data.label} />
        <Button variant="destructive" className="w-full" onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'orchestrator.propertyPanel.deleteNode' })}
        </Button>
      </div>
    </div>
  );
}

export default PropertyPanel;
