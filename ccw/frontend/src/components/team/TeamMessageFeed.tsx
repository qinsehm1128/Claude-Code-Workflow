// ========================================
// TeamMessageFeed Component
// ========================================
// Message timeline with filtering and pagination

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { ChevronDown, ChevronUp, FileText, Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import type { TeamMessage, TeamMessageFilter } from '@/types/team';

interface TeamMessageFeedProps {
  messages: TeamMessage[];
  total: number;
  filter: TeamMessageFilter;
  onFilterChange: (filter: Partial<TeamMessageFilter>) => void;
  onClearFilter: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

// Message type → color mapping
const typeColorMap: Record<string, string> = {
  plan_ready: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  plan_approved: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  plan_revision: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  task_unblocked: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  impl_complete: 'bg-primary/15 text-primary border-primary/30',
  impl_progress: 'bg-primary/15 text-primary border-primary/30',
  test_result: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  review_result: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  fix_required: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  error: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  shutdown: 'bg-muted text-muted-foreground border-border',
  message: 'bg-muted text-muted-foreground border-border',
};

function MessageTypeBadge({ type }: { type: string }) {
  const { formatMessage } = useIntl();
  const color = typeColorMap[type] || typeColorMap.message;
  const labelKey = `team.messageType.${type}`;

  let label: string;
  try {
    label = formatMessage({ id: labelKey });
  } catch {
    label = type;
  }

  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', color)}>
      {label}
    </span>
  );
}

function MessageRow({ msg }: { msg: TeamMessage }) {
  const [dataExpanded, setDataExpanded] = useState(false);
  const time = msg.ts ? msg.ts.substring(11, 19) : '';

  return (
    <div className="flex gap-3 py-2.5 border-b border-border last:border-b-0 animate-in fade-in slide-in-from-top-1 duration-300">
      {/* Timestamp */}
      <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 pt-0.5">
        {time}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header: from → to + type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{msg.from}</span>
          <span className="text-[10px] text-muted-foreground">&rarr;</span>
          <span className="text-xs font-medium">{msg.to}</span>
          <MessageTypeBadge type={msg.type} />
          {msg.id && (
            <span className="text-[10px] text-muted-foreground">{msg.id}</span>
          )}
        </div>

        {/* Summary */}
        <p className="text-xs text-foreground/80">{msg.summary}</p>

        {/* Ref link */}
        {msg.ref && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <FileText className="w-3 h-3" />
            <span className="font-mono truncate">{msg.ref}</span>
          </div>
        )}

        {/* Data toggle */}
        {msg.data && Object.keys(msg.data).length > 0 && (
          <div>
            <button
              onClick={() => setDataExpanded(!dataExpanded)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              {dataExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> data
                </>
              )}
            </button>
            {dataExpanded && (
              <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-h-40">
                {JSON.stringify(msg.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamMessageFeed({
  messages,
  total,
  filter,
  onFilterChange,
  onClearFilter,
  expanded,
  onExpandedChange,
}: TeamMessageFeedProps) {
  const { formatMessage } = useIntl();
  const hasFilter = !!(filter.from || filter.to || filter.type);

  // Extract unique senders/receivers for filter dropdowns
  const { senders, receivers, types } = useMemo(() => {
    const s = new Set<string>();
    const r = new Set<string>();
    const t = new Set<string>();
    for (const m of messages) {
      s.add(m.from);
      r.add(m.to);
      t.add(m.type);
    }
    return {
      senders: Array.from(s).sort(),
      receivers: Array.from(r).sort(),
      types: Array.from(t).sort(),
    };
  }, [messages]);

  // Reverse for newest-first display
  const displayMessages = [...messages].reverse();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onExpandedChange(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {formatMessage({ id: 'team.timeline.title' })}
          <span className="text-xs font-normal">
            ({formatMessage({ id: 'team.timeline.showing' }, { showing: messages.length, total })})
          </span>
        </button>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={onClearFilter} className="h-6 text-xs gap-1">
            <X className="w-3 h-3" />
            {formatMessage({ id: 'team.timeline.clearFilters' })}
          </Button>
        )}
      </div>

      {expanded && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select
              value={filter.from ?? '__all__'}
              onValueChange={(v) => onFilterChange({ from: v === '__all__' ? undefined : v })}
            >
              <SelectTrigger className="w-[130px] h-7 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder={formatMessage({ id: 'team.timeline.filterFrom' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{formatMessage({ id: 'team.filterAll' })}</SelectItem>
                {senders.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.to ?? '__all__'}
              onValueChange={(v) => onFilterChange({ to: v === '__all__' ? undefined : v })}
            >
              <SelectTrigger className="w-[130px] h-7 text-xs">
                <SelectValue placeholder={formatMessage({ id: 'team.timeline.filterTo' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{formatMessage({ id: 'team.filterAll' })}</SelectItem>
                {receivers.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filter.type ?? '__all__'}
              onValueChange={(v) => onFilterChange({ type: v === '__all__' ? undefined : v })}
            >
              <SelectTrigger className="w-[150px] h-7 text-xs">
                <SelectValue placeholder={formatMessage({ id: 'team.timeline.filterType' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{formatMessage({ id: 'team.filterAll' })}</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Messages list */}
          <Card>
            <CardContent className="p-3">
              {displayMessages.length > 0 ? (
                <div className="divide-y-0">
                  {displayMessages.map((msg) => (
                    <MessageRow key={msg.id} msg={msg} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({ id: 'team.empty.noMessages' })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatMessage({ id: 'team.empty.noMessagesHint' })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
