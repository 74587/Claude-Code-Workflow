// ========================================
// ReviewTab Component
// ========================================
// Review tab for session detail page - displays review findings by dimension

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/Collapsible';

// Type definitions for review data
export interface ReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  location?: string;
  code?: string;
}

export interface ReviewDimension {
  name: string;
  findings?: ReviewFinding[];
  summary?: string;
}

export interface ReviewTabProps {
  review?: {
    dimensions?: ReviewDimension[];
  };
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

/**
 * Get severity color variant for badges
 */
function getSeverityVariant(severity: string): 'destructive' | 'warning' | 'default' | 'secondary' {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'warning';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Get border color class for severity
 */
function getSeverityBorderClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'border-destructive';
    case 'high':
      return 'border-orange-500';
    case 'medium':
      return 'border-yellow-500';
    case 'low':
      return 'border-blue-500';
    default:
      return 'border-border';
  }
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
    case 'high':
      return <AlertCircle className="h-4 w-4" />;
    case 'medium':
      return <AlertTriangle className="h-4 w-4" />;
    case 'low':
      return <Info className="h-4 w-4" />;
    default:
      return null;
  }
}

/**
 * ReviewTab component - Display review findings by dimension
 */
export function ReviewTab({ review }: ReviewTabProps) {
  const { formatMessage } = useIntl();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  if (!review || !review.dimensions || review.dimensions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.review.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.review.empty.message' })}
        </p>
      </div>
    );
  }

  // Filter findings by severity
  const filteredDimensions = review.dimensions.map((dimension) => ({
    ...dimension,
    findings: dimension.findings?.filter((finding) =>
      severityFilter === 'all' || finding.severity === severityFilter
    ),
  })).filter((dimension) => dimension.findings && dimension.findings.length > 0);

  const hasFindings = filteredDimensions.some((d) => d.findings && d.findings.length > 0);

  if (!hasFindings) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.review.noFindings.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.review.noFindings.message' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Severity Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'sessionDetail.review.filterBySeverity' })}
        </span>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'sessionDetail.review.severity.all' })}</SelectItem>
            <SelectItem value="critical">{formatMessage({ id: 'sessionDetail.review.severity.critical' })}</SelectItem>
            <SelectItem value="high">{formatMessage({ id: 'sessionDetail.review.severity.high' })}</SelectItem>
            <SelectItem value="medium">{formatMessage({ id: 'sessionDetail.review.severity.medium' })}</SelectItem>
            <SelectItem value="low">{formatMessage({ id: 'sessionDetail.review.severity.low' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dimensions with Findings */}
      {filteredDimensions.map((dimension) => {
        if (!dimension.findings || dimension.findings.length === 0) return null;

        return (
          <Card key={dimension.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">{dimension.name}</h3>
                <Badge variant="secondary">{dimension.findings.length}</Badge>
              </div>

              {dimension.summary && (
                <p className="text-sm text-muted-foreground mb-4">{dimension.summary}</p>
              )}

              <div className="space-y-3">
                {dimension.findings.map((finding, findingIndex) => (
                  <Collapsible key={`${dimension.name}-${findingIndex}`} className={`border-l-4 ${getSeverityBorderClass(finding.severity)} rounded-r-lg`}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-3 hover:bg-accent/50 transition-colors">
                      <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(finding.severity)}
                          <span className="font-medium text-sm">{finding.title}</span>
                          <Badge variant={getSeverityVariant(finding.severity)} className="text-xs">
                            {formatMessage({ id: `sessionDetail.review.severity.${finding.severity}` })}
                          </Badge>
                        </div>
                        {finding.location && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{finding.location}</p>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-6 pb-3 space-y-2">
                      {finding.description && (
                        <div className="text-sm text-foreground">
                          {finding.description}
                        </div>
                      )}
                      {finding.code && (
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          <code>{finding.code}</code>
                        </pre>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
