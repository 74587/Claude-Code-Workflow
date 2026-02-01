// ========================================
// Issues Panel
// ========================================
// Issue list panel for IssueHub

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { IssueCard } from '@/components/shared/IssueCard';
import { IssueDrawer } from '@/components/issue/hub/IssueDrawer';
import { useIssues, useIssueMutations } from '@/hooks';
import type { Issue } from '@/lib/api';

type StatusFilter = 'all' | Issue['status'];
type PriorityFilter = 'all' | Issue['priority'];

interface IssuesPanelProps {
  onCreateIssue?: () => void;
}

interface IssueListProps {
  issues: Issue[];
  isLoading: boolean;
  onIssueClick: (issue: Issue) => void;
  onIssueEdit: (issue: Issue) => void;
  onIssueDelete: (issue: Issue) => void;
  onStatusChange: (issue: Issue, status: Issue['status']) => void;
}

function IssueList({ issues, isLoading, onIssueClick, onIssueEdit, onIssueDelete, onStatusChange }: IssueListProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'issues.emptyState.title' })}</h3>
        <p className="mt-2 text-muted-foreground">{formatMessage({ id: 'issues.emptyState.message' })}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onClick={onIssueClick}
          onEdit={onIssueEdit}
          onDelete={onIssueDelete}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

export function IssuesPanel({ onCreateIssue: _onCreateIssue }: IssuesPanelProps) {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const { issues, issuesByStatus, openCount, criticalCount, isLoading } = useIssues({
    filter: {
      search: searchQuery || undefined,
      status: statusFilter !== 'all' ? [statusFilter] : undefined,
      priority: priorityFilter !== 'all' ? [priorityFilter] : undefined,
    },
  });

  const { updateIssue, deleteIssue } = useIssueMutations();

  const statusCounts = useMemo(() => ({
    all: issues.length,
    open: issuesByStatus.open?.length || 0,
    in_progress: issuesByStatus.in_progress?.length || 0,
    resolved: issuesByStatus.resolved?.length || 0,
    closed: issuesByStatus.closed?.length || 0,
    completed: issuesByStatus.completed?.length || 0,
  }), [issues, issuesByStatus]);

  const handleEditIssue = (_issue: Issue) => {};

  const handleDeleteIssue = async (issue: Issue) => {
    if (confirm(`Delete issue "${issue.title}"?`)) {
      await deleteIssue(issue.id);
    }
  };

  const handleStatusChange = async (issue: Issue, status: Issue['status']) => {
    await updateIssue(issue.id, { status });
  };

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const handleCloseDrawer = () => {
    setSelectedIssue(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{openCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'common.status.openIssues' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{issuesByStatus.in_progress?.length || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.inProgress' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="text-2xl font-bold">{criticalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.priority.critical' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{issuesByStatus.resolved?.length || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.resolved' })}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'common.actions.searchIssues' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'common.status.label' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.filters.all' })}</SelectItem>
              <SelectItem value="open">{formatMessage({ id: 'issues.status.open' })}</SelectItem>
              <SelectItem value="in_progress">{formatMessage({ id: 'issues.status.inProgress' })}</SelectItem>
              <SelectItem value="resolved">{formatMessage({ id: 'issues.status.resolved' })}</SelectItem>
              <SelectItem value="closed">{formatMessage({ id: 'issues.status.closed' })}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'issues.priority.label' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.filters.byPriority' })}</SelectItem>
              <SelectItem value="critical">{formatMessage({ id: 'issues.priority.critical' })}</SelectItem>
              <SelectItem value="high">{formatMessage({ id: 'issues.priority.high' })}</SelectItem>
              <SelectItem value="medium">{formatMessage({ id: 'issues.priority.medium' })}</SelectItem>
              <SelectItem value="low">{formatMessage({ id: 'issues.priority.low' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
          {formatMessage({ id: 'issues.filters.all' })} ({statusCounts.all})
        </Button>
        <Button variant={statusFilter === 'open' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('open')}>
          <Badge variant="info" className="mr-2">{statusCounts.open}</Badge>
          {formatMessage({ id: 'issues.status.open' })}
        </Button>
        <Button variant={statusFilter === 'in_progress' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('in_progress')}>
          <Badge variant="warning" className="mr-2">{statusCounts.in_progress}</Badge>
          {formatMessage({ id: 'issues.status.inProgress' })}
        </Button>
        <Button variant={priorityFilter === 'critical' ? 'destructive' : 'outline'} size="sm" onClick={() => { setPriorityFilter(priorityFilter === 'critical' ? 'all' : 'critical'); setStatusFilter('all'); }}>
          <Badge variant="destructive" className="mr-2">{criticalCount}</Badge>
          {formatMessage({ id: 'issues.priority.critical' })}
        </Button>
      </div>

      <IssueList
        issues={issues}
        isLoading={isLoading}
        onIssueClick={handleIssueClick}
        onIssueEdit={handleEditIssue}
        onIssueDelete={handleDeleteIssue}
        onStatusChange={handleStatusChange}
      />

      {/* Issue Detail Drawer */}
      <IssueDrawer
        issue={selectedIssue}
        isOpen={selectedIssue !== null}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
