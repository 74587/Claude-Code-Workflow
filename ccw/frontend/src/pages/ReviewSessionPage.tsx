// ========================================
// ReviewSessionPage Component
// ========================================
// Review session detail page with findings display and multi-select

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useReviewSession } from '@/hooks/useReviewSession';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortField = 'severity' | 'dimension' | 'file';
type SortOrder = 'asc' | 'desc';

interface FindingWithSelection {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  dimension: string;
  category?: string;
  file?: string;
  line?: string;
  code_context?: string;
  recommendations?: string[];
  root_cause?: string;
  impact?: string;
}

/**
 * ReviewSessionPage component - Display review session findings
 */
export function ReviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const {
    reviewSession,
    flattenedFindings,
    severityCounts,
    isLoading,
    error,
    refetch,
  } = useReviewSession(sessionId);

  const [severityFilter, setSeverityFilter] = React.useState<Set<SeverityFilter>>(
    new Set(['critical', 'high', 'medium', 'low'])
  );
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortField, setSortField] = React.useState<SortField>('severity');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');
  const [selectedFindings, setSelectedFindings] = React.useState<Set<string>>(new Set());
  const [expandedFindings, setExpandedFindings] = React.useState<Set<string>>(new Set());

  const handleBack = () => {
    navigate('/sessions');
  };

  const toggleSeverity = (severity: SeverityFilter) => {
    setSeverityFilter(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const toggleSelectFinding = (findingId: string) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const validIds = filteredFindings.map(f => f.id).filter((id): id is string => id !== undefined);
    if (selectedFindings.size === validIds.length) {
      setSelectedFindings(new Set());
    } else {
      setSelectedFindings(new Set(validIds));
    }
  };

  const toggleExpandFinding = (findingId: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  const exportSelectedAsJson = () => {
    const selected = flattenedFindings.filter(f => f.id !== undefined && selectedFindings.has(f.id));
    if (selected.length === 0) return;

    const exportData = {
      session_id: sessionId,
      findings: selected.map(f => ({
        id: f.id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        dimension: f.dimension,
        file: f.file,
        line: f.line,
        recommendations: f.recommendations,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-${sessionId}-fix.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Severity order for sorting
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

  // Filter and sort findings
  const filteredFindings = React.useMemo(() => {
    let filtered = flattenedFindings;

    // Apply severity filter
    if (severityFilter.size > 0 && !severityFilter.has('all' as SeverityFilter)) {
      filtered = filtered.filter(f => severityFilter.has(f.severity));
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query) ||
        f.file?.toLowerCase().includes(query) ||
        f.dimension.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'severity':
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'dimension':
          comparison = a.dimension.localeCompare(b.dimension);
          break;
        case 'file':
          comparison = (a.file || '').localeCompare(b.file || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [flattenedFindings, severityFilter, searchQuery, sortField, sortOrder]);

  // Get severity badge props
  const getSeverityBadge = (severity: FindingWithSelection['severity']) => {
    switch (severity) {
      case 'critical':
        return { variant: 'destructive' as const, icon: XCircle, label: formatMessage({ id: 'reviewSession.severity.critical' }) };
      case 'high':
        return { variant: 'warning' as const, icon: AlertTriangle, label: formatMessage({ id: 'reviewSession.severity.high' }) };
      case 'medium':
        return { variant: 'info' as const, icon: Info, label: formatMessage({ id: 'reviewSession.severity.medium' }) };
      case 'low':
        return { variant: 'secondary' as const, icon: CheckCircle, label: formatMessage({ id: 'reviewSession.severity.low' }) };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.back' })}
          </Button>
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
          <p className="text-xs mt-0.5">{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {formatMessage({ id: 'common.actions.retry' })}
        </Button>
      </div>
    );
  }

  // Session not found
  if (!reviewSession) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'reviewSession.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'reviewSession.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.back' })}
        </Button>
      </div>
    );
  }

  const dimensions = reviewSession.reviewDimensions || [];
  const totalFindings = flattenedFindings.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.back' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {formatMessage({ id: 'reviewSession.title' })}
            </h1>
            <p className="text-sm text-muted-foreground">{reviewSession.session_id}</p>
          </div>
        </div>
        <Badge variant="info">
          {formatMessage({ id: 'reviewSession.type' })}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{totalFindings}</div>
            <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.stats.total' })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{severityCounts.critical}</div>
            <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.severity.critical' })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">{severityCounts.high}</div>
            <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.severity.high' })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{dimensions.length}</div>
            <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.stats.dimensions' })}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Severity Filters */}
          <div className="flex flex-wrap gap-2">
            {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
              const isEnabled = severityFilter.has(severity);
              const badge = getSeverityBadge(severity);
              return (
                <Badge
                  key={severity}
                  variant={isEnabled ? badge.variant : 'outline'}
                  className={`cursor-pointer ${isEnabled ? '' : 'opacity-50'}`}
                  onClick={() => toggleSeverity(severity)}
                >
                  <badge.icon className="h-3 w-3 mr-1" />
                  {badge.label}: {severityCounts[severity]}
                </Badge>
              );
            })}
          </div>

          {/* Search and Sort */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={formatMessage({ id: 'reviewSession.search.placeholder' })}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
              className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="severity">{formatMessage({ id: 'reviewSession.sort.severity' })}</option>
              <option value="dimension">{formatMessage({ id: 'reviewSession.sort.dimension' })}</option>
              <option value="file">{formatMessage({ id: 'reviewSession.sort.file' })}</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          {/* Selection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {formatMessage({ id: 'reviewSession.selection.count' }, { count: selectedFindings.size })}
              </span>
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedFindings.size === filteredFindings.length
                  ? formatMessage({ id: 'reviewSession.selection.clearAll' })
                  : formatMessage({ id: 'reviewSession.selection.selectAll' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFindings(new Set())}
              >
                {formatMessage({ id: 'reviewSession.selection.clear' })}
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={exportSelectedAsJson}
              disabled={selectedFindings.size === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {formatMessage({ id: 'reviewSession.export' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {formatMessage({ id: 'reviewSession.empty.title' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'reviewSession.empty.message' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFindings.filter(f => f.id !== undefined).map(finding => {
            const findingId = finding.id!;
            const isExpanded = expandedFindings.has(findingId);
            const isSelected = selectedFindings.has(findingId);
            const badge = getSeverityBadge(finding.severity);
            const BadgeIcon = badge.icon;

            return (
              <Card key={findingId} className={isSelected ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectFinding(findingId)}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div
                        className="flex items-start justify-between gap-3 cursor-pointer"
                        onClick={() => toggleExpandFinding(findingId)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={badge.variant} className="gap-1">
                              <BadgeIcon className="h-3 w-3" />
                              {badge.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {finding.dimension}
                            </Badge>
                            {finding.file && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {finding.file}:{finding.line || '?'}
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium text-foreground text-sm">{finding.title}</h4>
                          {finding.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {finding.description}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="flex-shrink-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          {/* Code Context */}
                          {finding.code_context && (
                            <div>
                              <h5 className="text-xs font-semibold text-foreground mb-1">
                                {formatMessage({ id: 'reviewSession.codeContext' })}
                              </h5>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                <code>{finding.code_context}</code>
                              </pre>
                            </div>
                          )}

                          {/* Root Cause */}
                          {finding.root_cause && (
                            <div>
                              <h5 className="text-xs font-semibold text-foreground mb-1">
                                {formatMessage({ id: 'reviewSession.rootCause' })}
                              </h5>
                              <p className="text-xs text-muted-foreground">{finding.root_cause}</p>
                            </div>
                          )}

                          {/* Impact */}
                          {finding.impact && (
                            <div>
                              <h5 className="text-xs font-semibold text-foreground mb-1">
                                {formatMessage({ id: 'reviewSession.impact' })}
                              </h5>
                              <p className="text-xs text-muted-foreground">{finding.impact}</p>
                            </div>
                          )}

                          {/* Recommendations */}
                          {finding.recommendations && finding.recommendations.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-foreground mb-1">
                                {formatMessage({ id: 'reviewSession.recommendations' })}
                              </h5>
                              <ul className="space-y-1">
                                {finding.recommendations.map((rec, idx) => (
                                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReviewSessionPage;
