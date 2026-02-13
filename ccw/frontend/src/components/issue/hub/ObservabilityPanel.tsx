// ========================================
// Observability Panel
// ========================================
// Audit log UI for issue workbench (read-only)

import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useCliSessionAudit } from '@/hooks';
import { cn } from '@/lib/utils';
import type { CliSessionAuditEvent, CliSessionAuditEventType } from '@/lib/api';

const EVENT_TYPES: CliSessionAuditEventType[] = [
  'session_created',
  'session_closed',
  'session_send',
  'session_execute',
  'session_resize',
  'session_share_created',
  'session_share_revoked',
  'session_idle_reaped',
];

function badgeVariantForType(type: CliSessionAuditEventType): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' {
  switch (type) {
    case 'session_created':
      return 'success';
    case 'session_closed':
    case 'session_idle_reaped':
      return 'secondary';
    case 'session_execute':
      return 'info';
    case 'session_send':
    case 'session_resize':
      return 'outline';
    case 'session_share_created':
      return 'warning';
    case 'session_share_revoked':
      return 'secondary';
    default:
      return 'default';
  }
}

function stableEventKey(ev: CliSessionAuditEvent, index: number): string {
  return `${ev.timestamp}|${ev.type}|${ev.sessionKey ?? ''}|${index}`;
}

export function ObservabilityPanel() {
  const { formatMessage } = useIntl();

  const [q, setQ] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [type, setType] = useState<string>('');
  const [limit, setLimit] = useState<number>(200);
  const [offset, setOffset] = useState<number>(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Reset paging when filters change
  useEffect(() => {
    setOffset(0);
  }, [q, sessionKey, type, limit]);

  const query = useCliSessionAudit({
    q: q.trim() || undefined,
    sessionKey: sessionKey.trim() || undefined,
    type: type ? (type as CliSessionAuditEventType) : undefined,
    limit,
    offset,
  });

  const events = query.data?.data.events ?? [];
  const total = query.data?.data.total ?? 0;
  const hasMore = query.data?.data.hasMore ?? false;

  const headerRight = useMemo(() => {
    const start = total === 0 ? 0 : offset + 1;
    const end = Math.min(total, offset + limit);
    return `${start}-${end} / ${total}`;
  }, [limit, offset, total]);

  const handleRefresh = async () => {
    try {
      await query.refetch();
    } catch (e) {
      // Errors are surfaced by query.error
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">
              {formatMessage({ id: 'issues.observability.audit.title' })}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground font-mono">
                {headerRight}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={query.isFetching}
                className="gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} />
                {formatMessage({ id: 'common.actions.refresh' })}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.observability.filters.search' })}
              </label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={formatMessage({ id: 'issues.observability.filters.searchPlaceholder' })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.observability.filters.sessionKey' })}
              </label>
              <Input
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                placeholder={formatMessage({ id: 'issues.observability.filters.sessionKeyPlaceholder' })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.observability.filters.type' })}
              </label>
              <Select value={type || '__all__'} onValueChange={(v) => setType(v === '__all__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={formatMessage({ id: 'issues.observability.filters.typeAll' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{formatMessage({ id: 'issues.observability.filters.typeAll' })}</SelectItem>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-medium text-muted-foreground">
                {formatMessage({ id: 'issues.observability.filters.limit' })}
              </label>
              <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v, 10))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[50, 100, 200, 500, 1000].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || query.isFetching}
              >
                {formatMessage({ id: 'common.actions.previous' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={!hasMore || query.isFetching}
              >
                {formatMessage({ id: 'common.actions.next' })}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {query.error && (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <div className="text-sm text-destructive">
            {(query.error as Error).message || formatMessage({ id: 'issues.observability.error' })}
          </div>
        </Card>
      )}

      {!query.isLoading && events.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          {formatMessage({ id: 'issues.observability.empty' })}
        </Card>
      )}

      {events.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-card/50 text-xs font-medium text-muted-foreground grid grid-cols-12 gap-3">
            <div className="col-span-3">{formatMessage({ id: 'issues.observability.table.timestamp' })}</div>
            <div className="col-span-2">{formatMessage({ id: 'issues.observability.table.type' })}</div>
            <div className="col-span-3">{formatMessage({ id: 'issues.observability.table.sessionKey' })}</div>
            <div className="col-span-2">{formatMessage({ id: 'issues.observability.table.tool' })}</div>
            <div className="col-span-2">{formatMessage({ id: 'issues.observability.table.resumeKey' })}</div>
          </div>

          <div className="divide-y divide-border">
            {events.map((ev, index) => {
              const key = stableEventKey(ev, index);
              const expanded = expandedKey === key;
              return (
                <div key={key} className="px-4 py-2">
                  <button
                    type="button"
                    className="w-full text-left grid grid-cols-12 gap-3 items-center hover:bg-muted/40 rounded-md px-2 py-2"
                    onClick={() => setExpandedKey(expanded ? null : key)}
                  >
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-xs text-foreground truncate">
                        {ev.timestamp}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <Badge variant={badgeVariantForType(ev.type)} className="font-mono text-xs">
                        {ev.type}
                      </Badge>
                    </div>
                    <div className="col-span-3 font-mono text-xs text-muted-foreground truncate">
                      {ev.sessionKey || '-'}
                    </div>
                    <div className="col-span-2 font-mono text-xs text-muted-foreground truncate">
                      {ev.tool || '-'}
                    </div>
                    <div className="col-span-2 font-mono text-xs text-muted-foreground truncate">
                      {ev.resumeKey || '-'}
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-2 ml-6 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="text-muted-foreground">
                          <span className="font-medium text-foreground">{formatMessage({ id: 'issues.observability.table.workingDir' })}: </span>
                          <span className="font-mono break-all">{ev.workingDir || '-'}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium text-foreground">{formatMessage({ id: 'issues.observability.table.ip' })}: </span>
                          <span className="font-mono break-all">{ev.ip || '-'}</span>
                        </div>
                      </div>
                      {ev.userAgent && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{formatMessage({ id: 'issues.observability.table.userAgent' })}: </span>
                          <span className="font-mono break-all">{ev.userAgent}</span>
                        </div>
                      )}
                      <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto">
                        {JSON.stringify(ev.details ?? {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export default ObservabilityPanel;
