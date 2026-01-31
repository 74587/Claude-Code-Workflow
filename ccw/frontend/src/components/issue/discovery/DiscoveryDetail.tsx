// ========================================
// Discovery Detail Component
// ========================================
// Displays findings detail panel with tabs and export functionality

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Download, FileText, BarChart3, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import type { DiscoverySession, Finding } from '@/lib/api';
import type { FindingFilters } from '@/hooks/useIssues';
import { FindingList } from './FindingList';

interface DiscoveryDetailProps {
  sessionId: string;
  session: DiscoverySession | null;
  findings: Finding[];
  filters: FindingFilters;
  onFilterChange: (filters: FindingFilters) => void;
  onExport: () => void;
}

export function DiscoveryDetail({
  sessionId: _sessionId,
  session,
  findings,
  filters,
  onFilterChange,
  onExport,
}: DiscoveryDetailProps) {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState('findings');

  if (!session) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.discovery.noSessionSelected' })}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'issues.discovery.selectSession' })}
        </p>
      </Card>
    );
  }

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  const typeCounts = findings.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{session.name}</h2>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'issues.discovery.sessionId' })}: {session.id}
          </p>
        </div>
        <Button variant="outline" onClick={onExport} disabled={findings.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'issues.discovery.export' })}
        </Button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <Badge
          variant={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'destructive' : 'warning'}
        >
          {formatMessage({ id: `issues.discovery.status.${session.status}` })}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatMessage({ id: 'issues.discovery.createdAt' })}: {formatDate(session.created_at)}
        </span>
        {session.completed_at && (
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'issues.discovery.completedAt' })}: {formatDate(session.completed_at)}
          </span>
        )}
      </div>

      {/* Progress Bar for Running Sessions */}
      {session.status === 'running' && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{formatMessage({ id: 'issues.discovery.progress' })}</span>
            <span className="font-medium">{session.progress}%</span>
          </div>
          <Progress value={session.progress} className="h-2" />
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="findings">
            <FileText className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.tabFindings' })} ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="progress">
            <BarChart3 className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.tabProgress' })}
          </TabsTrigger>
          <TabsTrigger value="info">
            <Info className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.tabInfo' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="mt-4">
          <FindingList findings={findings} filters={filters} onFilterChange={onFilterChange} />
        </TabsContent>

        <TabsContent value="progress" className="mt-4 space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">
              {formatMessage({ id: 'issues.discovery.severityBreakdown' })}
            </h3>
            <div className="space-y-3">
              {Object.entries(severityCounts).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <Badge
                    variant={severity === 'critical' || severity === 'high' ? 'destructive' : severity === 'medium' ? 'warning' : 'secondary'}
                  >
                    {formatMessage({ id: `issues.discovery.severity.${severity}` })}
                  </Badge>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          {Object.keys(typeCounts).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">
                {formatMessage({ id: 'issues.discovery.typeBreakdown' })}
              </h3>
              <div className="space-y-3">
                {Object.entries(typeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <Badge variant="outline">{type}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.sessionId' })}
              </h3>
              <p className="text-foreground font-mono text-sm">{session.id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.name' })}
              </h3>
              <p className="text-foreground">{session.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.status' })}
              </h3>
              <Badge
                variant={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'destructive' : 'warning'}
              >
                {formatMessage({ id: `issues.discovery.status.${session.status}` })}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.progress' })}
              </h3>
              <p className="text-foreground">{session.progress}%</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.findingsCount' })}
              </h3>
              <p className="text-foreground">{session.findings_count}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.createdAt' })}
              </h3>
              <p className="text-foreground">{formatDate(session.created_at)}</p>
            </div>
            {session.completed_at && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {formatMessage({ id: 'issues.discovery.completedAt' })}
                </h3>
                <p className="text-foreground">{formatDate(session.completed_at)}</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
