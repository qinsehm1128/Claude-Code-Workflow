// ========================================
// OutputLine Component
// ========================================
// Renders a single output line with JSON auto-detection

import { useMemo } from 'react';
import { Brain, Settings, AlertCircle, Info, MessageCircle, Wrench } from 'lucide-react';
import { JsonCard } from './JsonCard';
import { detectJsonInLine } from '../utils/jsonDetector';

// ========== Types ==========

export interface OutputLineProps {
  line: {
    type: 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call';
    content: string;
    timestamp: number;
  };
  onCopy?: (content: string) => void;
}

// ========== Helper Functions ==========

/**
 * Get the icon component with color for a given output line type
 */
function getOutputLineIcon(type: OutputLineProps['line']['type']) {
  switch (type) {
    case 'thought':
      return <Brain className="h-3 w-3 text-violet-500" />;
    case 'system':
      return <Settings className="h-3 w-3 text-slate-400" />;
    case 'stderr':
      return <AlertCircle className="h-3 w-3 text-rose-500" />;
    case 'metadata':
      return <Info className="h-3 w-3 text-slate-400" />;
    case 'tool_call':
      return <Wrench className="h-3 w-3 text-indigo-500" />;
    case 'stdout':
    default:
      return <MessageCircle className="h-3 w-3 text-teal-500" />;
  }
}

// ========== Component ==========

/**
 * OutputLine - Renders a single CLI output line
 *
 * Features:
 * - Auto-detects JSON content and renders with JsonCard
 * - Shows colored icon based on line type
 * - Different card styles for different types
 * - Supports copy functionality
 */
export function OutputLine({ line, onCopy }: OutputLineProps) {
  // Memoize JSON detection to avoid re-parsing on every render
  const jsonDetection = useMemo(() => detectJsonInLine(line.content), [line.content]);

  return (
    <div className="text-xs">
      {jsonDetection.isJson && jsonDetection.parsed ? (
        <JsonCard
          data={jsonDetection.parsed}
          type={line.type as 'tool_call' | 'metadata' | 'system' | 'stdout' | 'stderr' | 'thought'}
          timestamp={undefined}
          onCopy={() => onCopy?.(line.content)}
        />
      ) : (
        <div className="flex gap-1.5 items-start">
          <span className="shrink-0 mt-0.5">
            {getOutputLineIcon(line.type)}
          </span>
          <span className="break-all whitespace-pre-wrap text-foreground flex-1">{line.content}</span>
        </div>
      )}
    </div>
  );
}

export default OutputLine;
