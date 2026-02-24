// ========================================
// Remote Notification Service
// ========================================
// Core service for dispatching notifications to external platforms
// Non-blocking, best-effort delivery with parallel dispatch

import http from 'http';
import https from 'https';
import { URL } from 'url';
import type {
  RemoteNotificationConfig,
  NotificationContext,
  NotificationDispatchResult,
  PlatformNotificationResult,
  NotificationPlatform,
  DiscordConfig,
  TelegramConfig,
  WebhookConfig,
  FeishuConfig,
  DingTalkConfig,
  WeComConfig,
  EmailConfig,
} from '../../types/remote-notification.js';
import {
  loadConfig,
  getEnabledPlatformsForEvent,
  hasEnabledPlatform,
} from '../../config/remote-notification-config.js';

/**
 * Remote Notification Service
 * Handles dispatching notifications to configured platforms
 */
class RemoteNotificationService {
  private config: RemoteNotificationConfig | null = null;
  private configLoadedAt: number = 0;
  private readonly CONFIG_TTL = 30000; // Reload config every 30 seconds

  /**
   * Get current config (with auto-reload)
   */
  private getConfig(): RemoteNotificationConfig {
    const now = Date.now();
    if (!this.config || now - this.configLoadedAt > this.CONFIG_TTL) {
      this.config = loadConfig();
      this.configLoadedAt = now;
    }
    return this.config;
  }

  /**
   * Force reload configuration
   */
  reloadConfig(): void {
    this.config = loadConfig();
    this.configLoadedAt = Date.now();
  }

  /**
   * Check if notifications are enabled for a given event
   */
  shouldNotify(eventType: string): boolean {
    const config = this.getConfig();
    if (!config.enabled) return false;

    const enabledPlatforms = getEnabledPlatformsForEvent(config, eventType);
    return enabledPlatforms.length > 0;
  }

  /**
   * Send notification to all configured platforms for an event
   * Non-blocking: returns immediately, actual dispatch is async
   */
  sendNotification(
    eventType: string,
    context: Omit<NotificationContext, 'eventType' | 'timestamp'>
  ): void {
    const config = this.getConfig();

    // Quick check before async dispatch
    if (!config.enabled) return;

    const enabledPlatforms = getEnabledPlatformsForEvent(config, eventType);
    if (enabledPlatforms.length === 0) return;

    const fullContext: NotificationContext = {
      ...context,
      eventType: eventType as NotificationContext['eventType'],
      timestamp: new Date().toISOString(),
    };

    // Fire-and-forget dispatch
    this.dispatchToPlatforms(enabledPlatforms, fullContext, config).catch((error) => {
      // Silent failure - log only
      console.error('[RemoteNotification] Dispatch failed:', error);
    });
  }

  /**
   * Send notification and wait for results (for testing)
   */
  async sendNotificationAsync(
    eventType: string,
    context: Omit<NotificationContext, 'eventType' | 'timestamp'>
  ): Promise<NotificationDispatchResult> {
    const config = this.getConfig();
    const startTime = Date.now();

    if (!config.enabled) {
      return { success: false, results: [], totalTime: 0 };
    }

    const enabledPlatforms = getEnabledPlatformsForEvent(config, eventType);
    if (enabledPlatforms.length === 0) {
      return { success: false, results: [], totalTime: Date.now() - startTime };
    }

    const fullContext: NotificationContext = {
      ...context,
      eventType: eventType as NotificationContext['eventType'],
      timestamp: new Date().toISOString(),
    };

    const results = await this.dispatchToPlatforms(enabledPlatforms, fullContext, config);

    return {
      success: results.some((r) => r.success),
      results,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Dispatch to multiple platforms in parallel
   */
  private async dispatchToPlatforms(
    platforms: string[],
    context: NotificationContext,
    config: RemoteNotificationConfig
  ): Promise<PlatformNotificationResult[]> {
    const promises = platforms.map((platform) =>
      this.dispatchToPlatform(platform as NotificationPlatform, context, config)
    );

    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        platform: platforms[index] as NotificationPlatform,
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    });
  }

  /**
   * Dispatch to a single platform
   */
  private async dispatchToPlatform(
    platform: NotificationPlatform,
    context: NotificationContext,
    config: RemoteNotificationConfig
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    try {
      switch (platform) {
        case 'discord':
          return await this.sendDiscord(context, config.platforms.discord!, config.timeout);
        case 'telegram':
          return await this.sendTelegram(context, config.platforms.telegram!, config.timeout);
        case 'webhook':
          return await this.sendWebhook(context, config.platforms.webhook!, config.timeout);
        case 'feishu':
          return await this.sendFeishu(context, config.platforms.feishu!, config.timeout);
        case 'dingtalk':
          return await this.sendDingTalk(context, config.platforms.dingtalk!, config.timeout);
        case 'wecom':
          return await this.sendWeCom(context, config.platforms.wecom!, config.timeout);
        case 'email':
          return await this.sendEmail(context, config.platforms.email!, config.timeout);
        default:
          return {
            platform,
            success: false,
            error: `Unknown platform: ${platform}`,
          };
      }
    } catch (error) {
      return {
        platform,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Send Discord notification via webhook
   */
  private async sendDiscord(
    context: NotificationContext,
    config: DiscordConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.webhookUrl) {
      return { platform: 'discord', success: false, error: 'Webhook URL not configured' };
    }

    const embed = this.buildDiscordEmbed(context);
    const body = {
      username: config.username || 'CCW Notification',
      avatar_url: config.avatarUrl,
      embeds: [embed],
    };

    try {
      await this.httpRequest(config.webhookUrl, body, timeout);
      return {
        platform: 'discord',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'discord',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build Discord embed from context
   */
  private buildDiscordEmbed(context: NotificationContext): Record<string, unknown> {
    const eventEmoji: Record<string, string> = {
      'ask-user-question': '❓',
      'session-start': '▶️',
      'session-end': '⏹️',
      'task-completed': '✅',
      'task-failed': '❌',
    };

    const eventColors: Record<string, number> = {
      'ask-user-question': 0x3498db, // Blue
      'session-start': 0x2ecc71, // Green
      'session-end': 0x95a5a6, // Gray
      'task-completed': 0x27ae60, // Dark Green
      'task-failed': 0xe74c3c, // Red
    };

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    if (context.sessionId) {
      fields.push({ name: 'Session', value: context.sessionId.slice(0, 16) + '...', inline: true });
    }

    if (context.questionText) {
      const truncated = context.questionText.length > 200
        ? context.questionText.slice(0, 200) + '...'
        : context.questionText;
      fields.push({ name: 'Question', value: truncated, inline: false });
    }

    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 200
        ? context.taskDescription.slice(0, 200) + '...'
        : context.taskDescription;
      fields.push({ name: 'Task', value: truncated, inline: false });
    }

    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 200
        ? context.errorMessage.slice(0, 200) + '...'
        : context.errorMessage;
      fields.push({ name: 'Error', value: truncated, inline: false });
    }

    return {
      title: `${eventEmoji[context.eventType] || '📢'} ${this.formatEventName(context.eventType)}`,
      color: eventColors[context.eventType] || 0x9b59b6,
      fields,
      timestamp: context.timestamp,
      footer: { text: 'CCW Remote Notification' },
    };
  }

  /**
   * Send Telegram notification via Bot API
   */
  private async sendTelegram(
    context: NotificationContext,
    config: TelegramConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.botToken || !config.chatId) {
      return { platform: 'telegram', success: false, error: 'Bot token or chat ID not configured' };
    }

    const text = this.buildTelegramMessage(context);
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const body = {
      chat_id: config.chatId,
      text,
      parse_mode: config.parseMode || 'HTML',
    };

    try {
      await this.httpRequest(url, body, timeout);
      return {
        platform: 'telegram',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'telegram',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build Telegram message from context
   */
  private buildTelegramMessage(context: NotificationContext): string {
    const eventEmoji: Record<string, string> = {
      'ask-user-question': '❓',
      'session-start': '▶️',
      'session-end': '⏹️',
      'task-completed': '✅',
      'task-failed': '❌',
    };

    const lines: string[] = [];
    lines.push(`<b>${eventEmoji[context.eventType] || '📢'} ${this.formatEventName(context.eventType)}</b>`);
    lines.push('');

    if (context.sessionId) {
      lines.push(`<b>Session:</b> <code>${context.sessionId.slice(0, 16)}...</code>`);
    }

    if (context.questionText) {
      const truncated = context.questionText.length > 300
        ? context.questionText.slice(0, 300) + '...'
        : context.questionText;
      lines.push(`<b>Question:</b> ${this.escapeHtml(truncated)}`);
    }

    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 300
        ? context.taskDescription.slice(0, 300) + '...'
        : context.taskDescription;
      lines.push(`<b>Task:</b> ${this.escapeHtml(truncated)}`);
    }

    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 300
        ? context.errorMessage.slice(0, 300) + '...'
        : context.errorMessage;
      lines.push(`<b>Error:</b> <code>${this.escapeHtml(truncated)}</code>`);
    }

    lines.push('');
    lines.push(`<i>📅 ${new Date(context.timestamp).toLocaleString()}</i>`);

    return lines.join('\n');
  }

  /**
   * Send generic webhook notification
   */
  private async sendWebhook(
    context: NotificationContext,
    config: WebhookConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.url) {
      return { platform: 'webhook', success: false, error: 'Webhook URL not configured' };
    }

    const body = {
      event: context.eventType,
      timestamp: context.timestamp,
      sessionId: context.sessionId,
      questionText: context.questionText,
      taskDescription: context.taskDescription,
      errorMessage: context.errorMessage,
      metadata: context.metadata,
    };

    try {
      await this.httpRequest(config.url, body, config.timeout || timeout, config.method, config.headers);
      return {
        platform: 'webhook',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'webhook',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Send Feishu notification via webhook
   * Supports both rich card format and simple text format
   */
  private async sendFeishu(
    context: NotificationContext,
    config: FeishuConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.webhookUrl) {
      return { platform: 'feishu', success: false, error: 'Webhook URL not configured' };
    }

    const useCard = config.useCard !== false; // Default to true

    try {
      let body: unknown;

      if (useCard) {
        // Rich card format
        const card = this.buildFeishuCard(context, config);
        body = {
          msg_type: 'interactive',
          card,
        };
      } else {
        // Simple text format
        const text = this.buildFeishuText(context);
        body = {
          msg_type: 'post',
          content: {
            post: {
              zh_cn: {
                title: config.title || 'CCW Notification',
                content: [[{ tag: 'text', text }]],
              },
            },
          },
        };
      }

      await this.httpRequest(config.webhookUrl, body, timeout);
      return {
        platform: 'feishu',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'feishu',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build Feishu interactive card from context
   */
  private buildFeishuCard(context: NotificationContext, config: FeishuConfig): Record<string, unknown> {
    const elements: Array<Record<string, unknown>> = [];

    // Add event type as header
    elements.push({
      tag: 'markdown',
      content: `**${this.formatEventName(context.eventType)}**`,
      text_align: 'left' as const,
      text_size: 'normal_v2' as const,
    });

    // Add session info
    if (context.sessionId) {
      elements.push({
        tag: 'markdown',
        content: `**Session:** ${context.sessionId.slice(0, 16)}...`,
        text_align: 'left' as const,
        text_size: 'normal_v2' as const,
      });
    }

    // Add question text
    if (context.questionText) {
      const truncated = context.questionText.length > 300
        ? context.questionText.slice(0, 300) + '...'
        : context.questionText;
      elements.push({
        tag: 'markdown',
        content: `**Question:** ${this.escapeFeishuMarkdown(truncated)}`,
        text_align: 'left' as const,
        text_size: 'normal_v2' as const,
      });
    }

    // Add task description
    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 300
        ? context.taskDescription.slice(0, 300) + '...'
        : context.taskDescription;
      elements.push({
        tag: 'markdown',
        content: `**Task:** ${this.escapeFeishuMarkdown(truncated)}`,
        text_align: 'left' as const,
        text_size: 'normal_v2' as const,
      });
    }

    // Add error message
    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 300
        ? context.errorMessage.slice(0, 300) + '...'
        : context.errorMessage;
      elements.push({
        tag: 'markdown',
        content: `**Error:** ${this.escapeFeishuMarkdown(truncated)}`,
        text_align: 'left' as const,
        text_size: 'normal_v2' as const,
      });
    }

    // Add timestamp
    elements.push({
      tag: 'markdown',
      content: `**Time:** ${new Date(context.timestamp).toLocaleString()}`,
      text_align: 'left' as const,
      text_size: 'normal_v2' as const,
    });

    return {
      schema: '2.0',
      config: {
        update_multi: true,
        style: {
          text_size: {
            normal_v2: {
              default: 'normal',
              pc: 'normal',
              mobile: 'heading',
            },
          },
        },
      },
      header: {
        title: {
          tag: 'plain_text',
          content: config.title || 'CCW Notification',
        },
        template: 'wathet',
        padding: '12px 12px 12px 12px',
      },
      body: {
        direction: 'vertical',
        horizontal_spacing: '8px',
        vertical_spacing: '8px',
        horizontal_align: 'left',
        vertical_align: 'top',
        padding: '12px 12px 12px 12px',
        elements,
      },
    };
  }

  /**
   * Build Feishu simple text message
   */
  private buildFeishuText(context: NotificationContext): string {
    const lines: string[] = [];
    lines.push(`Event: ${this.formatEventName(context.eventType)}`);

    if (context.sessionId) {
      lines.push(`Session: ${context.sessionId.slice(0, 16)}...`);
    }
    if (context.questionText) {
      const truncated = context.questionText.length > 200
        ? context.questionText.slice(0, 200) + '...'
        : context.questionText;
      lines.push(`Question: ${truncated}`);
    }
    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 200
        ? context.taskDescription.slice(0, 200) + '...'
        : context.taskDescription;
      lines.push(`Task: ${truncated}`);
    }
    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 200
        ? context.errorMessage.slice(0, 200) + '...'
        : context.errorMessage;
      lines.push(`Error: ${truncated}`);
    }
    lines.push(`Time: ${new Date(context.timestamp).toLocaleString()}`);

    return lines.join('\n');
  }

  /**
   * Escape special characters for Feishu markdown
   */
  private escapeFeishuMarkdown(text: string): string {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Send DingTalk notification via webhook
   */
  private async sendDingTalk(
    context: NotificationContext,
    config: DingTalkConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.webhookUrl) {
      return { platform: 'dingtalk', success: false, error: 'Webhook URL not configured' };
    }

    const text = this.buildDingTalkText(context, config.keywords);

    const body = {
      msgtype: 'text',
      text: {
        content: text,
      },
    };

    try {
      await this.httpRequest(config.webhookUrl, body, timeout);
      return {
        platform: 'dingtalk',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'dingtalk',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build DingTalk text message
   */
  private buildDingTalkText(context: NotificationContext, keywords?: string[]): string {
    const lines: string[] = [];

    // Add keywords at the beginning if configured (for security check)
    if (keywords && keywords.length > 0) {
      lines.push(`[${keywords[0]}]`);
    }

    lines.push(`Event: ${this.formatEventName(context.eventType)}`);

    if (context.sessionId) {
      lines.push(`Session: ${context.sessionId.slice(0, 16)}...`);
    }
    if (context.questionText) {
      const truncated = context.questionText.length > 200
        ? context.questionText.slice(0, 200) + '...'
        : context.questionText;
      lines.push(`Question: ${truncated}`);
    }
    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 200
        ? context.taskDescription.slice(0, 200) + '...'
        : context.taskDescription;
      lines.push(`Task: ${truncated}`);
    }
    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 200
        ? context.errorMessage.slice(0, 200) + '...'
        : context.errorMessage;
      lines.push(`Error: ${truncated}`);
    }
    lines.push(`Time: ${new Date(context.timestamp).toLocaleString()}`);

    return lines.join('\n');
  }

  /**
   * Send WeCom (WeChat Work) notification via webhook
   */
  private async sendWeCom(
    context: NotificationContext,
    config: WeComConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.webhookUrl) {
      return { platform: 'wecom', success: false, error: 'Webhook URL not configured' };
    }

    const markdown = this.buildWeComMarkdown(context);

    const body: Record<string, unknown> = {
      msgtype: 'markdown',
      markdown: {
        content: markdown,
      },
    };

    // Add mentioned list if configured
    if (config.mentionedList && config.mentionedList.length > 0) {
      body.text = {
        content: markdown,
        mentioned_list: config.mentionedList,
      };
    }

    try {
      await this.httpRequest(config.webhookUrl, body, timeout);
      return {
        platform: 'wecom',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'wecom',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build WeCom markdown message
   */
  private buildWeComMarkdown(context: NotificationContext): string {
    const lines: string[] = [];
    lines.push(`### ${this.formatEventName(context.eventType)}`);
    lines.push('');

    if (context.sessionId) {
      lines.push(`> Session: \`${context.sessionId.slice(0, 16)}...\``);
    }
    if (context.questionText) {
      const truncated = context.questionText.length > 200
        ? context.questionText.slice(0, 200) + '...'
        : context.questionText;
      lines.push(`**Question:** ${truncated}`);
    }
    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 200
        ? context.taskDescription.slice(0, 200) + '...'
        : context.taskDescription;
      lines.push(`**Task:** ${truncated}`);
    }
    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 200
        ? context.errorMessage.slice(0, 200) + '...'
        : context.errorMessage;
      lines.push(`**Error:** <font color="warning">${truncated}</font>`);
    }
    lines.push('');
    lines.push(`Time: ${new Date(context.timestamp).toLocaleString()}`);

    return lines.join('\n');
  }

  /**
   * Send Email notification via SMTP
   */
  private async sendEmail(
    context: NotificationContext,
    config: EmailConfig,
    timeout: number
  ): Promise<PlatformNotificationResult> {
    const startTime = Date.now();

    if (!config.host || !config.username || !config.password || !config.from || !config.to || config.to.length === 0) {
      return { platform: 'email', success: false, error: 'Email configuration incomplete (host, username, password, from, to required)' };
    }

    try {
      // Dynamic import for nodemailer (optional dependency)
      const nodemailer = await this.loadNodemailer();

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port || 465,
        secure: config.secure !== false, // Default to true for port 465
        auth: {
          user: config.username,
          pass: config.password,
        },
      });

      const { subject, html } = this.buildEmailContent(context);

      // Set timeout for email sending
      await Promise.race([
        transporter.sendMail({
          from: config.from,
          to: config.to.join(', '),
          subject,
          html,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout')), timeout)
        ),
      ]);

      return {
        platform: 'email',
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform: 'email',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Load nodemailer module (optional dependency)
   */
  private async loadNodemailer(): Promise<{
    createTransport: (options: Record<string, unknown>) => {
      sendMail: (mailOptions: Record<string, unknown>) => Promise<unknown>;
    };
  }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('nodemailer');
    } catch {
      throw new Error('nodemailer not installed. Run: npm install nodemailer');
    }
  }

  /**
   * Build email subject and HTML content
   */
  private buildEmailContent(context: NotificationContext): { subject: string; html: string } {
    const subject = `[CCW] ${this.formatEventName(context.eventType)}`;

    const htmlParts: string[] = [];
    htmlParts.push('<!DOCTYPE html>');
    htmlParts.push('<html>');
    htmlParts.push('<head>');
    htmlParts.push('<meta charset="utf-8">');
    htmlParts.push('<style>');
    htmlParts.push('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }');
    htmlParts.push('.container { max-width: 600px; margin: 0 auto; padding: 20px; }');
    htmlParts.push('.header { background: #4a90d9; color: white; padding: 20px; border-radius: 8px 8px 0 0; }');
    htmlParts.push('.content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }');
    htmlParts.push('.field { margin-bottom: 15px; }');
    htmlParts.push('.label { font-weight: bold; color: #555; }');
    htmlParts.push('.value { margin-top: 5px; }');
    htmlParts.push('.error { background: #fff3f3; border-left: 4px solid #e74c3c; padding: 10px; }');
    htmlParts.push('.footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }');
    htmlParts.push('</style>');
    htmlParts.push('</head>');
    htmlParts.push('<body>');
    htmlParts.push('<div class="container">');

    // Header
    htmlParts.push('<div class="header">');
    htmlParts.push(`<h2 style="margin: 0;">${this.formatEventName(context.eventType)}</h2>`);
    htmlParts.push('</div>');

    // Content
    htmlParts.push('<div class="content">');

    if (context.sessionId) {
      htmlParts.push('<div class="field">');
      htmlParts.push('<div class="label">Session</div>');
      htmlParts.push(`<div class="value"><code>${context.sessionId}</code></div>`);
      htmlParts.push('</div>');
    }

    if (context.questionText) {
      const truncated = context.questionText.length > 500
        ? context.questionText.slice(0, 500) + '...'
        : context.questionText;
      htmlParts.push('<div class="field">');
      htmlParts.push('<div class="label">Question</div>');
      htmlParts.push(`<div class="value">${this.escapeHtml(truncated).replace(/\n/g, '<br>')}</div>`);
      htmlParts.push('</div>');
    }

    if (context.taskDescription) {
      const truncated = context.taskDescription.length > 500
        ? context.taskDescription.slice(0, 500) + '...'
        : context.taskDescription;
      htmlParts.push('<div class="field">');
      htmlParts.push('<div class="label">Task</div>');
      htmlParts.push(`<div class="value">${this.escapeHtml(truncated).replace(/\n/g, '<br>')}</div>`);
      htmlParts.push('</div>');
    }

    if (context.errorMessage) {
      const truncated = context.errorMessage.length > 500
        ? context.errorMessage.slice(0, 500) + '...'
        : context.errorMessage;
      htmlParts.push('<div class="field">');
      htmlParts.push('<div class="label">Error</div>');
      htmlParts.push(`<div class="value error">${this.escapeHtml(truncated).replace(/\n/g, '<br>')}</div>`);
      htmlParts.push('</div>');
    }

    htmlParts.push('<div class="field">');
    htmlParts.push('<div class="label">Timestamp</div>');
    htmlParts.push(`<div class="value">${new Date(context.timestamp).toLocaleString()}</div>`);
    htmlParts.push('</div>');

    htmlParts.push('</div>'); // content

    // Footer
    htmlParts.push('<div class="footer">');
    htmlParts.push('Sent by CCW Remote Notification System');
    htmlParts.push('</div>');

    htmlParts.push('</div>'); // container
    htmlParts.push('</body>');
    htmlParts.push('</html>');

    return { subject, html: htmlParts.join('\n') };
  }

  /**
   * Check if a URL is safe from SSRF attacks
   * Blocks private IP ranges, loopback, and link-local addresses
   */
  private isUrlSafe(urlString: string): { safe: boolean; error?: string } {
    try {
      const parsedUrl = new URL(urlString);

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { safe: false, error: 'Only http and https protocols are allowed' };
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      // Block localhost variants
      if (hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname === '0.0.0.0') {
        return { safe: false, error: 'Localhost addresses are not allowed' };
      }

      // Block IPv4 loopback (127.0.0.0/8)
      if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Loopback addresses are not allowed' };
      }

      // Block IPv4 private ranges
      // 10.0.0.0/8
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Private IP addresses are not allowed' };
      }
      // 172.16.0.0/12
      if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Private IP addresses are not allowed' };
      }
      // 192.168.0.0/16
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Private IP addresses are not allowed' };
      }

      // Block link-local addresses (169.254.0.0/16)
      if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { safe: false, error: 'Link-local addresses are not allowed' };
      }

      // Block IPv6 loopback and private
      if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname === '::') {
        return { safe: false, error: 'IPv6 private/loopback addresses are not allowed' };
      }

      // Block hostnames that look like IP addresses in various formats
      // (e.g., 0x7f.0.0.1, 2130706433, etc.)
      if (/^0x[0-9a-f]+/i.test(hostname) || /^\d{8,}$/.test(hostname)) {
        return { safe: false, error: 'Suspicious hostname format' };
      }

      // Block cloud metadata endpoints
      if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname === 'metadata.azure.internal') {
        return { safe: false, error: 'Cloud metadata endpoints are not allowed' };
      }

      return { safe: true };
    } catch (error) {
      return { safe: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Generic HTTP request helper
   */
  private httpRequest(
    url: string,
    body: unknown,
    timeout: number,
    method: 'POST' | 'PUT' = 'POST',
    headers: Record<string, string> = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // SSRF protection: validate URL before making request
      const urlSafety = this.isUrlSafe(url);
      if (!urlSafety.safe) {
        reject(new Error(`URL validation failed: ${urlSafety.error}`));
        return;
      }

      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout,
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * Format event name for display
   */
  private formatEventName(eventType: string): string {
    return eventType
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Escape HTML for Telegram messages
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Test a platform configuration
   */
  async testPlatform(
    platform: NotificationPlatform,
    config: DiscordConfig | TelegramConfig | WebhookConfig | FeishuConfig | DingTalkConfig | WeComConfig | EmailConfig
  ): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const testContext: NotificationContext = {
      eventType: 'task-completed',
      sessionId: 'test-session',
      taskDescription: 'This is a test notification from CCW',
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    try {
      switch (platform) {
        case 'discord':
          return await this.sendDiscord(testContext, config as DiscordConfig, 10000);
        case 'telegram':
          return await this.sendTelegram(testContext, config as TelegramConfig, 10000);
        case 'webhook':
          return await this.sendWebhook(testContext, config as WebhookConfig, 10000);
        case 'feishu':
          return await this.sendFeishu(testContext, config as FeishuConfig, 10000);
        case 'dingtalk':
          return await this.sendDingTalk(testContext, config as DingTalkConfig, 10000);
        case 'wecom':
          return await this.sendWeCom(testContext, config as WeComConfig, 10000);
        case 'email':
          return await this.sendEmail(testContext, config as EmailConfig, 30000); // Longer timeout for email
        default:
          return { success: false, error: `Unknown platform: ${platform}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      };
    }
  }
}

// Singleton instance
export const remoteNotificationService = new RemoteNotificationService();
