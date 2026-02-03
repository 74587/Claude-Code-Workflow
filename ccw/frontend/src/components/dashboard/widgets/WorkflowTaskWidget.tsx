// ========================================
// WorkflowTaskWidget Component
// ========================================
// Combined dashboard widget: project info + stats + workflow status + orchestrator + task carousel

import { memo, useMemo, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/charts/Sparkline';
import { useWorkflowStatusCounts, generateMockWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useCoordinatorStore } from '@/stores/coordinatorStore';
import { useProjectOverview } from '@/hooks/useProjectOverview';
import { cn } from '@/lib/utils';
import {
  ListChecks,
  Clock,
  FolderKanban,
  CheckCircle2,
  XCircle,
  Activity,
  Play,
  Pause,
  Square,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  Code2,
  Server,
  Layers,
  GitBranch,
  Wrench,
  FileCode,
  Bug,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export interface WorkflowTaskWidgetProps {
  className?: string;
}

// ---- Workflow Status section ----
const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  completed: { bg: 'bg-success', text: 'text-success', dot: 'bg-emerald-500' },
  in_progress: { bg: 'bg-warning', text: 'text-warning', dot: 'bg-amber-500' },
  planning: { bg: 'bg-violet-500', text: 'text-violet-600', dot: 'bg-violet-500' },
  paused: { bg: 'bg-slate-400', text: 'text-slate-500', dot: 'bg-slate-400' },
  archived: { bg: 'bg-slate-300', text: 'text-slate-400', dot: 'bg-slate-300' },
};

const statusLabelKeys: Record<string, string> = {
  completed: 'sessions.status.completed',
  in_progress: 'sessions.status.inProgress',
  planning: 'sessions.status.planning',
  paused: 'sessions.status.paused',
  archived: 'sessions.status.archived',
};

// ---- Task List section ----
interface TaskItem {
  id: string;
  name: string;
  status: 'pending' | 'completed';
}

// Session with its tasks
interface SessionWithTasks {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'paused';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  tasks: TaskItem[];
}

// Mock sessions with their tasks
const MOCK_SESSIONS: SessionWithTasks[] = [
  {
    id: 'WFS-auth-001',
    name: 'User Authentication System',
    description: 'Implement OAuth2 and JWT based authentication with role-based access control',
    status: 'in_progress',
    tags: ['auth', 'security', 'backend'],
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20',
    tasks: [
      { id: '1', name: 'Implement user authentication', status: 'pending' },
      { id: '2', name: 'Design database schema', status: 'completed' },
      { id: '3', name: 'Setup CI/CD pipeline', status: 'pending' },
    ],
  },
  {
    id: 'WFS-api-002',
    name: 'API Documentation',
    description: 'Create comprehensive API documentation with OpenAPI 3.0 specification',
    status: 'planning',
    tags: ['docs', 'api'],
    createdAt: '2024-01-18',
    updatedAt: '2024-01-19',
    tasks: [
      { id: '4', name: 'Write API documentation', status: 'pending' },
      { id: '5', name: 'Create OpenAPI spec', status: 'pending' },
    ],
  },
  {
    id: 'WFS-perf-003',
    name: 'Performance Optimization',
    description: 'Optimize database queries and implement caching strategies',
    status: 'completed',
    tags: ['performance', 'optimization', 'database'],
    createdAt: '2024-01-10',
    updatedAt: '2024-01-17',
    tasks: [
      { id: '6', name: 'Performance optimization', status: 'completed' },
      { id: '7', name: 'Security audit', status: 'completed' },
    ],
  },
  {
    id: 'WFS-test-004',
    name: 'Integration Testing',
    description: 'Setup E2E testing framework and write integration tests',
    status: 'in_progress',
    tags: ['testing', 'e2e', 'ci'],
    createdAt: '2024-01-19',
    updatedAt: '2024-01-20',
    tasks: [
      { id: '8', name: 'Integration testing', status: 'completed' },
      { id: '9', name: 'Deploy to staging', status: 'pending' },
      { id: '10', name: 'E2E test setup', status: 'pending' },
    ],
  },
];

const taskStatusColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  pending: { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock },
  completed: { bg: 'bg-success/20', text: 'text-success', icon: CheckCircle2 },
};

const sessionStatusColors: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'bg-violet-500/20', text: 'text-violet-600' },
  in_progress: { bg: 'bg-warning/20', text: 'text-warning' },
  completed: { bg: 'bg-success/20', text: 'text-success' },
  paused: { bg: 'bg-slate-400/20', text: 'text-slate-500' },
};

// ---- Mini Stat Card with Sparkline ----
interface MiniStatCardProps {
  icon: React.ElementType;
  title: string;
  value: number;
  variant: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'default';
  sparklineData?: number[];
}

const variantStyles: Record<string, { card: string; icon: string }> = {
  primary: { card: 'border-primary/30 bg-primary/5', icon: 'bg-primary/10 text-primary' },
  info: { card: 'border-info/30 bg-info/5', icon: 'bg-info/10 text-info' },
  success: { card: 'border-success/30 bg-success/5', icon: 'bg-success/10 text-success' },
  warning: { card: 'border-warning/30 bg-warning/5', icon: 'bg-warning/10 text-warning' },
  danger: { card: 'border-destructive/30 bg-destructive/5', icon: 'bg-destructive/10 text-destructive' },
  default: { card: 'border-border', icon: 'bg-muted text-muted-foreground' },
};

function MiniStatCard({ icon: Icon, title, value, variant, sparklineData }: MiniStatCardProps) {
  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div className={cn('rounded-lg border p-2 transition-all hover:shadow-sm', styles.card)}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-lg font-semibold text-card-foreground mt-0.5">{value.toLocaleString()}</p>
        </div>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md shrink-0', styles.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-1 -mx-1">
          <Sparkline data={sparklineData} height={24} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

// Generate sparkline data
function generateSparklineData(currentValue: number, variance = 0.3): number[] {
  const days = 7;
  const data: number[] = [];
  let value = Math.max(0, currentValue * (1 - variance));

  for (let i = 0; i < days - 1; i++) {
    data.push(Math.round(value));
    const change = (Math.random() - 0.5) * 2 * variance * currentValue;
    value = Math.max(0, value + change);
  }
  data.push(currentValue);
  return data;
}

// Orchestrator status icons and colors
const orchestratorStatusConfig: Record<string, { icon: typeof Play; color: string; bg: string }> = {
  idle: { icon: Square, color: 'text-muted-foreground', bg: 'bg-muted' },
  initializing: { icon: Loader2, color: 'text-info', bg: 'bg-info/20' },
  running: { icon: Play, color: 'text-success', bg: 'bg-success/20' },
  paused: { icon: Pause, color: 'text-warning', bg: 'bg-warning/20' },
  completed: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/20' },
  failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/20' },
  cancelled: { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
};

function WorkflowTaskWidgetComponent({ className }: WorkflowTaskWidgetProps) {
  const { formatMessage } = useIntl();
  const { data, isLoading } = useWorkflowStatusCounts();
  const { stats, isLoading: statsLoading } = useDashboardStats({ refetchInterval: 60000 });
  const { projectOverview, isLoading: projectLoading } = useProjectOverview();

  // Get coordinator state
  const coordinatorState = useCoordinatorStore();
  const orchestratorConfig = orchestratorStatusConfig[coordinatorState.status] || orchestratorStatusConfig.idle;
  const OrchestratorIcon = orchestratorConfig.icon;

  const chartData = data || generateMockWorkflowStatusCounts();
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  // Generate sparkline data for each stat
  const sparklines = useMemo(() => ({
    activeSessions: generateSparklineData(stats?.activeSessions ?? 0, 0.4),
    totalTasks: generateSparklineData(stats?.totalTasks ?? 0, 0.3),
    completedTasks: generateSparklineData(stats?.completedTasks ?? 0, 0.25),
    pendingTasks: generateSparklineData(stats?.pendingTasks ?? 0, 0.35),
    failedTasks: generateSparklineData(stats?.failedTasks ?? 0, 0.5),
    todayActivity: generateSparklineData(stats?.todayActivity ?? 0, 0.6),
  }), [stats]);

  // Calculate orchestrator progress
  const orchestratorProgress = coordinatorState.commandChain.length > 0
    ? Math.round((coordinatorState.commandChain.filter(n => n.status === 'completed').length / coordinatorState.commandChain.length) * 100)
    : 0;

  // Project info expanded state
  const [projectExpanded, setProjectExpanded] = useState(false);

  // Session carousel state
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const currentSession = MOCK_SESSIONS[currentSessionIndex];

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSessionIndex((prev) => (prev + 1) % MOCK_SESSIONS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Manual navigation
  const handlePrevSession = () => {
    setCurrentSessionIndex((prev) => (prev === 0 ? MOCK_SESSIONS.length - 1 : prev - 1));
  };
  const handleNextSession = () => {
    setCurrentSessionIndex((prev) => (prev + 1) % MOCK_SESSIONS.length);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Project Info Banner - Separate Card */}
      <Card className="shrink-0">
        {projectLoading ? (
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <>
            {/* Collapsed Header */}
            <div className="px-4 py-3 flex items-center gap-6 flex-wrap">
              {/* Project Name & Icon */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Code2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground truncate">
                    {projectOverview?.projectName || 'Claude Code Workflow'}
                  </h2>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                    {projectOverview?.description || 'AI-powered workflow management system'}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-border hidden md:block" />

              {/* Tech Stack Badges */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 font-medium">
                  <Code2 className="h-3 w-3" />
                  {projectOverview?.technologyStack?.languages?.[0]?.name || 'TypeScript'}
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-600 font-medium">
                  <Server className="h-3 w-3" />
                  {projectOverview?.technologyStack?.frameworks?.[0] || 'Node.js'}
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 text-violet-600 font-medium">
                  <Layers className="h-3 w-3" />
                  {projectOverview?.architecture?.style || 'Modular Monolith'}
                </span>
                {projectOverview?.technologyStack?.buildTools?.[0] && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 text-orange-600 font-medium">
                    <Wrench className="h-3 w-3" />
                    {projectOverview.technologyStack.buildTools[0]}
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-border hidden lg:block" />

              {/* Quick Stats */}
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <Sparkles className="h-3 w-3" />
                  <span className="font-semibold">{projectOverview?.developmentIndex?.feature?.length || 0}</span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'projectOverview.devIndex.category.features' })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-600">
                  <Bug className="h-3 w-3" />
                  <span className="font-semibold">{projectOverview?.developmentIndex?.bugfix?.length || 0}</span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'projectOverview.devIndex.category.bugfixes' })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-600">
                  <FileCode className="h-3 w-3" />
                  <span className="font-semibold">{projectOverview?.developmentIndex?.enhancement?.length || 0}</span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'projectOverview.devIndex.category.enhancements' })}</span>
                </div>
              </div>

              {/* Date + Expand Button */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-auto">
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                  <Calendar className="h-3 w-3" />
                  {projectOverview?.initializedAt ? new Date(projectOverview.initializedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={() => setProjectExpanded(!projectExpanded)}
                >
                  {projectExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Expanded Details */}
            {projectExpanded && (
              <div className="px-3 pb-2 grid grid-cols-4 gap-3 border-t border-border/50 pt-2">
                {/* Architecture */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {formatMessage({ id: 'projectOverview.architecture.title' })}
                  </h4>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-foreground">{projectOverview?.architecture?.style || 'Modular Monolith'}</p>
                    <div className="flex flex-wrap gap-1">
                      {projectOverview?.architecture?.layers?.slice(0, 3).map((layer, i) => (
                        <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{layer}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key Components */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {formatMessage({ id: 'projectOverview.components.title' })}
                  </h4>
                  <div className="space-y-0.5">
                    {projectOverview?.keyComponents?.slice(0, 3).map((comp, i) => (
                      <p key={i} className="text-[9px] text-foreground truncate">{comp.name}</p>
                    )) || (
                      <>
                        <p className="text-[9px] text-foreground">Session Manager</p>
                        <p className="text-[9px] text-foreground">Dashboard Generator</p>
                        <p className="text-[9px] text-foreground">Data Aggregator</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Development History */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <FileCode className="h-3 w-3" />
                    {formatMessage({ id: 'projectOverview.devIndex.title' })}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-0.5 text-[9px] text-emerald-600">
                      <Sparkles className="h-2.5 w-2.5" />
                      {projectOverview?.developmentIndex?.feature?.length || 0}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-blue-600">
                      <FileCode className="h-2.5 w-2.5" />
                      {projectOverview?.developmentIndex?.enhancement?.length || 0}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-600">
                      <Bug className="h-2.5 w-2.5" />
                      {projectOverview?.developmentIndex?.bugfix?.length || 0}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-violet-600">
                      <Wrench className="h-2.5 w-2.5" />
                      {projectOverview?.developmentIndex?.refactor?.length || 0}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-slate-600">
                      <BookOpen className="h-2.5 w-2.5" />
                      {projectOverview?.developmentIndex?.docs?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Design Patterns */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {formatMessage({ id: 'projectOverview.architecture.patterns' })}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {projectOverview?.architecture?.patterns?.slice(0, 4).map((pattern, i) => (
                      <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">{pattern}</span>
                    )) || (
                      <>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">Factory</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">Strategy</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">Observer</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Main content Card: Stats | Workflow+Orchestrator | Task Details */}
      <Card className="h-[320px] flex shrink-0 overflow-hidden">
        {/* Compact Stats Section with Sparklines */}
        <div className="w-[28%] p-2.5 flex flex-col border-r border-border">
          <h3 className="text-xs font-semibold text-foreground mb-2 px-0.5">
            {formatMessage({ id: 'home.sections.statistics' })}
          </h3>

          {statsLoading ? (
            <div className="grid grid-cols-2 gap-1.5 flex-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-14 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 flex-1 content-start overflow-auto">
              <MiniStatCard
                icon={FolderKanban}
                title={formatMessage({ id: 'home.stats.activeSessions' })}
                value={stats?.activeSessions ?? 0}
                variant="primary"
                sparklineData={sparklines.activeSessions}
              />
              <MiniStatCard
                icon={ListChecks}
                title={formatMessage({ id: 'home.stats.totalTasks' })}
                value={stats?.totalTasks ?? 0}
                variant="info"
                sparklineData={sparklines.totalTasks}
              />
              <MiniStatCard
                icon={CheckCircle2}
                title={formatMessage({ id: 'home.stats.completedTasks' })}
                value={stats?.completedTasks ?? 0}
                variant="success"
                sparklineData={sparklines.completedTasks}
              />
              <MiniStatCard
                icon={Clock}
                title={formatMessage({ id: 'home.stats.pendingTasks' })}
                value={stats?.pendingTasks ?? 0}
                variant="warning"
                sparklineData={sparklines.pendingTasks}
              />
              <MiniStatCard
                icon={XCircle}
                title={formatMessage({ id: 'common.status.failed' })}
                value={stats?.failedTasks ?? 0}
                variant="danger"
                sparklineData={sparklines.failedTasks}
              />
              <MiniStatCard
                icon={Activity}
                title={formatMessage({ id: 'common.stats.todayActivity' })}
                value={stats?.todayActivity ?? 0}
                variant="default"
                sparklineData={sparklines.todayActivity}
              />
            </div>
          )}
        </div>

        {/* Workflow Status + Orchestrator Status Section */}
        <div className="w-[26%] p-3 flex flex-col border-r border-border overflow-auto">
          {/* Workflow Status */}
          <h3 className="text-xs font-semibold text-foreground mb-2">
            {formatMessage({ id: 'home.widgets.workflowStatus' })}
          </h3>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {chartData.map((item) => {
                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                const colors = statusColors[item.status] || statusColors.completed;
                return (
                  <div key={item.status} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
                        <span className="text-[11px] text-foreground">
                          {formatMessage({ id: statusLabelKeys[item.status] })}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.count}
                        </span>
                      </div>
                      <span className={cn('text-[11px] font-medium', colors.text)}>
                        {percentage}%
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className="h-1 bg-muted"
                      indicatorClassName={colors.bg}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Orchestrator Status Section */}
          <div className="mt-3 pt-3 border-t border-border">
            <h3 className="text-xs font-semibold text-foreground mb-2">
              {formatMessage({ id: 'navigation.main.orchestrator' })}
            </h3>

            <div className={cn('rounded-lg p-2', orchestratorConfig.bg)}>
              <div className="flex items-center gap-2">
                <OrchestratorIcon className={cn('h-4 w-4', orchestratorConfig.color, coordinatorState.status === 'running' && 'animate-pulse')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[11px] font-medium', orchestratorConfig.color)}>
                    {formatMessage({ id: `common.status.${coordinatorState.status}` })}
                  </p>
                  {coordinatorState.currentExecutionId && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {coordinatorState.pipelineDetails?.nodes[0]?.name || coordinatorState.currentExecutionId}
                    </p>
                  )}
                </div>
              </div>

              {coordinatorState.status !== 'idle' && coordinatorState.commandChain.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      {formatMessage({ id: 'common.labels.progress' })}
                    </span>
                    <span className="font-medium">{orchestratorProgress}%</span>
                  </div>
                  <Progress value={orchestratorProgress} className="h-1 bg-muted/50" />
                  <p className="text-[10px] text-muted-foreground">
                    {coordinatorState.commandChain.filter(n => n.status === 'completed').length}/{coordinatorState.commandChain.length} {formatMessage({ id: 'coordinator.steps' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Details Section: Session Carousel with Task List */}
        <div className="w-[46%] p-3 flex flex-col">
          {/* Header with navigation */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {formatMessage({ id: 'home.sections.taskDetails' })}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handlePrevSession}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground min-w-[40px] text-center">
                {currentSessionIndex + 1} / {MOCK_SESSIONS.length}
              </span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleNextSession}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Session Card (Carousel Item) */}
          {currentSession && (
            <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-border bg-accent/20 p-2.5 overflow-hidden">
              {/* Session Header */}
              <div className="mb-2 pb-2 border-b border-border shrink-0">
                <div className="flex items-start gap-2">
                  <div className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', sessionStatusColors[currentSession.status].bg, sessionStatusColors[currentSession.status].text)}>
                    {formatMessage({ id: `common.status.${currentSession.status === 'in_progress' ? 'inProgress' : currentSession.status}` })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{currentSession.name}</p>
                    <p className="text-[10px] text-muted-foreground">{currentSession.id}</p>
                  </div>
                </div>
                {/* Description */}
                {currentSession.description && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">
                    {currentSession.description}
                  </p>
                )}
                {/* Progress bar */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      {formatMessage({ id: 'common.labels.progress' })}
                    </span>
                    <span className="font-medium text-foreground">
                      {currentSession.tasks.filter(t => t.status === 'completed').length}/{currentSession.tasks.length}
                    </span>
                  </div>
                  <Progress
                    value={currentSession.tasks.length > 0 ? (currentSession.tasks.filter(t => t.status === 'completed').length / currentSession.tasks.length) * 100 : 0}
                    className="h-1 bg-muted"
                    indicatorClassName="bg-success"
                  />
                </div>
                {/* Tags and Date */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {currentSession.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px]">
                      <Tag className="h-2 w-2" />
                      {tag}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground ml-auto">
                    <Calendar className="h-2.5 w-2.5" />
                    {currentSession.updatedAt}
                  </span>
                </div>
              </div>

              {/* Task List for this Session - Two columns */}
              <div className="flex-1 overflow-auto min-h-0">
                <div className="grid grid-cols-2 gap-1">
                  {currentSession.tasks.map((task) => {
                    const config = taskStatusColors[task.status];
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-1.5 p-1.5 rounded hover:bg-background/50 transition-colors cursor-pointer"
                      >
                        <div className={cn('p-0.5 rounded shrink-0', config.bg)}>
                          <StatusIcon className={cn('h-2.5 w-2.5', config.text)} />
                        </div>
                        <p className={cn('flex-1 text-[10px] font-medium truncate', task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {task.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Carousel dots */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {MOCK_SESSIONS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSessionIndex(idx)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  idx === currentSessionIndex ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

export const WorkflowTaskWidget = memo(WorkflowTaskWidgetComponent);

export default WorkflowTaskWidget;
