// ========================================
// Remote Notification Settings Section
// ========================================
// Configuration UI for remote notification platforms

import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Bell,
  BellOff,
  RefreshCw,
  Check,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  RemoteNotificationConfig,
  NotificationPlatform,
  EventConfig,
  DiscordConfig,
  TelegramConfig,
  WebhookConfig,
  FeishuConfig,
  DingTalkConfig,
  WeComConfig,
  EmailConfig,
} from '@/types/remote-notification';
import { PLATFORM_INFO, EVENT_INFO, getDefaultConfig } from '@/types/remote-notification';
import { PlatformConfigCards } from './PlatformConfigCards';

interface RemoteNotificationSectionProps {
  className?: string;
}

export function RemoteNotificationSection({ className }: RemoteNotificationSectionProps) {
  const { formatMessage } = useIntl();
  const [config, setConfig] = useState<RemoteNotificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<NotificationPlatform | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<NotificationPlatform | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  // Load configuration
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/remote/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        // Use default config if not found
        setConfig(getDefaultConfig());
      }
    } catch (error) {
      console.error('Failed to load remote notification config:', error);
      setConfig(getDefaultConfig());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Save configuration
  const saveConfig = useCallback(async (newConfig: RemoteNotificationConfig) => {
    setSaving(true);
    try {
      const response = await fetch('/api/notifications/remote/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        toast.success(formatMessage({ id: 'settings.remoteNotifications.saved' }));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      toast.error(formatMessage({ id: 'settings.remoteNotifications.saveError' }));
    } finally {
      setSaving(false);
    }
  }, [formatMessage]);

  // Test platform
  const testPlatform = useCallback(async (
    platform: NotificationPlatform,
    platformConfig: DiscordConfig | TelegramConfig | WebhookConfig | FeishuConfig | DingTalkConfig | WeComConfig | EmailConfig
  ) => {
    setTesting(platform);
    try {
      const response = await fetch('/api/notifications/remote/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, config: platformConfig }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          formatMessage({ id: 'settings.remoteNotifications.testSuccess' }),
          { description: `${result.responseTime}ms` }
        );
      } else {
        toast.error(
          formatMessage({ id: 'settings.remoteNotifications.testFailed' }),
          { description: result.error }
        );
      }
    } catch (error) {
      toast.error(formatMessage({ id: 'settings.remoteNotifications.testError' }));
    } finally {
      setTesting(null);
    }
  }, [formatMessage]);

  // Toggle master switch
  const toggleEnabled = () => {
    if (!config) return;
    saveConfig({ ...config, enabled: !config.enabled });
  };

  // Update platform config
  const updatePlatformConfig = (
    platform: NotificationPlatform,
    updates: Partial<DiscordConfig | TelegramConfig | WebhookConfig | FeishuConfig | DingTalkConfig | WeComConfig | EmailConfig>
  ) => {
    if (!config) return;
    const newConfig = {
      ...config,
      platforms: {
        ...config.platforms,
        [platform]: {
          ...config.platforms[platform as keyof typeof config.platforms],
          ...updates,
        },
      },
    };
    setConfig(newConfig);
  };

  // Update event config
  const updateEventConfig = (eventIndex: number, updates: Partial<EventConfig>) => {
    if (!config) return;
    const newEvents = [...config.events];
    newEvents[eventIndex] = { ...newEvents[eventIndex], ...updates };
    setConfig({ ...config, events: newEvents });
  };

  // Toggle platform for event
  const toggleEventPlatform = (eventIndex: number, platform: NotificationPlatform) => {
    if (!config) return;
    const eventConfig = config.events[eventIndex];
    const platforms = eventConfig.platforms.includes(platform)
      ? eventConfig.platforms.filter((p) => p !== platform)
      : [...eventConfig.platforms, platform];
    updateEventConfig(eventIndex, { platforms });
  };

  // All available platforms
  const allPlatforms: NotificationPlatform[] = ['discord', 'telegram', 'feishu', 'dingtalk', 'wecom', 'email', 'webhook'];

  // Reset to defaults
  const resetConfig = async () => {
    if (!confirm(formatMessage({ id: 'settings.remoteNotifications.resetConfirm' }))) {
      return;
    }
    try {
      const response = await fetch('/api/notifications/remote/reset', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        toast.success(formatMessage({ id: 'settings.remoteNotifications.resetSuccess' }));
      }
    } catch {
      toast.error(formatMessage({ id: 'settings.remoteNotifications.resetError' }));
    }
  };

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          {config.enabled ? (
            <Bell className="w-5 h-5 text-primary" />
          ) : (
            <BellOff className="w-5 h-5 text-muted-foreground" />
          )}
          {formatMessage({ id: 'settings.remoteNotifications.title' })}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConfig()}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
          <Button
            variant={config.enabled ? 'default' : 'outline'}
            size="sm"
            onClick={toggleEnabled}
          >
            {config.enabled ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                {formatMessage({ id: 'settings.remoteNotifications.enabled' })}
              </>
            ) : (
              <>
                <X className="w-4 h-4 mr-1" />
                {formatMessage({ id: 'settings.remoteNotifications.disabled' })}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6">
        {formatMessage({ id: 'settings.remoteNotifications.description' })}
      </p>

      {config.enabled && (
        <>
          {/* Platform Configuration */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'settings.remoteNotifications.platforms' })}
            </h3>
            <PlatformConfigCards
              config={config}
              expandedPlatform={expandedPlatform}
              testing={testing}
              onToggleExpand={setExpandedPlatform}
              onUpdateConfig={updatePlatformConfig}
              onTest={testPlatform}
              onSave={() => saveConfig(config)}
              saving={saving}
            />
          </div>

          {/* Event Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'settings.remoteNotifications.events' })}
            </h3>
            <div className="grid gap-3">
              {config.events.map((eventConfig, index) => {
                const info = EVENT_INFO[eventConfig.event];
                const isExpanded = expandedEvent === index;
                return (
                  <div
                    key={eventConfig.event}
                    className="rounded-lg border border-border bg-muted/30 overflow-hidden"
                  >
                    {/* Event Header */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedEvent(isExpanded ? null : index)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          eventConfig.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          <span className="text-sm">{info.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{info.name}</p>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Platform badges */}
                        <div className="flex gap-1 flex-wrap max-w-xs">
                          {eventConfig.platforms.slice(0, 3).map((platform) => (
                            <Badge key={platform} variant="secondary" className="text-xs">
                              {PLATFORM_INFO[platform].name}
                            </Badge>
                          ))}
                          {eventConfig.platforms.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{eventConfig.platforms.length - 3}
                            </Badge>
                          )}
                          {eventConfig.platforms.length === 0 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {formatMessage({ id: 'settings.remoteNotifications.noPlatforms' })}
                            </Badge>
                          )}
                        </div>
                        {/* Toggle */}
                        <Button
                          variant={eventConfig.enabled ? 'default' : 'outline'}
                          size="sm"
                          className="h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateEventConfig(index, { enabled: !eventConfig.enabled });
                          }}
                        >
                          {eventConfig.enabled ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        {/* Expand icon */}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content - Platform Selection */}
                    {isExpanded && (
                      <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                        <p className="text-xs text-muted-foreground">
                          {formatMessage({ id: 'settings.remoteNotifications.selectPlatforms' })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {allPlatforms.map((platform) => {
                            const isSelected = eventConfig.platforms.includes(platform);
                            const platformInfo = PLATFORM_INFO[platform];
                            const platformConfig = config.platforms[platform];
                            const isConfigured = platformConfig?.enabled;
                            return (
                              <Button
                                key={platform}
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                className={cn(
                                  'h-8',
                                  !isConfigured && !isSelected && 'opacity-50'
                                )}
                                onClick={() => toggleEventPlatform(index, platform)}
                              >
                                {isSelected && <Check className="w-3 h-3 mr-1" />}
                                {platformInfo.name}
                                {!isConfigured && !isSelected && (
                                  <Plus className="w-3 h-3 ml-1 opacity-50" />
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={resetConfig}
            >
              {formatMessage({ id: 'settings.remoteNotifications.reset' })}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => saveConfig(config)}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-1" />
              {saving
                ? formatMessage({ id: 'settings.remoteNotifications.saving' })
                : formatMessage({ id: 'settings.remoteNotifications.save' })}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export default RemoteNotificationSection;
