// ========================================
// SkillHubCard Component
// ========================================
// Card component for displaying skills from hub with install/uninstall actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Download,
  RefreshCw,
  Check,
  Globe,
  Folder,
  Tag,
  User,
  Clock,
  MoreVertical,
  Info,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/Dropdown';
import { CliModeToggle, type CliMode } from '@/components/mcp/CliModeToggle';
import type { RemoteSkill, LocalSkill, InstalledSkill, CliType, SkillSource } from '@/hooks/useSkillHub';

// ========== Types ==========

export interface SkillHubCardProps {
  skill: RemoteSkill | LocalSkill;
  installedInfo?: InstalledSkill;
  source: SkillSource;
  onInstall?: (skill: RemoteSkill | LocalSkill, cliType: CliType) => Promise<void>;
  onUninstall?: (skill: RemoteSkill | LocalSkill, cliType: CliType) => Promise<void>;
  onViewDetails?: (skill: RemoteSkill | LocalSkill) => void;
  isInstalling?: boolean;
  className?: string;
  compact?: boolean;
}

// ========== Source Badge ==========

function SkillSourceBadge({ source }: { source: SkillSource }) {
  const { formatMessage } = useIntl();

  if (source === 'remote') {
    return (
      <Badge variant="default" className="gap-1">
        <Globe className="w-3 h-3" />
        {formatMessage({ id: 'skillHub.source.remote' })}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <Folder className="w-3 h-3" />
      {formatMessage({ id: 'skillHub.source.local' })}
    </Badge>
  );
}

// ========== Install Status Badge ==========

function InstallStatusBadge({ installedInfo }: { installedInfo?: InstalledSkill }) {
  const { formatMessage } = useIntl();

  if (!installedInfo) {
    return null;
  }

  if (installedInfo.updatesAvailable) {
    return (
      <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500">
        <RefreshCw className="w-3 h-3" />
        {formatMessage({ id: 'skillHub.status.updateAvailable' })}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-success border-success">
      <Check className="w-3 h-3" />
      {formatMessage({ id: 'skillHub.status.installed' })}
    </Badge>
  );
}

// ========== Main SkillHubCard Component ==========

export function SkillHubCard({
  skill,
  installedInfo,
  source,
  onInstall,
  onUninstall,
  onViewDetails,
  isInstalling = false,
  className,
  compact = false,
}: SkillHubCardProps) {
  const { formatMessage } = useIntl();
  const [cliMode, setCliMode] = useState<CliMode>('claude');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [localInstalling, setLocalInstalling] = useState(false);

  const isRemote = source === 'remote';
  const isInstalled = !!installedInfo;
  const isLoading = isInstalling || localInstalling;

  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalInstalling(true);
    try {
      await onInstall?.(skill, cliMode);
      toast.success(formatMessage({ id: 'skillHub.install.success' }, { name: skill.name }));
    } catch (error) {
      toast.error(formatMessage({ id: 'skillHub.install.error' }, { error: String(error) }));
    } finally {
      setLocalInstalling(false);
    }
  };

  const handleUninstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    try {
      await onUninstall?.(skill, installedInfo?.installedTo || cliMode);
      toast.success(formatMessage({ id: 'skillHub.uninstall.success' }, { name: skill.name }));
    } catch (error) {
      toast.error(formatMessage({ id: 'skillHub.uninstall.error' }, { error: String(error) }));
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onViewDetails?.(skill);
  };

  // Compact view
  if (compact) {
    return (
      <div
        className={cn(
          'p-3 bg-card border rounded-lg',
          'hover:shadow-md transition-all',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Download className="w-4 h-4 flex-shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground truncate">{skill.name}</span>
            {skill.version && (
              <span className="text-xs text-muted-foreground">v{skill.version}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CliModeToggle currentMode={cliMode} onModeChange={setCliMode} />
            <Button
              variant={isInstalled ? 'outline' : 'default'}
              size="sm"
              className="h-7 px-2"
              onClick={handleInstall}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : isInstalled ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {formatMessage({ id: 'skillHub.actions.update' })}
                </>
              ) : (
                <>
                  <Download className="w-3 h-3 mr-1" />
                  {formatMessage({ id: 'skillHub.actions.install' })}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <Card
      className={cn(
        'p-4 hover:shadow-md transition-all hover-glow hover:border-primary/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg flex-shrink-0 bg-primary/10">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">{skill.name}</h3>
              {skill.version && (
                <span className="text-xs text-muted-foreground">v{skill.version}</span>
              )}
            </div>
            {skill.author && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                {skill.author}
              </div>
            )}
          </div>
        </div>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleViewDetails}>
              <Info className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'skillHub.actions.viewDetails' })}
            </DropdownMenuItem>
            {isInstalled && (
              <DropdownMenuItem onClick={handleUninstall} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'skillHub.actions.uninstall' })}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
        {skill.description}
      </p>

      {/* Tags */}
      {skill.tags && skill.tags.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <Tag className="w-3 h-3" />
            {formatMessage({ id: 'skillHub.card.tags' })}
          </div>
          <div className="flex flex-wrap gap-1">
            {skill.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {skill.tags.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{skill.tags.length - 4}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Updated date (for remote skills) */}
      {isRemote && (skill as RemoteSkill).updatedAt && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatMessage(
            { id: 'skillHub.card.updated' },
            { date: new Date((skill as RemoteSkill).updatedAt as string).toLocaleDateString() }
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <SkillSourceBadge source={source} />
          {skill.category && (
            <Badge variant="outline" className="text-xs">
              {skill.category}
            </Badge>
          )}
          <InstallStatusBadge installedInfo={installedInfo} />
        </div>
      </div>

      {/* Install section */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <CliModeToggle currentMode={cliMode} onModeChange={setCliMode} />
        <Button
          variant={isInstalled ? 'outline' : 'default'}
          size="sm"
          onClick={handleInstall}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              {formatMessage({ id: 'skillHub.actions.installing' })}
            </>
          ) : isInstalled ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'skillHub.actions.update' })}
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'skillHub.actions.install' })}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

export default SkillHubCard;
