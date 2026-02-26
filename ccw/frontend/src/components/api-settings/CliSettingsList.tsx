// ========================================
// CLI Settings List Component
// ========================================
// Display CLI settings as cards with search, filter, and actions

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Settings,
  CheckCircle2,
  MoreVertical,
  Link as LinkIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  useCliSettings,
  useDeleteCliSettings,
  useToggleCliSettings,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { CliSettingsEndpoint } from '@/lib/api';

// ========== Types ==========

export interface CliSettingsListProps {
  onAddCliSettings: () => void;
  onEditCliSettings: (endpointId: string) => void;
}

// ========== Helper Components ==========

interface CliSettingsCardProps {
  cliSettings: CliSettingsEndpoint;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isDeleting: boolean;
  isToggling: boolean;
}

function CliSettingsCard({
  cliSettings,
  onEdit,
  onDelete,
  onToggleEnabled,
  isDeleting,
  isToggling,
}: CliSettingsCardProps) {
  const { formatMessage } = useIntl();

  // Display provider badge
  const getProviderBadge = () => {
    const provider = cliSettings.provider || 'claude';
    const variants: Record<string, { variant: 'secondary' | 'outline' | 'default'; label: string }> = {
      claude: { variant: 'secondary', label: 'Claude' },
      codex: { variant: 'outline', label: 'Codex' },
      gemini: { variant: 'default', label: 'Gemini' },
    };
    const config = variants[provider] || variants.claude;
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = () => {
    if (!cliSettings.enabled) {
      return <Badge variant="secondary">{formatMessage({ id: 'apiSettings.common.disabled' })}</Badge>;
    }
    return <Badge variant="success">{formatMessage({ id: 'apiSettings.common.enabled' })}</Badge>;
  };

  // Get provider-appropriate endpoint URL for display
  const endpointUrl = (() => {
    const env = cliSettings.settings.env;
    return env.ANTHROPIC_BASE_URL || env.OPENAI_BASE_URL || '';
  })();

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: CLI Settings Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground truncate">{cliSettings.name}</h3>
            {getStatusBadge()}
            {getProviderBadge()}
          </div>
          {cliSettings.description && (
            <p className="text-sm text-muted-foreground mt-1">{cliSettings.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Settings className="w-3 h-3" />
              {cliSettings.settings.model || 'default'}
            </span>
            {endpointUrl && (
              <span className="flex items-center gap-1 truncate max-w-[200px]" title={endpointUrl}>
                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                {endpointUrl}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Switch
            checked={cliSettings.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={isToggling}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.cliSettings.actions.edit' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} disabled={isDeleting} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.cliSettings.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

export function CliSettingsList({
  onAddCliSettings,
  onEditCliSettings,
}: CliSettingsListProps) {
  const { formatMessage } = useIntl();
  const { error } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    cliSettings,
    totalCount,
    enabledCount,
    providerCounts,
    isLoading,
    refetch,
  } = useCliSettings();

  const { deleteCliSettings, isDeleting } = useDeleteCliSettings();
  const { toggleCliSettings, isToggling } = useToggleCliSettings();

  // Filter settings by search query
  const filteredSettings = useMemo(() => {
    if (!searchQuery) return cliSettings;
    const query = searchQuery.toLowerCase();
    return cliSettings.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
    );
  }, [cliSettings, searchQuery]);

  // Handlers
  const handleDelete = async (endpointId: string) => {
    const settings = cliSettings.find((s) => s.id === endpointId);
    if (!settings) return;

    const confirmMessage = formatMessage(
      { id: 'apiSettings.cliSettings.deleteConfirm' },
      { name: settings.name }
    );

    if (confirm(confirmMessage)) {
      try {
        await deleteCliSettings(endpointId);
      } catch (err) {
        error(formatMessage({ id: 'apiSettings.cliSettings.deleteError' }));
      }
    }
  };

  const handleToggleEnabled = async (endpointId: string, enabled: boolean) => {
    try {
      await toggleCliSettings(endpointId, enabled);
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.cliSettings.toggleError' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.cliSettings.stats.total' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.cliSettings.stats.enabled' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{providerCounts.claude || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Claude</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{providerCounts.codex || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Codex</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{providerCounts.gemini || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Gemini</p>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'apiSettings.cliSettings.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button onClick={onAddCliSettings}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.cliSettings.actions.add' })}
          </Button>
        </div>
      </div>

      {/* CLI Settings Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredSettings.length === 0 ? (
        <Card className="p-8 text-center">
          <Settings className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'apiSettings.cliSettings.emptyState.title' })}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'apiSettings.cliSettings.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSettings.map((settings) => (
            <CliSettingsCard
              key={settings.id}
              cliSettings={settings}
              onEdit={() => onEditCliSettings(settings.id)}
              onDelete={() => handleDelete(settings.id)}
              onToggleEnabled={(enabled) => handleToggleEnabled(settings.id, enabled)}
              isDeleting={isDeleting}
              isToggling={isToggling}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CliSettingsList;
