// ========================================
// TickerMarquee Component
// ========================================
// Real-time scrolling ticker with CSS marquee animation and WebSocket messages

import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { useRealtimeUpdates, type TickerMessage } from '@/hooks/useRealtimeUpdates';
import {
  Play,
  CheckCircle2,
  Workflow,
  Activity,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

// --- Types ---

export interface TickerMarqueeProps {
  /** WebSocket endpoint path (default: 'ws/ticker-stream') */
  endpoint?: string;
  /** Animation duration in seconds (default: 30) */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
  /** Mock messages for development/testing */
  mockMessages?: TickerMessage[];
}

// --- Icon map ---

const typeIcons: Record<TickerMessage['type'], LucideIcon> = {
  session: Play,
  task: CheckCircle2,
  workflow: Workflow,
  status: Activity,
};

const typeColors: Record<TickerMessage['type'], string> = {
  session: 'text-primary',
  task: 'text-success',
  workflow: 'text-info',
  status: 'text-warning',
};

// --- Component ---

function TickerItem({ message }: { message: TickerMessage }) {
  const Icon = typeIcons[message.type] || Activity;
  const colorClass = typeColors[message.type] || 'text-muted-foreground';

  const content = (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-4">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', colorClass)} />
      <span className="text-sm text-text-secondary">{message.text}</span>
    </span>
  );

  if (message.link) {
    return (
      <a
        href={message.link}
        className="inline-flex hover:text-accent transition-colors"
        title={message.text}
      >
        {content}
      </a>
    );
  }

  return content;
}

function MessageList({ messages }: { messages: TickerMessage[] }) {
  return (
    <>
      {messages.map((msg) => (
        <TickerItem key={msg.id} message={msg} />
      ))}
    </>
  );
}

export function TickerMarquee({
  endpoint = 'ws/ticker-stream',
  duration = 30,
  className,
  mockMessages,
}: TickerMarqueeProps) {
  const { formatMessage } = useIntl();
  const { messages: wsMessages, connectionStatus } = useRealtimeUpdates(endpoint);

  const messages = mockMessages && mockMessages.length > 0 ? mockMessages : wsMessages;

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          'flex h-8 items-center justify-center overflow-hidden border-b border-border bg-surface/50',
          className
        )}
      >
        {connectionStatus === 'connected' ? (
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'common.ticker.waiting' })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            {formatMessage({ id: 'common.ticker.disconnected' })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex h-8 items-center overflow-hidden border-b border-border bg-surface/50',
        className
      )}
      role="marquee"
      aria-label={formatMessage({ id: 'common.ticker.aria_label' })}
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-surface/50 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-surface/50 to-transparent" />

      {/* Scrolling content - duplicate for seamless loop */}
      <div
        className="flex animate-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${duration}s` }}
      >
        <MessageList messages={messages} />
        {/* Duplicate for seamless loop */}
        <MessageList messages={messages} />
      </div>
    </div>
  );
}

export default TickerMarquee;
