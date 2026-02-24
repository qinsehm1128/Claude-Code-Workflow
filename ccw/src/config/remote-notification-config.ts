// ========================================
// Remote Notification Configuration Manager
// ========================================
// Manages persistent storage of remote notification settings
// Storage: ~/.ccw/config/remote-notification.json

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getCCWHome, ensureStorageDir } from './storage-paths.js';
import type {
  RemoteNotificationConfig,
  DEFAULT_REMOTE_NOTIFICATION_CONFIG,
} from '../types/remote-notification.js';
import { DeepPartial, deepMerge } from '../types/util.js';

/**
 * Configuration file path
 */
function getConfigFilePath(): string {
  return join(getCCWHome(), 'config', 'remote-notification.json');
}

/**
 * Ensure configuration directory exists
 */
function ensureConfigDir(): void {
  const configDir = join(getCCWHome(), 'config');
  ensureStorageDir(configDir);
}

/**
 * Default configuration factory
 */
export function getDefaultConfig(): RemoteNotificationConfig {
  return {
    enabled: false,
    platforms: {},
    events: [
      { event: 'ask-user-question', platforms: ['discord', 'telegram'], enabled: true },
      { event: 'session-start', platforms: [], enabled: false },
      { event: 'session-end', platforms: [], enabled: false },
      { event: 'task-completed', platforms: [], enabled: false },
      { event: 'task-failed', platforms: ['discord', 'telegram'], enabled: true },
    ],
    timeout: 10000,
  };
}

/**
 * Load remote notification configuration
 * Returns default config if file doesn't exist
 */
export function loadConfig(): RemoteNotificationConfig {
  const configPath = getConfigFilePath();

  if (!existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const data = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Merge with defaults to ensure all fields exist
    return deepMerge(getDefaultConfig(), parsed);
  } catch (error) {
    console.error('[RemoteNotificationConfig] Failed to load config:', error);
    return getDefaultConfig();
  }
}

/**
 * Save remote notification configuration
 */
export function saveConfig(config: RemoteNotificationConfig): void {
  ensureConfigDir();
  const configPath = getConfigFilePath();

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('[RemoteNotificationConfig] Failed to save config:', error);
    throw error;
  }
}

/**
 * Update configuration with partial changes
 */
export function updateConfig(
  updates: DeepPartial<RemoteNotificationConfig>
): RemoteNotificationConfig {
  const current = loadConfig();
  const updated = deepMerge(current, updates);
  saveConfig(updated);
  return updated;
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): RemoteNotificationConfig {
  const defaultConfig = getDefaultConfig();
  saveConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Check if any platform is configured and enabled
 */
export function hasEnabledPlatform(config: RemoteNotificationConfig): boolean {
  if (!config.enabled) return false;

  const { discord, telegram, webhook } = config.platforms;

  return Boolean(
    (discord?.enabled && !!discord.webhookUrl) ||
    (telegram?.enabled && !!telegram.botToken && !!telegram.chatId) ||
    (webhook?.enabled && !!webhook.url)
  );
}

/**
 * Get enabled platforms for a specific event
 */
export function getEnabledPlatformsForEvent(
  config: RemoteNotificationConfig,
  eventType: string
): string[] {
  if (!config.enabled) return [];

  const eventConfig = config.events.find((e) => e.event === eventType);
  if (!eventConfig || !eventConfig.enabled) return [];

  return eventConfig.platforms.filter((platform) => {
    const platformConfig = config.platforms[platform as keyof typeof config.platforms];
    if (!platformConfig) return false;

    switch (platform) {
      case 'discord':
        return (platformConfig as { enabled: boolean; webhookUrl?: string }).enabled &&
               !!(platformConfig as { webhookUrl?: string }).webhookUrl;
      case 'telegram':
        return (platformConfig as { enabled: boolean; botToken?: string; chatId?: string }).enabled &&
               !!(platformConfig as { botToken?: string }).botToken &&
               !!(platformConfig as { chatId?: string }).chatId;
      case 'webhook':
        return (platformConfig as { enabled: boolean; url?: string }).enabled &&
               !!(platformConfig as { url?: string }).url;
      default:
        return false;
    }
  });
}
