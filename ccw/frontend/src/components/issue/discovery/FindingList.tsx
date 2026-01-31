// ========================================
// Finding List Component
// ========================================
// Displays findings with filters and severity badges

import { useIntl } from 'react-intl';
import { Search, FileCode, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import type { Finding } from '@/lib/api';
import type { FindingFilters } from '@/hooks/useIssues';

interface FindingListProps {
  findings: Finding[];
  filters: FindingFilters;
  onFilterChange: (filters: FindingFilters) => void;
}

const severityConfig = {
  critical: { variant: 'destructive' as const, label: 'issues.discovery.severity.critical' },
  high: { variant: 'destructive' as const, label: 'issues.discovery.severity.high' },
  medium: { variant: 'warning' as const, label: 'issues.discovery.severity.medium' },
  low: { variant: 'secondary' as const, label: 'issues.discovery.severity.low' },
};

export function FindingList({ findings, filters, onFilterChange }: FindingListProps) {
  const { formatMessage } = useIntl();

  // Extract unique types for filter
  const uniqueTypes = Array.from(new Set(findings.map(f => f.type))).sort();

  if (findings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.discovery.noFindings' })}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'issues.discovery.noFindingsDescription' })}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'issues.discovery.searchPlaceholder' })}
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.severity || 'all'}
          onValueChange={(v) => onFilterChange({ ...filters, severity: v === 'all' ? undefined : v as Finding['severity'] })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={formatMessage({ id: 'issues.discovery.filterBySeverity' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'issues.discovery.allSeverities' })}</SelectItem>
            <SelectItem value="critical">{formatMessage({ id: 'issues.discovery.severity.critical' })}</SelectItem>
            <SelectItem value="high">{formatMessage({ id: 'issues.discovery.severity.high' })}</SelectItem>
            <SelectItem value="medium">{formatMessage({ id: 'issues.discovery.severity.medium' })}</SelectItem>
            <SelectItem value="low">{formatMessage({ id: 'issues.discovery.severity.low' })}</SelectItem>
          </SelectContent>
        </Select>
        {uniqueTypes.length > 0 && (
          <Select
            value={filters.type || 'all'}
            onValueChange={(v) => onFilterChange({ ...filters, type: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'issues.discovery.filterByType' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.discovery.allTypes' })}</SelectItem>
              {uniqueTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {findings.map((finding) => {
          const config = severityConfig[finding.severity];
          return (
            <Card key={finding.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={config.variant}>
                    {formatMessage({ id: config.label })}
                  </Badge>
                  {finding.type && (
                    <Badge variant="outline" className="text-xs">
                      {finding.type}
                    </Badge>
                  )}
                </div>
                {finding.file && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileCode className="w-3 h-3" />
                    <span>{finding.file}</span>
                    {finding.line && <span>:{finding.line}</span>}
                  </div>
                )}
              </div>
              <h4 className="font-medium text-foreground mb-1">{finding.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
              {finding.code_snippet && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                  <code>{finding.code_snippet}</code>
                </pre>
              )}
            </Card>
          );
        })}
      </div>

      {/* Count */}
      <div className="text-center text-sm text-muted-foreground">
        {formatMessage({ id: 'issues.discovery.showingCount' }, { count: findings.length })}
      </div>
    </div>
  );
}
