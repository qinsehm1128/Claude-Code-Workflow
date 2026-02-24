// ========================================
// Remote Notification Types
// ========================================
// Type definitions for remote notification system
// Supports Discord, Telegram, Feishu, DingTalk, WeCom, Email, and Generic Webhook platforms

/**
 * Supported notification platforms
 */
export type NotificationPlatform = 'discord' | 'telegram' | 'feishu' | 'dingtalk' | 'wecom' | 'email' | 'webhook';

/**
 * Event types that can trigger notifications
 */
export type NotificationEventType =
  | 'ask-user-question'   // AskUserQuestion triggered
  | 'session-start'       // CLI session started
  | 'session-end'         // CLI session ended
  | 'task-completed'      // Task completed successfully
  | 'task-failed';        // Task failed

/**
 * Discord platform configuration
 */
export interface DiscordConfig {
  /** Whether Discord notifications are enabled */
  enabled: boolean;
  /** Discord webhook URL */
  webhookUrl: string;
  /** Optional custom username for the webhook */
  username?: string;
  /** Optional avatar URL for the webhook */
  avatarUrl?: string;
}

/**
 * Telegram platform configuration
 */
export interface TelegramConfig {
  /** Whether Telegram notifications are enabled */
  enabled: boolean;
  /** Telegram bot token */
  botToken: string;
  /** Telegram chat ID (user or group) */
  chatId: string;
  /** Optional parse mode (HTML, Markdown, MarkdownV2) */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/**
 * Feishu (Lark) platform configuration
 */
export interface FeishuConfig {
  /** Whether Feishu notifications are enabled */
  enabled: boolean;
  /** Feishu webhook URL */
  webhookUrl: string;
  /** Use rich card format (default: true) */
  useCard?: boolean;
  /** Custom title for notifications */
  title?: string;
}

/**
 * DingTalk platform configuration
 */
export interface DingTalkConfig {
  /** Whether DingTalk notifications are enabled */
  enabled: boolean;
  /** DingTalk webhook URL */
  webhookUrl: string;
  /** Optional keywords for security check */
  keywords?: string[];
}

/**
 * WeCom (WeChat Work) platform configuration
 */
export interface WeComConfig {
  /** Whether WeCom notifications are enabled */
  enabled: boolean;
  /** WeCom webhook URL */
  webhookUrl: string;
  /** Mentioned user IDs (@all for all members) */
  mentionedList?: string[];
}

/**
 * Email SMTP platform configuration
 */
export interface EmailConfig {
  /** Whether Email notifications are enabled */
  enabled: boolean;
  /** SMTP server host */
  host: string;
  /** SMTP server port */
  port: number;
  /** Use secure connection (TLS) */
  secure?: boolean;
  /** SMTP username */
  username: string;
  /** SMTP password */
  password: string;
  /** Sender email address */
  from: string;
  /** Recipient email addresses */
  to: string[];
}

/**
 * Generic Webhook platform configuration
 */
export interface WebhookConfig {
  /** Whether webhook notifications are enabled */
  enabled: boolean;
  /** Webhook URL */
  url: string;
  /** HTTP method (POST or PUT) */
  method: 'POST' | 'PUT';
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Event configuration - maps events to platforms
 */
export interface EventConfig {
  /** Event type */
  event: NotificationEventType;
  /** Platforms to notify for this event */
  platforms: NotificationPlatform[];
  /** Whether this event's notifications are enabled */
  enabled: boolean;
}

/**
 * Full remote notification configuration
 */
export interface RemoteNotificationConfig {
  /** Master switch for all remote notifications */
  enabled: boolean;
  /** Platform-specific configurations */
  platforms: {
    discord?: DiscordConfig;
    telegram?: TelegramConfig;
    feishu?: FeishuConfig;
    dingtalk?: DingTalkConfig;
    wecom?: WeComConfig;
    email?: EmailConfig;
    webhook?: WebhookConfig;
  };
  /** Event-to-platform mappings */
  events: EventConfig[];
  /** Global timeout for all notification requests (ms) */
  timeout: number;
}

/**
 * Context passed when sending a notification
 */
export interface NotificationContext {
  /** Event type that triggered the notification */
  eventType: NotificationEventType;
  /** Session ID if applicable */
  sessionId?: string;
  /** Question text for ask-user-question events */
  questionText?: string;
  /** Task description for task events */
  taskDescription?: string;
  /** Error message for task-failed events */
  errorMessage?: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a single platform notification attempt
 */
export interface PlatformNotificationResult {
  /** Platform that was notified */
  platform: NotificationPlatform;
  /** Whether the notification succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Response time in milliseconds */
  responseTime?: number;
}

/**
 * Result of sending notifications to all configured platforms
 */
export interface NotificationDispatchResult {
  /** Whether at least one notification succeeded */
  success: boolean;
  /** Results for each platform */
  results: PlatformNotificationResult[];
  /** Total dispatch time in milliseconds */
  totalTime: number;
}

/**
 * Test notification request
 */
export interface TestNotificationRequest {
  /** Platform to test */
  platform: NotificationPlatform;
  /** Platform configuration to test (temporary, not saved) */
  config: DiscordConfig | TelegramConfig | WebhookConfig;
}

/**
 * Test notification result
 */
export interface TestNotificationResult {
  /** Whether the test succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Response time in milliseconds */
  responseTime?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_REMOTE_NOTIFICATION_CONFIG: RemoteNotificationConfig = {
  enabled: false,
  platforms: {},
  events: [
    { event: 'ask-user-question', platforms: ['discord', 'telegram'], enabled: true },
    { event: 'session-start', platforms: [], enabled: false },
    { event: 'session-end', platforms: [], enabled: false },
    { event: 'task-completed', platforms: [], enabled: false },
    { event: 'task-failed', platforms: ['discord', 'telegram'], enabled: true },
  ],
  timeout: 10000, // 10 seconds
};

/**
 * Mask sensitive fields in config for API responses
 */
export function maskSensitiveConfig(config: RemoteNotificationConfig): RemoteNotificationConfig {
  return {
    ...config,
    platforms: {
      discord: config.platforms.discord ? {
        ...config.platforms.discord,
        webhookUrl: maskWebhookUrl(config.platforms.discord.webhookUrl),
      } : undefined,
      telegram: config.platforms.telegram ? {
        ...config.platforms.telegram,
        botToken: maskToken(config.platforms.telegram.botToken),
      } : undefined,
      feishu: config.platforms.feishu ? {
        ...config.platforms.feishu,
        webhookUrl: maskWebhookUrl(config.platforms.feishu.webhookUrl),
      } : undefined,
      dingtalk: config.platforms.dingtalk ? {
        ...config.platforms.dingtalk,
        webhookUrl: maskWebhookUrl(config.platforms.dingtalk.webhookUrl),
      } : undefined,
      wecom: config.platforms.wecom ? {
        ...config.platforms.wecom,
        webhookUrl: maskWebhookUrl(config.platforms.wecom.webhookUrl),
      } : undefined,
      email: config.platforms.email ? {
        ...config.platforms.email,
        password: maskToken(config.platforms.email.password),
      } : undefined,
      webhook: config.platforms.webhook ? {
        ...config.platforms.webhook,
        // Don't mask webhook URL as it's needed for display
      } : undefined,
    },
  };
}

/**
 * Mask webhook URL for display (show only domain and last part)
 */
function maskWebhookUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.length > 8) {
      return `${parsed.origin}/.../${lastPart.slice(0, 4)}****`;
    }
    return `${parsed.origin}/****`;
  } catch {
    return '****';
  }
}

/**
 * Mask bot token for display
 */
function maskToken(token: string): string {
  if (!token || token.length < 10) return '****';
  return `${token.slice(0, 6)}****${token.slice(-4)}`;
}
