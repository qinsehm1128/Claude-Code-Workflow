// ========================================
// SkillHubDetailPanel Component
// ========================================
// Right-side slide-out panel for viewing skill hub skill details

import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  X,
  FileText,
  Tag,
  User,
  Globe,
  Folder,
  ExternalLink,
  Download,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CliModeToggle, type CliMode } from '@/components/mcp/CliModeToggle';
import type { RemoteSkill, LocalSkill, InstalledSkill, CliType, SkillSource } from '@/hooks/useSkillHub';

export interface SkillHubDetailPanelProps {
  skill: RemoteSkill | LocalSkill | null;
  isOpen: boolean;
  onClose: () => void;
  source: SkillSource;
  installedInfo?: InstalledSkill;
  onInstall?: (skill: RemoteSkill | LocalSkill, cliType: CliType) => Promise<void>;
  onUninstall?: (skill: RemoteSkill | LocalSkill, cliType: CliType) => Promise<void>;
  isInstalling?: boolean;
}

export function SkillHubDetailPanel({
  skill,
  isOpen,
  onClose,
  source,
  installedInfo,
  onInstall,
  onUninstall,
  isInstalling = false,
}: SkillHubDetailPanelProps) {
  const { formatMessage } = useIntl();
  const [cliMode, setCliMode] = useState<CliMode>('claude');
  const [localInstalling, setLocalInstalling] = useState(false);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isLoading = isInstalling || localInstalling;
  const isInstalled = !!installedInfo;
  const isRemote = source === 'remote';

  const handleInstall = async () => {
    if (!skill) return;
    setLocalInstalling(true);
    try {
      await onInstall?.(skill, cliMode);
    } finally {
      setLocalInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!skill) return;
    await onUninstall?.(skill, installedInfo?.installedTo || cliMode);
  };

  if (!isOpen || !skill) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 w-full sm:w-[480px] md:w-[560px] lg:w-[640px] h-full bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg flex-shrink-0 bg-primary/10">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">{skill.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {skill.version && <span>v{skill.version}</span>}
                {skill.author && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {skill.author}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={isRemote ? 'default' : 'secondary'} className="gap-1">
                {isRemote ? <Globe className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                {isRemote
                  ? formatMessage({ id: 'skillHub.source.remote' })
                  : formatMessage({ id: 'skillHub.source.local' })}
              </Badge>
              {skill.category && (
                <Badge variant="outline">{skill.category}</Badge>
              )}
              {isInstalled && (
                installedInfo?.updatesAvailable ? (
                  <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500">
                    <RefreshCw className="w-3 h-3" />
                    {formatMessage({ id: 'skillHub.status.updateAvailable' })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-success border-success">
                    <Check className="w-3 h-3" />
                    {formatMessage({ id: 'skillHub.status.installed' })}
                  </Badge>
                )
              )}
            </div>

            {/* Description */}
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                {formatMessage({ id: 'skills.card.description' })}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {skill.description || formatMessage({ id: 'skills.noDescription' })}
              </p>
            </section>

            {/* Tags */}
            {skill.tags && skill.tags.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skillHub.card.tags' })}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Metadata */}
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                {formatMessage({ id: 'skills.metadata' })}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {skill.version && (
                  <Card className="p-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skills.card.version' })}
                    </span>
                    <p className="text-sm font-medium text-foreground">v{skill.version}</p>
                  </Card>
                )}
                {skill.author && (
                  <Card className="p-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skills.card.author' })}
                    </span>
                    <p className="text-sm font-medium text-foreground">{skill.author}</p>
                  </Card>
                )}
                {skill.category && (
                  <Card className="p-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skills.card.category' })}
                    </span>
                    <p className="text-sm font-medium text-foreground">{skill.category}</p>
                  </Card>
                )}
                {isRemote && (skill as RemoteSkill).updatedAt && (
                  <Card className="p-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skillHub.card.updated' }, { date: '' }).trim()}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {new Date((skill as RemoteSkill).updatedAt as string).toLocaleDateString()}
                    </p>
                  </Card>
                )}
                {!isRemote && (skill as LocalSkill).path && (
                  <Card className="p-3 bg-muted/50 col-span-2">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skills.path' })}
                    </span>
                    <p className="text-sm font-mono text-foreground break-all">
                      {(skill as LocalSkill).path}
                    </p>
                  </Card>
                )}
              </div>
            </section>

            {/* Links (for remote skills) */}
            {isRemote && (
              (skill as RemoteSkill).readmeUrl ||
              (skill as RemoteSkill).homepage ||
              (skill as RemoteSkill).license
            ) && (
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {formatMessage({ id: 'skillHub.links' })}
                </h4>
                <div className="space-y-2">
                  {(skill as RemoteSkill).readmeUrl && (
                    <a
                      href={(skill as RemoteSkill).readmeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      README
                    </a>
                  )}
                  {(skill as RemoteSkill).homepage && (
                    <a
                      href={(skill as RemoteSkill).homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {formatMessage({ id: 'skillHub.homepage' })}
                    </a>
                  )}
                  {(skill as RemoteSkill).license && (
                    <div className="text-sm text-muted-foreground">
                      {formatMessage({ id: 'skillHub.license' })}: {(skill as RemoteSkill).license}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Installation Info */}
            {isInstalled && installedInfo && (
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {formatMessage({ id: 'skillHub.installationInfo' })}
                </h4>
                <Card className="p-3 bg-muted/50">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{formatMessage({ id: 'skillHub.installedTo' })}</span>
                      <span className="font-medium">{installedInfo.installedTo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{formatMessage({ id: 'skillHub.installedAt' })}</span>
                      <span className="font-medium">
                        {new Date(installedInfo.installedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {installedInfo.updatesAvailable && installedInfo.latestVersion && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{formatMessage({ id: 'skillHub.latestVersion' })}</span>
                        <span className="font-medium text-amber-500">v{installedInfo.latestVersion}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between gap-4">
            <CliModeToggle currentMode={cliMode} onModeChange={setCliMode} />
            <div className="flex gap-2">
              {isInstalled && (
                <Button
                  variant="outline"
                  onClick={handleUninstall}
                  className="text-destructive hover:text-destructive"
                >
                  {formatMessage({ id: 'skillHub.actions.uninstall' })}
                </Button>
              )}
              <Button
                variant={isInstalled ? 'outline' : 'default'}
                onClick={handleInstall}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {formatMessage({ id: 'skillHub.actions.installing' })}
                  </>
                ) : isInstalled ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {formatMessage({ id: 'skillHub.actions.update' })}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    {formatMessage({ id: 'skillHub.actions.install' })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SkillHubDetailPanel;
