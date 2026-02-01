// ========================================
// ConflictTab Component
// ========================================
// Conflict tab for session detail page - displays conflict resolution decisions

import { useIntl } from 'react-intl';
import {
  Scale,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/Collapsible';

// Type definitions for conflict resolution data
export interface UserDecision {
  choice: string;
  description?: string;
  implications?: string;
}

export interface ResolvedConflict {
  id: string;
  category?: string;
  brief?: string;
  strategy?: string;
}

export interface ConflictResolutionData {
  session_id: string;
  resolved_at?: string;
  user_decisions?: Record<string, UserDecision>;
  resolved_conflicts?: ResolvedConflict[];
}

export interface ConflictTabProps {
  conflicts?: ConflictResolutionData;
}

/**
 * ConflictTab component - Display conflict resolution decisions
 */
export function ConflictTab({ conflicts }: ConflictTabProps) {
  const { formatMessage } = useIntl();

  if (!conflicts) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Scale className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.conflict.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.conflict.empty.message' })}
        </p>
      </div>
    );
  }

  const hasUserDecisions = conflicts.user_decisions && Object.keys(conflicts.user_decisions).length > 0;
  const hasResolvedConflicts = conflicts.resolved_conflicts && conflicts.resolved_conflicts.length > 0;

  if (!hasUserDecisions && !hasResolvedConflicts) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Scale className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.conflict.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.conflict.empty.message' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resolved At */}
      {conflicts.resolved_at && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span>
            {formatMessage({ id: 'sessionDetail.conflict.resolvedAt' })}:{' '}
            {new Date(conflicts.resolved_at).toLocaleString()}
          </span>
        </div>
      )}

      {/* User Decisions Section */}
      {hasUserDecisions && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {formatMessage({ id: 'sessionDetail.conflict.userDecisions' })}
            </h3>
            <div className="space-y-3">
              {Object.entries(conflicts.user_decisions!).map(([key, decision], index) => (
                <Collapsible key={key} defaultOpen={index < 3}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-colors">
                    <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                    <span className="font-medium text-sm flex-1">{key}</span>
                    <Badge variant="success" className="text-xs">
                      {decision.choice}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 pr-3 pb-3 space-y-2">
                    {decision.description && (
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{formatMessage({ id: 'sessionDetail.conflict.description' })}:</span>{' '}
                        {decision.description}
                      </div>
                    )}
                    {decision.implications && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">{formatMessage({ id: 'sessionDetail.conflict.implications' })}:</span>{' '}
                        {decision.implications}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolved Conflicts Section */}
      {hasResolvedConflicts && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {formatMessage({ id: 'sessionDetail.conflict.resolvedConflicts' })}
            </h3>
            <div className="space-y-3">
              {conflicts.resolved_conflicts!.map((conflict) => (
                <Collapsible key={conflict.id}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-colors">
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:rotate-[-90deg]" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{conflict.id}</span>
                        {conflict.category && (
                          <Badge variant="outline" className="text-xs">
                            {conflict.category}
                          </Badge>
                        )}
                      </div>
                      {conflict.brief && (
                        <p className="text-xs text-muted-foreground mt-1">{conflict.brief}</p>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 pr-3 pb-3">
                    {conflict.strategy && (
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{formatMessage({ id: 'sessionDetail.conflict.strategy' })}:</span>{' '}
                        {conflict.strategy}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
