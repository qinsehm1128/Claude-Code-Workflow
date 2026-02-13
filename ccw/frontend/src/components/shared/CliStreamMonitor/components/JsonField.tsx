import { useState } from 'react';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JsonFieldProps {
  fieldName: string;
  value: unknown;
}

export function JsonField({ fieldName, value }: JsonFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setCopied] = useState(false);

  const isObject = value !== null && typeof value === 'object';
  const isNested = isObject && (Array.isArray(value) || Object.keys(value).length > 0);

  // Skip rendering certain fields
  if (fieldName === 'type' || fieldName === 'timestamp' || fieldName === 'role' || fieldName === 'id' || fieldName === 'content') {
    return null;
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderPrimitiveValue = (val: unknown): React.ReactNode => {
    if (val === null) return <span className="text-muted-foreground italic">null</span>;
    if (typeof val === 'boolean') return <span className="text-purple-400">{String(val)}</span>;
    if (typeof val === 'number') return <span className="text-orange-400 font-mono">{String(val)}</span>;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      const isLong = trimmed.length > 80;
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return (
          <span className="text-green-600 flex items-center gap-1">
            <span>"{trimmed.substring(0, isLong ? 50 : trimmed.length)}{isLong ? '...' : ''}"</span>
            {isLong && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(val as string); }}
                className="opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                title="Copy full value"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      }
      return (
        <span className="text-green-600 flex items-center gap-1 group">
          <span className={isLong ? 'truncate' : ''}> "{val}"</span>
          {isLong && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopy(val as string); }}
              className="opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted shrink-0"
              title="Copy full value"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </span>
      );
    }
    return String(val);
  };

  return (
    <div className={cn(
      'flex items-start gap-2 px-2 py-1 group',
      'text-xs'
    )}>
      {/* Field name */}
      <span className="shrink-0 font-mono text-cyan-600 dark:text-cyan-400 min-w-[70px] text-xs">
        {fieldName}
      </span>

      {/* Separator */}
      <span className="shrink-0 text-muted-foreground">:</span>

      {/* Value */}
      <div className="flex-1 min-w-0">
        {isNested ? (
          <details
            open={isExpanded}
            onToggle={(e) => setIsExpanded(e.currentTarget.open)}
            className="group/summary"
          >
            <summary className="cursor-pointer list-none flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">
                {isExpanded ? '▼' : '▶'}
              </span>
              {Array.isArray(value) ? (
                <span className="text-blue-500">[{value.length}]</span>
              ) : (
                <span className="text-yellow-500">{'{'}{Object.keys(value).length}{'}'}</span>
              )}
            </summary>
            {isExpanded && (
              <div className="ml-3 mt-1 space-y-0.5">
                {Array.isArray(value)
                  ? value.map((item, i) => (
                      <div key={i} className="pl-1 border-l border-border/20">
                        {typeof item === 'object' && item !== null ? (
                          <JsonField fieldName={`[${i}]`} value={item} />
                        ) : (
                          <span className="text-xs">{renderPrimitiveValue(item)}</span>
                        )}
                      </div>
                    ))
                  : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                      <JsonField key={k} fieldName={k} value={v} />
                    ))
                }
              </div>
            )}
          </details>
        ) : (
          <div className="break-all text-xs">
            {renderPrimitiveValue(value)}
          </div>
        )}
      </div>
    </div>
  );
}

export default JsonField;
