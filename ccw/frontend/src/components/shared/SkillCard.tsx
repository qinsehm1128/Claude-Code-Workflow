// ========================================
// SkillCard Component
// ========================================
// Card component for displaying skills with enable/disable toggle

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Sparkles,
  MoreVertical,
  Info,
  Settings,
  Power,
  PowerOff,
  User,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/Dropdown';
import type { Skill } from '@/lib/api';

// ========== Types ==========

export interface SkillCardProps {
  skill: Skill;
  onToggle?: (skill: Skill, enabled: boolean) => void;
  onClick?: (skill: Skill) => void;
  onConfigure?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  isToggling?: boolean;
}

// ========== Source Badge ==========

// Source color configuration (without labels for i18n)
const sourceColorConfig: Record<NonNullable<Skill['source']>, { color: string }> = {
  builtin: { color: 'default' },
  custom: { color: 'secondary' },
  community: { color: 'outline' },
};

// Source label keys for i18n
const sourceLabelKeys: Record<NonNullable<Skill['source']>, string> = {
  builtin: 'skills.source.builtin',
  custom: 'skills.source.custom',
  community: 'skills.source.community',
};

export function SourceBadge({ source }: { source?: Skill['source'] }) {
  const { formatMessage } = useIntl();
  const config = sourceColorConfig[source ?? 'builtin'];
  const label = sourceLabelKeys[source ?? 'builtin']
    ? formatMessage({ id: sourceLabelKeys[source ?? 'builtin'] })
    : source ?? 'builtin';
  return (
    <Badge variant={config.color as 'default' | 'secondary' | 'destructive' | 'outline'}>
      {label}
    </Badge>
  );
}

// ========== Main SkillCard Component ==========

export function SkillCard({
  skill,
  onToggle,
  onClick,
  onConfigure,
  onDelete,
  className,
  compact = false,
  showActions = true,
  isToggling = false,
}: SkillCardProps) {
  const { formatMessage } = useIntl();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClick = () => {
    if (!isMenuOpen) {
      onClick?.(skill);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.(skill, !skill.enabled);
  };

  const handleConfigure = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onConfigure?.(skill);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onDelete?.(skill);
  };

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'p-3 bg-card border rounded-lg cursor-pointer',
          'hover:shadow-md transition-all hover-glow',
          skill.enabled ? 'border-border hover:border-primary/50' : 'border-dashed border-muted-foreground/50 bg-muted/50 grayscale-[0.5]',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className={cn('w-4 h-4 flex-shrink-0', skill.enabled ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-medium text-foreground truncate">{skill.name}</span>
          </div>
          <Button
            variant={skill.enabled ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2"
            onClick={handleToggle}
            disabled={isToggling}
          >
            {skill.enabled ? (
              <>
                <Power className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'skills.state.on' })}
              </>
            ) : (
              <>
                <PowerOff className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'skills.state.off' })}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card
      onClick={handleClick}
      className={cn(
        'p-4 cursor-pointer transition-all hover-glow',
        skill.enabled
          ? 'border-primary/20 bg-primary/[0.02] hover:border-primary/40 hover:shadow-md'
          : 'border-border/50 hover:border-border hover:shadow-sm',
        className
      )}
    >
      {/* Header - Icon, Title, Version on left; Source Badge, Enable Button, Actions Menu on right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Icon */}
          <div className={cn(
            'p-2 rounded-lg flex-shrink-0',
            skill.enabled ? 'bg-primary/10' : 'bg-muted'
          )}>
            <Sparkles className={cn('w-5 h-5', skill.enabled ? 'text-primary' : 'text-muted-foreground')} />
          </div>

          {/* Title and Version */}
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">{skill.name}</h3>
            {skill.version && (
              <p className="text-xs text-muted-foreground">v{skill.version}</p>
            )}
          </div>
        </div>

        {/* Right side: Source Badge, Enable Icon Button, Actions Menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SourceBadge source={skill.source} />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/10"
            onClick={handleToggle}
            disabled={isToggling}
            title={skill.enabled ? formatMessage({ id: 'skills.state.enabled' }) : formatMessage({ id: 'skills.state.disabled' })}
          >
            {skill.enabled ? (
              <Power className="w-4 h-4 text-primary" />
            ) : (
              <PowerOff className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          {showActions && (
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onClick?.(skill)}>
                  <Info className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'skills.actions.viewDetails' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleConfigure}>
                  <Settings className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'skills.actions.configure' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggle}>
                  {skill.enabled ? (
                    <>
                      <PowerOff className="w-4 h-4 mr-2" />
                      {formatMessage({ id: 'skills.actions.disable' })}
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 mr-2" />
                      {formatMessage({ id: 'skills.actions.enable' })}
                    </>
                  )}
                </DropdownMenuItem>
                {onDelete && skill.source !== 'builtin' && (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {formatMessage({ id: 'skills.actions.delete' })}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
        {skill.description}
      </p>

      {/* Footer - Tags, Category, Author */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border flex-wrap">
        {/* Tags (first 2 triggers) */}
        {skill.triggers && skill.triggers.length > 0 && (
          <>
            {skill.triggers.slice(0, 2).map((trigger) => (
              <Badge key={trigger} variant="outline" className="text-xs">
                {trigger}
              </Badge>
            ))}
            {skill.triggers.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{skill.triggers.length - 2}
              </Badge>
            )}
          </>
        )}
        {skill.category && (
          <Badge variant="outline" className="text-xs">
            {skill.category}
          </Badge>
        )}
        {skill.author && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            {skill.author}
          </div>
        )}
      </div>
    </Card>
  );
}

export default SkillCard;
