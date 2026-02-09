// ========================================
// TeamMembersPanel Component
// ========================================
// Card-based member status display

import { useIntl } from 'react-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { TeamMember } from '@/types/team';

interface TeamMembersPanelProps {
  members: TeamMember[];
}

function formatRelativeTime(isoString: string): string {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getMemberStatus(member: TeamMember): 'active' | 'idle' {
  if (!member.lastSeen) return 'idle';
  const diffMs = Date.now() - new Date(member.lastSeen).getTime();
  // Active if seen in last 2 minutes
  return diffMs < 2 * 60 * 1000 ? 'active' : 'idle';
}

export function TeamMembersPanel({ members }: TeamMembersPanelProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {formatMessage({ id: 'team.membersPanel.title' })}
      </h3>
      <div className="space-y-2">
        {members.map((m) => {
          const status = getMemberStatus(m);
          const isActive = status === 'active';

          return (
            <Card key={m.member} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div className="pt-0.5">
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        isActive
                          ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                          : 'bg-muted-foreground/40'
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Name + status badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.member}</span>
                      <Badge
                        variant={isActive ? 'success' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {formatMessage({ id: `team.membersPanel.${status}` })}
                      </Badge>
                    </div>

                    {/* Last action */}
                    {m.lastAction && (
                      <p className="text-xs text-muted-foreground truncate">
                        {m.lastAction}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>
                        {m.messageCount} {formatMessage({ id: 'team.messages' }).toLowerCase()}
                      </span>
                      {m.lastSeen && (
                        <span>
                          {formatRelativeTime(m.lastSeen)} {formatMessage({ id: 'team.membersPanel.ago' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {members.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {formatMessage({ id: 'team.empty.noMessages' })}
          </p>
        )}
      </div>
    </div>
  );
}
