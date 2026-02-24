// ========================================
// Remote Notification Routes
// ========================================
// API endpoints for remote notification configuration

import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import {
  loadConfig,
  saveConfig,
  resetConfig,
} from '../../config/remote-notification-config.js';
import {
  remoteNotificationService,
} from '../services/remote-notification-service.js';
import {
  maskSensitiveConfig,
  type RemoteNotificationConfig,
  type TestNotificationRequest,
  type NotificationPlatform,
  type DiscordConfig,
  type TelegramConfig,
  type WebhookConfig,
  type FeishuConfig,
  type DingTalkConfig,
  type WeComConfig,
  type EmailConfig,
} from '../../types/remote-notification.js';
import { deepMerge } from '../../types/util.js';

// ========== Input Validation ==========

/**
 * Validate URL format (must be http or https)
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate Discord webhook URL format
 */
function isValidDiscordWebhookUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  try {
    const parsed = new URL(url);
    // Discord webhooks are typically: discord.com/api/webhooks/{id}/{token}
    return (
      (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

/**
 * Validate Telegram bot token format (typically: 123456789:ABCdef...)
 */
function isValidTelegramBotToken(token: string): boolean {
  // Telegram bot tokens are in format: {bot_id}:{token}
  // Bot ID is a number, token is alphanumeric with underscores and hyphens
  return /^\d{8,15}:[A-Za-z0-9_-]{30,50}$/.test(token);
}

/**
 * Validate Telegram chat ID format
 */
function isValidTelegramChatId(chatId: string): boolean {
  // Chat IDs are numeric, optionally negative (for groups)
  return /^-?\d{1,20}$/.test(chatId);
}

/**
 * Validate webhook headers (must be valid JSON object)
 */
function isValidHeaders(headers: unknown): { valid: boolean; error?: string } {
  if (headers === undefined || headers === null) {
    return { valid: true }; // Optional field
  }

  if (typeof headers !== 'object' || Array.isArray(headers)) {
    return { valid: false, error: 'Headers must be an object' };
  }

  const headerObj = headers as Record<string, unknown>;

  // Check for reasonable size limit (10KB)
  const serialized = JSON.stringify(headers);
  if (serialized.length > 10240) {
    return { valid: false, error: 'Headers too large (max 10KB)' };
  }

  // Validate each header key and value
  for (const [key, value] of Object.entries(headerObj)) {
    if (typeof key !== 'string' || key.length === 0) {
      return { valid: false, error: 'Header keys must be non-empty strings' };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: `Header '${key}' value must be a string` };
    }
    // Block potentially dangerous headers
    const lowerKey = key.toLowerCase();
    if (['host', 'content-length', 'connection'].includes(lowerKey)) {
      return { valid: false, error: `Header '${key}' is not allowed` };
    }
  }

  return { valid: true };
}

/**
 * Validate Feishu webhook URL format
 */
function isValidFeishuWebhookUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  try {
    const parsed = new URL(url);
    // Feishu webhooks are typically: open.feishu.cn/open-apis/bot/v2/hook/{token}
    // or: open.larksuite.com/open-apis/bot/v2/hook/{token}
    const validHosts = ['open.feishu.cn', 'open.larksuite.com'];
    return validHosts.includes(parsed.hostname) && parsed.pathname.includes('/bot/');
  } catch {
    return false;
  }
}

/**
 * Validate DingTalk webhook URL format
 */
function isValidDingTalkWebhookUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  try {
    const parsed = new URL(url);
    // DingTalk webhooks are typically: oapi.dingtalk.com/robot/send?access_token=xxx
    return parsed.hostname.includes('dingtalk.com') && parsed.pathname.includes('robot');
  } catch {
    return false;
  }
}

/**
 * Validate WeCom webhook URL format
 */
function isValidWeComWebhookUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  try {
    const parsed = new URL(url);
    // WeCom webhooks are typically: qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
    return parsed.hostname.includes('qyapi.weixin.qq.com') && parsed.pathname.includes('webhook');
  } catch {
    return false;
  }
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  // Basic email validation regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate SMTP port number
 */
function isValidSmtpPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Validate configuration updates
 */
function validateConfigUpdates(updates: Partial<RemoteNotificationConfig>): { valid: boolean; error?: string } {
  // Validate platforms if present
  if (updates.platforms) {
    const { discord, telegram, webhook, feishu, dingtalk, wecom, email } = updates.platforms;

    // Validate Discord config
    if (discord) {
      if (discord.webhookUrl !== undefined && discord.webhookUrl !== '') {
        if (!isValidUrl(discord.webhookUrl)) {
          return { valid: false, error: 'Invalid Discord webhook URL format' };
        }
        // Warning: we allow non-Discord URLs for flexibility, but log it
        if (!isValidDiscordWebhookUrl(discord.webhookUrl)) {
          console.warn('[RemoteNotification] Webhook URL does not match Discord format');
        }
      }
      if (discord.username !== undefined && discord.username.length > 80) {
        return { valid: false, error: 'Discord username too long (max 80 chars)' };
      }
    }

    // Validate Telegram config
    if (telegram) {
      if (telegram.botToken !== undefined && telegram.botToken !== '') {
        if (!isValidTelegramBotToken(telegram.botToken)) {
          return { valid: false, error: 'Invalid Telegram bot token format' };
        }
      }
      if (telegram.chatId !== undefined && telegram.chatId !== '') {
        if (!isValidTelegramChatId(telegram.chatId)) {
          return { valid: false, error: 'Invalid Telegram chat ID format' };
        }
      }
    }

    // Validate Webhook config
    if (webhook) {
      if (webhook.url !== undefined && webhook.url !== '') {
        if (!isValidUrl(webhook.url)) {
          return { valid: false, error: 'Invalid webhook URL format' };
        }
      }
      if (webhook.headers !== undefined) {
        const headerValidation = isValidHeaders(webhook.headers);
        if (!headerValidation.valid) {
          return { valid: false, error: headerValidation.error };
        }
      }
      if (webhook.timeout !== undefined && (webhook.timeout < 1000 || webhook.timeout > 60000)) {
        return { valid: false, error: 'Webhook timeout must be between 1000ms and 60000ms' };
      }
    }

    // Validate Feishu config
    if (feishu) {
      if (feishu.webhookUrl !== undefined && feishu.webhookUrl !== '') {
        if (!isValidUrl(feishu.webhookUrl)) {
          return { valid: false, error: 'Invalid Feishu webhook URL format' };
        }
        if (!isValidFeishuWebhookUrl(feishu.webhookUrl)) {
          console.warn('[RemoteNotification] Webhook URL does not match Feishu format');
        }
      }
      if (feishu.title !== undefined && feishu.title.length > 100) {
        return { valid: false, error: 'Feishu title too long (max 100 chars)' };
      }
    }

    // Validate DingTalk config
    if (dingtalk) {
      if (dingtalk.webhookUrl !== undefined && dingtalk.webhookUrl !== '') {
        if (!isValidUrl(dingtalk.webhookUrl)) {
          return { valid: false, error: 'Invalid DingTalk webhook URL format' };
        }
        if (!isValidDingTalkWebhookUrl(dingtalk.webhookUrl)) {
          console.warn('[RemoteNotification] Webhook URL does not match DingTalk format');
        }
      }
      if (dingtalk.keywords !== undefined) {
        if (!Array.isArray(dingtalk.keywords)) {
          return { valid: false, error: 'DingTalk keywords must be an array' };
        }
        if (dingtalk.keywords.length > 10) {
          return { valid: false, error: 'Too many DingTalk keywords (max 10)' };
        }
      }
    }

    // Validate WeCom config
    if (wecom) {
      if (wecom.webhookUrl !== undefined && wecom.webhookUrl !== '') {
        if (!isValidUrl(wecom.webhookUrl)) {
          return { valid: false, error: 'Invalid WeCom webhook URL format' };
        }
        if (!isValidWeComWebhookUrl(wecom.webhookUrl)) {
          console.warn('[RemoteNotification] Webhook URL does not match WeCom format');
        }
      }
      if (wecom.mentionedList !== undefined) {
        if (!Array.isArray(wecom.mentionedList)) {
          return { valid: false, error: 'WeCom mentionedList must be an array' };
        }
        if (wecom.mentionedList.length > 100) {
          return { valid: false, error: 'Too many mentioned users (max 100)' };
        }
      }
    }

    // Validate Email config
    if (email) {
      if (email.host !== undefined && email.host !== '') {
        if (email.host.length > 255) {
          return { valid: false, error: 'Email host too long (max 255 chars)' };
        }
      }
      if (email.port !== undefined) {
        if (!isValidSmtpPort(email.port)) {
          return { valid: false, error: 'Invalid SMTP port (must be 1-65535)' };
        }
      }
      if (email.username !== undefined && email.username.length > 255) {
        return { valid: false, error: 'Email username too long (max 255 chars)' };
      }
      if (email.from !== undefined && email.from !== '') {
        if (!isValidEmail(email.from)) {
          return { valid: false, error: 'Invalid sender email address' };
        }
      }
      if (email.to !== undefined) {
        if (!Array.isArray(email.to)) {
          return { valid: false, error: 'Email recipients must be an array' };
        }
        if (email.to.length === 0) {
          return { valid: false, error: 'At least one email recipient is required' };
        }
        if (email.to.length > 50) {
          return { valid: false, error: 'Too many email recipients (max 50)' };
        }
        for (const addr of email.to) {
          if (!isValidEmail(addr)) {
            return { valid: false, error: `Invalid email address: ${addr}` };
          }
        }
      }
    }
  }

  // Validate timeout
  if (updates.timeout !== undefined && (updates.timeout < 1000 || updates.timeout > 60000)) {
    return { valid: false, error: 'Timeout must be between 1000ms and 60000ms' };
  }

  return { valid: true };
}

/**
 * Validate test notification request
 */
function validateTestRequest(request: TestNotificationRequest): { valid: boolean; error?: string } {
  if (!request.platform) {
    return { valid: false, error: 'Missing platform' };
  }

  const validPlatforms: NotificationPlatform[] = ['discord', 'telegram', 'webhook', 'feishu', 'dingtalk', 'wecom', 'email'];
  if (!validPlatforms.includes(request.platform as NotificationPlatform)) {
    return { valid: false, error: `Invalid platform: ${request.platform}` };
  }

  if (!request.config) {
    return { valid: false, error: 'Missing config' };
  }

  // Platform-specific validation
  switch (request.platform) {
    case 'discord': {
      const config = request.config as Partial<DiscordConfig>;
      if (!config.webhookUrl) {
        return { valid: false, error: 'Discord webhook URL is required' };
      }
      if (!isValidUrl(config.webhookUrl)) {
        return { valid: false, error: 'Invalid Discord webhook URL format' };
      }
      break;
    }
    case 'telegram': {
      const config = request.config as Partial<TelegramConfig>;
      if (!config.botToken) {
        return { valid: false, error: 'Telegram bot token is required' };
      }
      if (!config.chatId) {
        return { valid: false, error: 'Telegram chat ID is required' };
      }
      if (!isValidTelegramBotToken(config.botToken)) {
        return { valid: false, error: 'Invalid Telegram bot token format' };
      }
      if (!isValidTelegramChatId(config.chatId)) {
        return { valid: false, error: 'Invalid Telegram chat ID format' };
      }
      break;
    }
    case 'webhook': {
      const config = request.config as Partial<WebhookConfig>;
      if (!config.url) {
        return { valid: false, error: 'Webhook URL is required' };
      }
      if (!isValidUrl(config.url)) {
        return { valid: false, error: 'Invalid webhook URL format' };
      }
      if (config.headers) {
        const headerValidation = isValidHeaders(config.headers);
        if (!headerValidation.valid) {
          return { valid: false, error: headerValidation.error };
        }
      }
      break;
    }
    case 'feishu': {
      const config = request.config as Partial<FeishuConfig>;
      if (!config.webhookUrl) {
        return { valid: false, error: 'Feishu webhook URL is required' };
      }
      if (!isValidUrl(config.webhookUrl)) {
        return { valid: false, error: 'Invalid Feishu webhook URL format' };
      }
      break;
    }
    case 'dingtalk': {
      const config = request.config as Partial<DingTalkConfig>;
      if (!config.webhookUrl) {
        return { valid: false, error: 'DingTalk webhook URL is required' };
      }
      if (!isValidUrl(config.webhookUrl)) {
        return { valid: false, error: 'Invalid DingTalk webhook URL format' };
      }
      break;
    }
    case 'wecom': {
      const config = request.config as Partial<WeComConfig>;
      if (!config.webhookUrl) {
        return { valid: false, error: 'WeCom webhook URL is required' };
      }
      if (!isValidUrl(config.webhookUrl)) {
        return { valid: false, error: 'Invalid WeCom webhook URL format' };
      }
      break;
    }
    case 'email': {
      const config = request.config as Partial<EmailConfig>;
      if (!config.host) {
        return { valid: false, error: 'SMTP host is required' };
      }
      if (!config.username) {
        return { valid: false, error: 'SMTP username is required' };
      }
      if (!config.password) {
        return { valid: false, error: 'SMTP password is required' };
      }
      if (!config.from) {
        return { valid: false, error: 'Sender email address is required' };
      }
      if (!isValidEmail(config.from)) {
        return { valid: false, error: 'Invalid sender email address' };
      }
      if (!config.to || config.to.length === 0) {
        return { valid: false, error: 'At least one recipient email is required' };
      }
      for (const addr of config.to) {
        if (!isValidEmail(addr)) {
          return { valid: false, error: `Invalid recipient email: ${addr}` };
        }
      }
      if (config.port !== undefined && !isValidSmtpPort(config.port)) {
        return { valid: false, error: 'Invalid SMTP port' };
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * Handle remote notification routes
 * GET /api/notifications/remote/config - Get current config
 * POST /api/notifications/remote/config - Update config
 * POST /api/notifications/remote/test - Test notification
 * POST /api/notifications/remote/reset - Reset to defaults
 */
export async function handleNotificationRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  // GET /api/notifications/remote/config
  if (pathname === '/api/notifications/remote/config' && req.method === 'GET') {
    const config = loadConfig();
    const masked = maskSensitiveConfig(config);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(masked));
    return true;
  }

  // POST /api/notifications/remote/config
  if (pathname === '/api/notifications/remote/config' && req.method === 'POST') {
    const body = await readBody(req);

    try {
      const updates = JSON.parse(body) as Partial<RemoteNotificationConfig>;

      // Validate input
      const validation = validateConfigUpdates(updates);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validation.error }));
        return true;
      }

      const current = loadConfig();
      const updated = deepMerge(current, updates);

      saveConfig(updated);

      // Reload service config
      remoteNotificationService.reloadConfig();

      const masked = maskSensitiveConfig(updated);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config: masked }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Invalid configuration',
      }));
    }
    return true;
  }

  // POST /api/notifications/remote/test
  if (pathname === '/api/notifications/remote/test' && req.method === 'POST') {
    const body = await readBody(req);

    try {
      const request = JSON.parse(body) as TestNotificationRequest;

      // Validate input
      const validation = validateTestRequest(request);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: validation.error }));
        return true;
      }

      const result = await remoteNotificationService.testPlatform(
        request.platform as NotificationPlatform,
        request.config
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request',
      }));
    }
    return true;
  }

  // POST /api/notifications/remote/reset
  if (pathname === '/api/notifications/remote/reset' && req.method === 'POST') {
    const config = resetConfig();
    remoteNotificationService.reloadConfig();

    const masked = maskSensitiveConfig(config);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, config: masked }));
    return true;
  }

  return false;
}

/**
 * Read request body as string
 */
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
