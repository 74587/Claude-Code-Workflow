// ========================================
// ConflictDetectionCard Component
// ========================================
// Displays conflict detection results with risk levels

import { useIntl } from 'react-intl';
import { AlertTriangle, Shield, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FieldRenderer } from './FieldRenderer';

export interface RiskFactors {
  test_gaps?: string[];
  existing_implementations?: string[];
}

export interface ConflictDetectionData {
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  mitigation_strategy?: string;
  risk_factors?: RiskFactors;
  affected_modules?: string[];
}

export interface ConflictDetectionCardProps {
  data?: ConflictDetectionData;
}

/**
 * ConflictDetectionCard component - Displays conflict detection results
 */
export function ConflictDetectionCard({ data }: ConflictDetectionCardProps) {
  const { formatMessage } = useIntl();

  if (!data || !data.risk_level) {
    return null;
  }

  const riskConfig = getRiskConfig(data.risk_level);

  return (
    <Card className={riskConfig.borderClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${riskConfig.iconColor}`} />
          {formatMessage({ id: 'sessionDetail.context.conflictDetection.title' })}
          <Badge variant={riskConfig.badgeVariant} className={riskConfig.badgeClass}>
            {formatMessage({ id: `sessionDetail.context.conflictDetection.riskLevel.${data.risk_level}` })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mitigation Strategy */}
        {data.mitigation_strategy && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  {formatMessage({ id: 'sessionDetail.context.conflictDetection.mitigation' })}
                </h4>
                <p className="text-sm text-muted-foreground">{data.mitigation_strategy}</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {data.risk_factors && (
          <RiskFactorsSection factors={data.risk_factors} />
        )}

        {/* Affected Modules */}
        {data.affected_modules && data.affected_modules.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {formatMessage({ id: 'sessionDetail.context.conflictDetection.affectedModules' })}
            </h4>
            <FieldRenderer value={data.affected_modules} type="tags" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RiskFactorsSectionProps {
  factors: RiskFactors;
}

function RiskFactorsSection({ factors }: RiskFactorsSectionProps) {
  const { formatMessage } = useIntl();

  const hasTestGaps = factors.test_gaps && factors.test_gaps.length > 0;
  const hasExistingImpl = factors.existing_implementations && factors.existing_implementations.length > 0;

  if (!hasTestGaps && !hasExistingImpl) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {formatMessage({ id: 'sessionDetail.context.conflictDetection.riskFactors' })}
      </h4>
      <div className="space-y-2">
        {hasTestGaps && (
          <div className="p-2 border-l-2 border-warning bg-warning/5 rounded-r">
            <p className="text-xs font-medium text-foreground mb-1">
              {formatMessage({ id: 'sessionDetail.context.conflictDetection.testGaps' })}
            </p>
            <FieldRenderer value={factors.test_gaps!} type="array" />
          </div>
        )}
        {hasExistingImpl && (
          <div className="p-2 border-l-2 border-info bg-info/5 rounded-r">
            <p className="text-xs font-medium text-foreground mb-1">
              {formatMessage({ id: 'sessionDetail.context.conflictDetection.existingImplementations' })}
            </p>
            <FieldRenderer value={factors.existing_implementations!} type="array" />
          </div>
        )}
      </div>
    </div>
  );
}

function getRiskConfig(level: string) {
  switch (level) {
    case 'critical':
      return {
        borderClass: 'border-destructive',
        iconColor: 'text-destructive',
        badgeVariant: 'destructive' as const,
        badgeClass: 'bg-destructive text-destructive-foreground',
      };
    case 'high':
      return {
        borderClass: 'border-warning',
        iconColor: 'text-warning',
        badgeVariant: 'warning' as const,
        badgeClass: '',
      };
    case 'medium':
      return {
        borderClass: 'border-info',
        iconColor: 'text-info',
        badgeVariant: 'info' as const,
        badgeClass: '',
      };
    default:
      return {
        borderClass: '',
        iconColor: 'text-success',
        badgeVariant: 'success' as const,
        badgeClass: '',
      };
  }
}
