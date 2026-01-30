// ========================================
// SkillCard Component
// ========================================
// Card component for displaying skills with enable/disable toggle

import { useState } from 'react';
import {
  Sparkles,
  MoreVertical,
  Info,
  Settings,
  Power,
  PowerOff,
  Tag,
  User,
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
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  isToggling?: boolean;
}

// ========== Source Badge ==========

const sourceConfig: Record<NonNullable<Skill['source']>, { color: string; label: string }> = {
  builtin: { color: 'default', label: 'Built-in' },
  custom: { color: 'secondary', label: 'Custom' },
  community: { color: 'outline', label: 'Community' },
};

export function SourceBadge({ source }: { source?: Skill['source'] }) {
  const config = sourceConfig[source ?? 'builtin'];
  return (
    <Badge variant={config.color as 'default' | 'secondary' | 'destructive' | 'outline'}>
      {config.label}
    </Badge>
  );
}

// ========== Main SkillCard Component ==========

export function SkillCard({
  skill,
  onToggle,
  onClick,
  onConfigure,
  className,
  compact = false,
  showActions = true,
  isToggling = false,
}: SkillCardProps) {
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

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'p-3 bg-card border border-border rounded-lg cursor-pointer',
          'hover:shadow-md hover:border-primary/50 transition-all',
          !skill.enabled && 'opacity-60',
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
                On
              </>
            ) : (
              <>
                <PowerOff className="w-3 h-3 mr-1" />
                Off
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
        'p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all',
        !skill.enabled && 'opacity-75',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            'p-2 rounded-lg flex-shrink-0',
            skill.enabled ? 'bg-primary/10' : 'bg-muted'
          )}>
            <Sparkles className={cn('w-5 h-5', skill.enabled ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground">{skill.name}</h3>
            {skill.version && (
              <p className="text-xs text-muted-foreground">v{skill.version}</p>
            )}
          </div>
        </div>
        {showActions && (
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
              <DropdownMenuItem onClick={() => onClick?.(skill)}>
                <Info className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConfigure}>
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggle}>
                {skill.enabled ? (
                  <>
                    <PowerOff className="w-4 h-4 mr-2" />
                    Disable
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4 mr-2" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
        {skill.description}
      </p>

      {/* Triggers */}
      {skill.triggers && skill.triggers.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <Tag className="w-3 h-3" />
            Triggers
          </div>
          <div className="flex flex-wrap gap-1">
            {skill.triggers.slice(0, 4).map((trigger) => (
              <Badge key={trigger} variant="outline" className="text-xs">
                {trigger}
              </Badge>
            ))}
            {skill.triggers.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{skill.triggers.length - 4}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <SourceBadge source={skill.source} />
          {skill.category && (
            <Badge variant="outline" className="text-xs">
              {skill.category}
            </Badge>
          )}
        </div>
        <Button
          variant={skill.enabled ? 'default' : 'outline'}
          size="sm"
          onClick={handleToggle}
          disabled={isToggling}
        >
          {skill.enabled ? (
            <>
              <Power className="w-4 h-4 mr-1" />
              Enabled
            </>
          ) : (
            <>
              <PowerOff className="w-4 h-4 mr-1" />
              Disabled
            </>
          )}
        </Button>
      </div>

      {/* Author */}
      {skill.author && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          {skill.author}
        </div>
      )}
    </Card>
  );
}

export default SkillCard;
