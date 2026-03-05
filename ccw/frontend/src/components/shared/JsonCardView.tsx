// ========================================
// JsonCardView Component
// ========================================
// Renders JSON data as structured cards for better readability

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// ========== Types ==========

export interface JsonCardViewProps {
  /** JSON data to render - accepts any object type */
  data: object | unknown[] | null;
  /** Additional CSS className */
  className?: string;
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

interface CardItemProps {
  label: string;
  value: unknown;
  depth?: number;
}

// ========== Helper Functions ==========

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ========== Sub Components ==========

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'secondary'}>
        {value ? 'true' : 'false'}
      </Badge>
    );
  }
  if (typeof value === 'number') {
    return <span className="text-blue-600 dark:text-blue-400 font-mono">{value}</span>;
  }
  if (typeof value === 'string') {
    // Check if it's a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
        >
          {value}
        </a>
      );
    }
    // Long text
    if (value.length > 100) {
      return (
        <div className="text-sm text-foreground bg-muted/50 p-2 rounded whitespace-pre-wrap break-words">
          {value}
        </div>
      );
    }
    return <span className="text-foreground">{value}</span>;
  }
  return <span>{String(value)}</span>;
}

function ArrayView({ items }: { items: unknown[] }) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground italic text-sm">Empty list</div>
    );
  }

  // Simple array of primitives
  const allPrimitives = items.every(
    (item) => typeof item !== 'object' || item === null
  );

  if (allPrimitives) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <Badge key={index} variant="outline" className="font-normal">
            {String(item)}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {items.length} items
      </button>
      {expanded && (
        <div className="space-y-2 pl-4 border-l-2 border-border">
          {items.map((item, index) => (
            <Card key={index} className="p-3">
              <div className="text-xs text-muted-foreground mb-2">#{index + 1}</div>
              {isObject(item) ? (
                <ObjectView data={item} />
              ) : (
                <PrimitiveValue value={item} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectView({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return <div className="text-muted-foreground italic text-sm">Empty object</div>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <CardItem key={key} label={key} value={value} depth={depth} />
      ))}
    </div>
  );
}

function CardItem({ label, value, depth = 0 }: CardItemProps) {
  const formattedLabel = formatLabel(label);

  // Nested object
  if (isObject(value)) {
    return (
      <div className="space-y-2">
        <div className="font-medium text-sm text-foreground">{formattedLabel}</div>
        <div className={cn('pl-3 border-l-2 border-border', depth > 1 && 'ml-2')}>
          <ObjectView data={value} depth={depth + 1} />
        </div>
      </div>
    );
  }

  // Array
  if (isArray(value)) {
    return (
      <div className="space-y-2">
        <div className="font-medium text-sm text-foreground">{formattedLabel}</div>
        <ArrayView items={value} />
      </div>
    );
  }

  // Primitive value
  return (
    <div className="flex items-start gap-2">
      <div className="font-medium text-sm text-muted-foreground min-w-[120px] shrink-0">
        {formattedLabel}
      </div>
      <div className="flex-1 text-sm">
        <PrimitiveValue value={value} />
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function JsonCardView({ data, className }: JsonCardViewProps) {
  if (!data) {
    return (
      <div className="text-muted-foreground italic text-sm">No data available</div>
    );
  }

  // Handle array at root level
  if (isArray(data)) {
    return (
      <div className={cn('space-y-3', className)}>
        <ArrayView items={data} />
      </div>
    );
  }

  // Handle object
  return (
    <div className={cn('space-y-4', className)}>
      <ObjectView data={data as Record<string, unknown>} />
    </div>
  );
}

export default JsonCardView;
