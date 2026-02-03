// ========================================
// CommandGroupAccordion Component
// ========================================
// Accordion component for displaying command groups with toggle switches

import * as React from 'react';
import { useIntl } from 'react-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/Collapsible';
import type { Command } from '@/lib/api';

export interface CommandGroupAccordionProps {
  /** Group name (e.g., 'cli', 'workflow', 'workflow/review') */
  groupName: string;
  /** Commands in this group */
  commands: Command[];
  /** Is this group expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggleExpand: (groupName: string) => void;
  /** Toggle individual command enabled state */
  onToggleCommand: (name: string, enabled: boolean) => void;
  /** Toggle all commands in group */
  onToggleGroup: (groupName: string, enable: boolean) => void;
  /** Is toggling in progress */
  isToggling: boolean;
  /** Show disabled commands */
  showDisabled?: boolean;
}

/**
 * Get icon for a command group
 * Uses top-level parent's icon for nested groups
 */
function getGroupIcon(groupName: string): string {
  const groupIcons: Record<string, string> = {
    cli: 'terminal',
    workflow: 'git-branch',
    memory: 'brain',
    task: 'clipboard-list',
    issue: 'alert-circle',
    loop: 'repeat',
    skill: 'sparkles',
    other: 'folder',
  };

  const topLevel = groupName.split('/')[0];
  return groupIcons[topLevel] || 'folder';
}

/**
 * Get color class for a command group
 * Uses top-level parent's color for nested groups
 */
function getGroupColorClass(groupName: string): string {
  const groupColors: Record<string, string> = {
    cli: 'text-primary bg-primary/10',
    workflow: 'text-success bg-success/10',
    memory: 'text-indigo bg-indigo/10',
    task: 'text-warning bg-warning/10',
    issue: 'text-destructive bg-destructive/10',
    loop: 'text-purple bg-purple/10',
    skill: 'text-pink bg-pink/10',
    other: 'text-muted-foreground bg-muted',
  };

  const topLevel = groupName.split('/')[0];
  return groupColors[topLevel] || 'text-muted-foreground bg-muted';
}

/**
 * Format group name for display
 * Converts nested paths like 'workflow/review' -> 'Workflow > Review'
 */
function formatGroupName(groupName: string): string {
  if (!groupName.includes('/')) {
    return groupName;
  }

  const parts = groupName.split('/');
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' > ');
}

/**
 * Get Lucide icon component by name
 */
function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    terminal: ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    'git-branch': ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
    brain: ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
      </svg>
    ),
    'clipboard-list': ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4" />
        <path d="M12 16h4" />
        <path d="M8 11h.01" />
        <path d="M8 16h.01" />
      </svg>
    ),
    'alert-circle': ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    repeat: ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
    sparkles: ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
      </svg>
    ),
    folder: ({ className }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      </svg>
    ),
  };

  return iconMap[iconName] || iconMap.folder;
}

/**
 * CommandGroupAccordion component
 * Displays a collapsible group of commands with toggle switches
 */
export function CommandGroupAccordion({
  groupName,
  commands,
  isExpanded,
  onToggleExpand,
  onToggleCommand,
  onToggleGroup,
  isToggling,
  showDisabled = false,
}: CommandGroupAccordionProps) {
  const { formatMessage } = useIntl();

  const enabledCommands = commands.filter((cmd) => cmd.enabled);
  const allEnabled = enabledCommands.length === commands.length && commands.length > 0;

  // Filter commands based on showDisabled setting
  const visibleCommands = showDisabled ? commands : enabledCommands;

  const iconName = getGroupIcon(groupName);
  const colorClass = getGroupColorClass(groupName);
  const displayName = formatGroupName(groupName);
  const IconComponent = getIconComponent(iconName);
  const indentLevel = (groupName.match(/\//g) || []).length;

  const handleToggleGroup = (checked: boolean) => {
    onToggleGroup(groupName, checked);
  };

  return (
    <div className={cn('mb-4', indentLevel > 0 && 'ml-5')} style={indentLevel > 0 ? { marginLeft: `${indentLevel * 20}px` } : undefined}>
      <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(groupName)}>
        {/* Group Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-3 flex-1 cursor-pointer">
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground transition-transform" />
              )}
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colorClass)}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{displayName}</h3>
                <p className="text-xs text-muted-foreground">
                  {enabledCommands.length}/{commands.length} {formatMessage({ id: 'commands.group.enabled' })}
                </p>
              </div>
            </div>
          </CollapsibleTrigger>

          <div className="flex items-center gap-3">
            {/* Group Toggle Switch */}
            <Switch
              checked={allEnabled}
              onCheckedChange={handleToggleGroup}
              disabled={isToggling || commands.length === 0}
              className={cn('data-[state=checked]:bg-success')}
              title={
                allEnabled
                  ? formatMessage({ id: 'commands.group.clickToDisableAll' })
                  : formatMessage({ id: 'commands.group.clickToEnableAll' })
              }
            />
            <Badge variant="secondary" className="text-xs">
              {commands.length}
            </Badge>
          </div>
        </div>

        {/* Group Content - Commands Table */}
        <CollapsibleContent className="mt-3">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '200px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    {formatMessage({ id: 'commands.table.name' })}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    {formatMessage({ id: 'commands.table.description' })}
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                    {formatMessage({ id: 'commands.table.scope' })}
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                    {formatMessage({ id: 'commands.table.status' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleCommands.map((command) => (
                  <CommandRow
                    key={`${command.name}-${command.location || 'default'}`}
                    command={command}
                    onToggle={onToggleCommand}
                    disabled={isToggling}
                  />
                ))}
                {visibleCommands.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {showDisabled
                        ? formatMessage({ id: 'commands.group.noCommands' })
                        : formatMessage({ id: 'commands.group.noEnabledCommands' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * CommandRow component - Internal component for table row
 */
interface CommandRowProps {
  command: Command;
  onToggle: (name: string, enabled: boolean) => void;
  disabled?: boolean;
}

function CommandRow({ command, onToggle, disabled }: CommandRowProps) {
  const { formatMessage } = useIntl();
  const isDisabled = !command.enabled;

  return (
    <tr className={cn('hover:bg-muted/20 transition-colors', isDisabled && 'opacity-60')}>
      <td className="px-4 py-3 text-sm font-medium text-foreground">
        <code className="break-words">/{command.name}</code>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <div className="line-clamp-2 break-words">
          {command.description || formatMessage({ id: 'commands.card.noDescription' })}
        </div>
      </td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
        <span className="whitespace-nowrap">{command.location || 'project'}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <Switch
            checked={command.enabled}
            onCheckedChange={(checked) => onToggle(command.name, checked)}
            disabled={disabled}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </td>
    </tr>
  );
}

export default CommandGroupAccordion;
