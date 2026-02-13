// ========================================
// A2UI CLIOutput Component Renderer
// ========================================
// Displays CLI output with syntax highlighting and streaming indicator

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent } from '../A2UIRenderer';
import type { CLIOutputComponent } from '../../core/A2UITypes';

/**
 * Lightweight syntax highlighter for CLI output
 * Uses simple regex-based highlighting for common patterns
 */
function highlightSyntax(output: string, language?: string): React.ReactNode {
  const lines = output.split('\n');

  // Define syntax patterns by language
  const patterns: Record<string, { regex: RegExp; className: string }[]> = {
    bash: [
      { regex: /^(\$|>|\s)(\s*)/gm, className: 'text-muted-foreground' }, // Prompt
      { regex: /\b(error|fail|failed|failure)\b/gi, className: 'text-destructive font-semibold' },
      { regex: /\b(warn|warning)\b/gi, className: 'text-yellow-500 font-semibold' },
      { regex: /\b(success|done|completed|passed)\b/gi, className: 'text-green-500 font-semibold' },
      { regex: /\b(info|notice|note)\b/gi, className: 'text-blue-400' },
      { regex: /--?[\w-]+/g, className: 'text-purple-400' }, // Flags
      { regex: /'[^']*'|"[^"]*"/g, className: 'text-green-400' }, // Strings
    ],
    javascript: [
      { regex: /\b(const|let|var|function|return|if|else|for|while|import|export|from)\b/g, className: 'text-purple-400' },
      { regex: /\b(true|false|null|undefined)\b/g, className: 'text-blue-400' },
      { regex: /\/\/.*$/gm, className: 'text-muted-foreground italic' }, // Comments
      { regex: /'[^']*'|"[^"]*"|`[^`]*`/g, className: 'text-green-400' }, // Strings
      { regex: /\b(console|document|window)\b/g, className: 'text-yellow-400' },
    ],
    python: [
      { regex: /\b(def|class|if|else|elif|for|while|return|import|from|as|try|except|with)\b/g, className: 'text-purple-400' },
      { regex: /\b(True|False|None)\b/g, className: 'text-blue-400' },
      { regex: /#.*/g, className: 'text-muted-foreground italic' }, // Comments
      { regex: /'[^']*'|"[^"]*"/g, className: 'text-green-400' }, // Strings
      { regex: /\b(print|len|range|str|int|float|list|dict)\b/g, className: 'text-yellow-400' },
    ],
  };

  const defaultPatterns = patterns.bash;
  const langPatterns = patterns[language || ''] || defaultPatterns;

  // Apply highlighting to a single line
  const highlightLine = (line: string): React.ReactNode => {
    if (!line) return '\n';

    // Split by regex matches and wrap in spans
    let result: React.ReactNode = line;
    let key = 0;

    for (const pattern of langPatterns) {
      if (typeof result === 'string') {
        const parts: string[] = result.split(pattern.regex);
        result = parts.map((part: string, i: number) => {
          if (pattern.regex.test(part)) {
            return (
              <span key={`${key}-${i}`} className={pattern.className}>
                {part}
              </span>
            );
          }
          return part;
        });
        key++;
      }
    }

    return result;
  };

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-words">
          {highlightLine(line)}
        </div>
      ))}
    </>
  );
}

/**
 * Streaming indicator animation
 */
function StreamingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
      <span className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75" />
      <span className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150" />
    </span>
  );
}

/**
 * A2UI CLIOutput Component Renderer
 * Displays CLI output with optional syntax highlighting and streaming indicator
 */
export const A2UICLIOutput: ComponentRenderer = ({ component, resolveBinding }) => {
  const cliOutputComp = component as CLIOutputComponent;
  const { CLIOutput: config } = cliOutputComp;

  // Resolve output content
  const output = resolveTextContent(config.output, resolveBinding) || '';
  const language = config.language || 'bash';
  const streaming = config.streaming ?? false;
  const maxLines = config.maxLines;

  // Local state for scroll management
  const [isPaused, setIsPaused] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (!isPaused && isAtBottom && streaming) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, isPaused, isAtBottom, streaming]);

  // Handle scroll to detect if user is at bottom
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  }, []);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
  }, []);

  // Truncate output if maxLines is set
  const displayOutput = maxLines
    ? output.split('\n').slice(-maxLines).join('\n')
    : output;

  return (
    <div className="a2ui-cli-output relative group">
      {/* Output container with scroll */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-muted/50 rounded-md p-3 font-mono text-sm overflow-y-auto max-h-[400px] border"
      >
        {displayOutput ? (
          <div className="min-h-[50px]">
            {highlightSyntax(String(displayOutput), language)}
          </div>
        ) : (
          <div className="text-muted-foreground italic">No output</div>
        )}
        <div ref={endRef} />
      </div>

      {/* Controls overlay - visible on hover or when not at bottom */}
      <div className={cn(
        "absolute top-2 right-2 flex gap-1 transition-opacity",
        isAtBottom ? "opacity-0 group-hover:opacity-100" : "opacity-100"
      )}>
        {/* Streaming indicator */}
        {streaming && !isPaused && (
          <div className="bg-background/90 backdrop-blur rounded px-2 py-1 text-xs flex items-center">
            <span className="text-muted-foreground mr-1">Streaming</span>
            <StreamingIndicator />
          </div>
        )}

        {/* Pause/Resume button */}
        {streaming && (
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="bg-background/90 backdrop-blur rounded px-2 py-1 text-xs hover:bg-background transition-colors border"
            title={isPaused ? "Resume scrolling" : "Pause scrolling"}
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
        )}

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="bg-background/90 backdrop-blur rounded px-2 py-1 text-xs hover:bg-background transition-colors border"
            title="Scroll to bottom"
          >
            v
          </button>
        )}
      </div>

      {/* Language indicator */}
      {language && (
        <div className="text-xs text-muted-foreground mt-1">
          Language: {language}
        </div>
      )}
    </div>
  );
};

// Utility function for className merging
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
