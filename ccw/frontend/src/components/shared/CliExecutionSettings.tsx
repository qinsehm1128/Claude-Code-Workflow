// ========================================
// CliExecutionSettings Component
// ========================================
// Shared execution parameter controls (tool, mode, resumeStrategy)
// extracted from QueueExecuteInSession and QueueSendToOrchestrator.

import { useIntl } from 'react-intl';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolName = 'claude' | 'codex' | 'gemini' | 'qwen';
export type ExecutionMode = 'analysis' | 'write';
export type ResumeStrategy = 'nativeResume' | 'promptConcat';

export interface CliExecutionSettingsProps {
  /** Currently selected tool. */
  tool: ToolName;
  /** Currently selected execution mode. */
  mode: ExecutionMode;
  /** Currently selected resume strategy. */
  resumeStrategy: ResumeStrategy;
  /** Callback when tool changes. */
  onToolChange: (tool: ToolName) => void;
  /** Callback when mode changes. */
  onModeChange: (mode: ExecutionMode) => void;
  /** Callback when resume strategy changes. */
  onResumeStrategyChange: (strategy: ResumeStrategy) => void;
  /** Available tool options. Defaults to claude, codex, gemini, qwen. */
  toolOptions?: ToolName[];
  /** Additional CSS class. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Default tool list
// ---------------------------------------------------------------------------

const DEFAULT_TOOL_OPTIONS: ToolName[] = ['claude', 'codex', 'gemini', 'qwen'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CliExecutionSettings({
  tool,
  mode,
  resumeStrategy,
  onToolChange,
  onModeChange,
  onResumeStrategyChange,
  toolOptions = DEFAULT_TOOL_OPTIONS,
  className,
}: CliExecutionSettingsProps) {
  const { formatMessage } = useIntl();

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tool selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {formatMessage({ id: 'issues.terminal.exec.tool' })}
            </label>
            <Select
              value={tool}
              onValueChange={(v) => onToolChange(v as ToolName)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toolOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {formatMessage({ id: 'issues.terminal.exec.mode' })}
            </label>
            <Select
              value={mode}
              onValueChange={(v) => onModeChange(v as ExecutionMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analysis">analysis</SelectItem>
                <SelectItem value="write">write</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resume strategy selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {formatMessage({ id: 'issues.terminal.exec.resumeStrategy' })}
            </label>
            <Select
              value={resumeStrategy}
              onValueChange={(v) =>
                onResumeStrategyChange(v as ResumeStrategy)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nativeResume">nativeResume</SelectItem>
                <SelectItem value="promptConcat">promptConcat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
