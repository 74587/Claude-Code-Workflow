// ========================================
// LiteTasksPage Component
// ========================================
// Lite-plan and lite-fix task list page with flowchart rendering

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Zap,
  Wrench,
  FileEdit,
  MessagesSquare,
  Calendar,
  ListChecks,
  XCircle,
  Activity,
  Repeat,
  MessageCircle,
} from 'lucide-react';
import { useLiteTasks } from '@/hooks/useLiteTasks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

type LiteTaskTab = 'lite-plan' | 'lite-fix' | 'multi-cli-plan';

/**
 * Get i18n text from label object (supports {en, zh} format)
 */
function getI18nText(label: string | { en?: string; zh?: string } | undefined, fallback: string): string {
  if (!label) return fallback;
  if (typeof label === 'string') return label;
  return label.en || label.zh || fallback;
}

/**
 * LiteTasksPage component - Display lite-plan and lite-fix sessions
 */
export function LiteTasksPage() {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { litePlan, liteFix, multiCliPlan, isLoading, error, refetch } = useLiteTasks();
  const [activeTab, setActiveTab] = React.useState<LiteTaskTab>('lite-plan');

  const handleBack = () => {
    navigate('/sessions');
  };

  // Get status badge color
  const getStatusColor = (status?: string) => {
    const statusColors: Record<string, string> = {
      decided: 'success',
      converged: 'success',
      plan_generated: 'success',
      completed: 'success',
      exploring: 'info',
      initialized: 'info',
      analyzing: 'warning',
      debating: 'warning',
      blocked: 'destructive',
      conflict: 'destructive',
    };
    return statusColors[status || ''] || 'secondary';
  };

  // Render lite task card
  const renderLiteTaskCard = (session: { id: string; type: string; createdAt?: string; tasks?: unknown[] }) => {
    const isLitePlan = session.type === 'lite-plan';
    const taskCount = session.tasks?.length || 0;

    return (
      <Card
        key={session.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/lite-tasks/${session.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground text-sm">{session.id}</h3>
            </div>
            <Badge variant={isLitePlan ? 'info' : 'warning'} className="gap-1">
              {isLitePlan ? <FileEdit className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
              {formatMessage({ id: isLitePlan ? 'liteTasks.type.plan' : 'liteTasks.type.fix' })}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {session.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {taskCount} {formatMessage({ id: 'session.tasks' })}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render multi-cli plan card
  const renderMultiCliCard = (session: {
    id: string;
    metadata?: Record<string, unknown>;
    latestSynthesis?: { title?: string | { en?: string; zh?: string }; status?: string };
    roundCount?: number;
    status?: string;
    createdAt?: string;
  }) => {
    const metadata = session.metadata || {};
    const latestSynthesis = session.latestSynthesis || {};
    const roundCount = (metadata.roundId as number) || session.roundCount || 1;
    const topicTitle = getI18nText(
      latestSynthesis.title as string | { en?: string; zh?: string } | undefined,
      'Discussion Topic'
    );
    const status = latestSynthesis.status || session.status || 'analyzing';
    const createdAt = (metadata.timestamp as string) || session.createdAt || '';

    return (
      <Card
        key={session.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/lite-tasks/${session.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground text-sm">{session.id}</h3>
            </div>
            <Badge variant="info" className="gap-1">
              <MessagesSquare className="h-3 w-3" />
              {formatMessage({ id: 'liteTasks.type.multiCli' })}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MessageCircle className="h-4 w-4" />
            <span className="line-clamp-1">{topicTitle}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(createdAt).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" />
              {roundCount} {formatMessage({ id: 'liteTasks.rounds' })}
            </span>
            <Badge variant={getStatusColor(status) as 'success' | 'info' | 'warning' | 'destructive' | 'secondary'} className="gap-1">
              <Activity className="h-3 w-3" />
              {status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
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

  const totalSessions = litePlan.length + liteFix.length + multiCliPlan.length;

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
              {formatMessage({ id: 'liteTasks.title' })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'liteTasks.subtitle' }, { count: totalSessions })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LiteTaskTab)}>
        <TabsList>
          <TabsTrigger value="lite-plan">
            <FileEdit className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'liteTasks.type.plan' })}
            <Badge variant="secondary" className="ml-2">
              {litePlan.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="lite-fix">
            <Wrench className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'liteTasks.type.fix' })}
            <Badge variant="secondary" className="ml-2">
              {liteFix.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="multi-cli-plan">
            <MessagesSquare className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'liteTasks.type.multiCli' })}
            <Badge variant="secondary" className="ml-2">
              {multiCliPlan.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Lite Plan Tab */}
        <TabsContent value="lite-plan" className="mt-4">
          {litePlan.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'liteTasks.empty.title' }, { type: 'lite-plan' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'liteTasks.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">{litePlan.map(renderLiteTaskCard)}</div>
          )}
        </TabsContent>

        {/* Lite Fix Tab */}
        <TabsContent value="lite-fix" className="mt-4">
          {liteFix.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'liteTasks.empty.title' }, { type: 'lite-fix' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'liteTasks.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">{liteFix.map(renderLiteTaskCard)}</div>
          )}
        </TabsContent>

        {/* Multi-CLI Plan Tab */}
        <TabsContent value="multi-cli-plan" className="mt-4">
          {multiCliPlan.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {formatMessage({ id: 'liteTasks.empty.title' }, { type: 'multi-cli-plan' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'liteTasks.empty.message' })}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">{multiCliPlan.map(renderMultiCliCard)}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LiteTasksPage;
