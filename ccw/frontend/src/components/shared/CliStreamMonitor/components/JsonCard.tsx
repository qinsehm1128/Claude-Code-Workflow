// ========================================
// JsonCard Component
// ========================================
// Collapsible card component for displaying JSON data with type-based styling

import { useState } from 'react';
import {
  Wrench,
  Settings,
  Info,
  Code,
  Copy,
  AlertTriangle,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JsonField } from './JsonField';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ========== Types ==========

export interface JsonCardProps {
  /** JSON data to display */
  data: Record<string, unknown>;
  /** Type of the card (affects styling and icon) */
  type: 'tool_call' | 'metadata' | 'system' | 'stdout' | 'stderr' | 'thought';
  /** Timestamp for the data */
  timestamp?: number;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
}

// ========== Type Configuration ==========

type TypeConfig = {
  icon: typeof Wrench;
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
};

const TYPE_CONFIGS: Record<string, TypeConfig> = {
  tool_call: {
    icon: Wrench,
    label: 'Tool Call',
    shortLabel: 'Tool',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'border-l-indigo-500',
  },
  metadata: {
    icon: Info,
    label: 'Metadata',
    shortLabel: 'Info',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'border-l-slate-400',
  },
  system: {
    icon: Settings,
    label: 'System',
    shortLabel: 'Sys',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'border-l-slate-400',
  },
  stdout: {
    icon: Code,
    label: 'Data',
    shortLabel: 'Out',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'border-l-teal-500',
  },
  stderr: {
    icon: AlertTriangle,
    label: 'Error',
    shortLabel: 'Err',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'border-l-rose-500',
  },
  thought: {
    icon: Brain,
    label: 'Thought',
    shortLabel: '💭',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'border-l-violet-500',
  },
};

// ========== Component ==========

export function JsonCard({
  data,
  type,
}: JsonCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const config = TYPE_CONFIGS[type];

  // Check if data has a 'content' field
  const hasContentField = 'content' in data && typeof data.content === 'string';
  const content = hasContentField ? (data.content as string) : '';

  // If has content field, render as streaming output
  if (hasContentField) {
    // Check if content looks like markdown
    const isMarkdown = content.match(/^#{1,6}\s|^\*{3,}$|^\s*[-*+]\s+|^\s*\d+\.\s+|\*\*.*?\*\*|`{3,}/m);

    return (
      <div className={cn('border-l-2 rounded-r my-1.5 py-1 px-2 group relative bg-background', config.bg)}>
        <div className="pr-6">
          {isMarkdown ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-xs whitespace-pre-wrap break-words leading-relaxed">
              {content}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Otherwise, render as card with fields
  const entries = Object.entries(data).filter(([key]) =>
    key !== 'type' && key !== 'timestamp' && key !== 'role' && key !== 'id'
  );
  const visibleCount = isExpanded ? entries.length : 1;
  const hasMore = entries.length > 1;

  const handleCopyCard = () => {
    const content = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(content);
  };

  return (
    <div className={cn('border-l-2 rounded-r my-1.5 py-1 px-2 group relative bg-background text-xs', config.bg)}>
      {/* Copy button - show on hover */}
      <button
        onClick={handleCopyCard}
        className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
        title="Copy JSON"
      >
        <Copy className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Content */}
      <div className="pr-6">
        {entries.slice(0, visibleCount).map(([key, value]) => (
          <JsonField key={key} fieldName={key} value={value} />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors text-left rounded"
          >
            {isExpanded
              ? '▲ Show less'
              : `▼ Show ${entries.length - 1} more`}
          </button>
        )}
      </div>
    </div>
  );
}

export default JsonCard;
