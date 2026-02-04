// ========================================
// ProjectOverviewPage Component
// ========================================
// Project overview page displaying architecture, tech stack, and components

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  Code2,
  Blocks,
  Component,
  GitBranch,
  BarChart3,
  ScrollText,
  ClipboardList,
  Sparkles,
  Zap,
  Bug,
  Wrench,
  BookOpen,
  CheckSquare,
  Lightbulb,
  BookMarked,
  ShieldAlert,
  LayoutGrid,
  GitCommitHorizontal,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { useProjectOverview, useUpdateGuidelines } from '@/hooks/useProjectOverview';
import { toast } from 'sonner';
import type {
  KeyComponent,
  DevelopmentIndexEntry,
  GuidelineEntry,
  LearningEntry,
  ProjectGuidelines,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

type DevIndexView = 'category' | 'timeline';

// Helper function to format date (currently unused but kept for future use)
// @ts-ignore - kept for potential future use
function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * ProjectOverviewPage component - Display project architecture and tech stack
 */
export function ProjectOverviewPage() {
  const { formatMessage } = useIntl();
  const { projectOverview, isLoading, error, refetch } = useProjectOverview();
  const { updateGuidelines, isUpdating } = useUpdateGuidelines();
  const [devIndexView, setDevIndexView] = React.useState<DevIndexView>('category');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editedGuidelines, setEditedGuidelines] = React.useState<ProjectGuidelines | null>(null);

  // Helper function to format date
  function formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  }

  // Define dev index categories (before any conditional logic)
  const devIndexCategories = [
    { key: 'feature', i18nKey: 'projectOverview.devIndex.category.features', icon: Sparkles, color: 'primary' },
    { key: 'enhancement', i18nKey: 'projectOverview.devIndex.category.enhancements', icon: Zap, color: 'success' },
    { key: 'bugfix', i18nKey: 'projectOverview.devIndex.category.bugfixes', icon: Bug, color: 'destructive' },
    { key: 'refactor', i18nKey: 'projectOverview.devIndex.category.refactorings', icon: Wrench, color: 'warning' },
    { key: 'docs', i18nKey: 'projectOverview.devIndex.category.documentation', icon: BookOpen, color: 'muted' },
  ];

  // Collect all entries for timeline (compute before any conditional logic)
  const allDevEntries = React.useMemo(() => {
    if (!projectOverview?.developmentIndex) return [];

    const entries: Array<{
      title: string;
      description?: string;
      type: string;
      typeLabel: string;
      typeIcon: React.ElementType;
      typeColor: string;
      date: string;
      sessionId?: string;
      sub_feature?: string;
      tags?: string[];
    }> = [];

    devIndexCategories.forEach((cat) => {
      (projectOverview.developmentIndex?.[cat.key] || []).forEach((entry: DevelopmentIndexEntry) => {
        entries.push({
          ...entry,
          type: cat.key,
          typeLabel: formatMessage({ id: cat.i18nKey }),
          typeIcon: cat.icon,
          typeColor: cat.color,
          date: entry.archivedAt || entry.date || entry.implemented_at || '',
        });
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projectOverview?.developmentIndex]);

  // Calculate totals for development index
  const devIndexTotals = devIndexCategories.reduce((acc, cat) => {
    acc[cat.key] = (projectOverview?.developmentIndex?.[cat.key] || []).length;
    return acc;
  }, {} as Record<string, number>);

  const totalEntries = Object.values(devIndexTotals).reduce((sum, count) => sum + count, 0);

  // Calculate statistics
  const totalFeatures = devIndexCategories.reduce((sum, cat) => sum + devIndexTotals[cat.key], 0);

  // Guidelines edit handlers
  const handleEditStart = React.useCallback(() => {
    const g = projectOverview?.guidelines;
    setEditedGuidelines({
      conventions: {
        coding_style: [...(g?.conventions?.coding_style || [])],
        naming_patterns: [...(g?.conventions?.naming_patterns || [])],
        file_structure: [...(g?.conventions?.file_structure || [])],
        documentation: [...(g?.conventions?.documentation || [])],
      },
      constraints: {
        architecture: [...(g?.constraints?.architecture || [])],
        tech_stack: [...(g?.constraints?.tech_stack || [])],
        performance: [...(g?.constraints?.performance || [])],
        security: [...(g?.constraints?.security || [])],
      },
      quality_rules: (g?.quality_rules || []).map((r) => ({ ...r })),
      learnings: (g?.learnings || []).map((l) => ({ ...l })),
    });
    setIsEditMode(true);
  }, [projectOverview?.guidelines]);

  const handleEditCancel = React.useCallback(() => {
    setIsEditMode(false);
    setEditedGuidelines(null);
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!editedGuidelines) return;
    try {
      await updateGuidelines(editedGuidelines);
      toast.success(formatMessage({ id: 'projectOverview.guidelines.saveSuccess' }));
      setIsEditMode(false);
      setEditedGuidelines(null);
    } catch {
      toast.error(formatMessage({ id: 'projectOverview.guidelines.saveError' }));
    }
  }, [editedGuidelines, updateGuidelines, formatMessage]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <Component className="h-5 w-5 flex-shrink-0" />
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

  // Render empty state
  if (!projectOverview) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'projectOverview.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          {formatMessage({ id: 'projectOverview.empty.message' })}
        </p>
      </div>
    );
  }

  const { technologyStack, architecture, keyComponents, developmentIndex, guidelines, metadata } = projectOverview;

  return (
    <div className="space-y-4">
      {/* Project Header + Technology Stack - Combined */}
      <Card>
        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-4 pb-3 border-b border-border">
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground mb-1">
                {projectOverview.projectName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {projectOverview.description || formatMessage({ id: 'projectOverview.noDescription' })}
              </p>
            </div>
            <div className="text-sm text-muted-foreground text-right">
              <div>
                {formatMessage({ id: 'projectOverview.header.initialized' })}:{' '}
                {formatDate(projectOverview.initializedAt)}
              </div>
              {metadata?.analysis_mode && (
                <div className="mt-1">
                  <span className="font-mono text-xs px-1.5 py-0.5 bg-muted rounded">
                    {metadata.analysis_mode}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Technology Stack */}
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Code2 className="w-4 h-4" />
            {formatMessage({ id: 'projectOverview.techStack.title' })}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Languages */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatMessage({ id: 'projectOverview.techStack.languages' })}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {technologyStack?.languages && technologyStack.languages.length > 0 ? (
                  technologyStack.languages.map((lang: { name: string; file_count: number; primary?: boolean }) => (
                    <div
                      key={lang.name}
                      className={`flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded text-sm ${
                        lang.primary ? 'ring-1 ring-primary' : ''
                      }`}
                    >
                      <span className="font-medium text-foreground">{lang.name}</span>
                      <span className="text-xs text-muted-foreground">{lang.file_count}</span>
                      {lang.primary && (
                        <span className="text-[10px] px-1 py-0.5 bg-primary text-primary-foreground rounded">
                          {formatMessage({ id: 'projectOverview.techStack.primary' })}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {formatMessage({ id: 'projectOverview.techStack.noLanguages' })}
                  </span>
                )}
              </div>
            </div>

            {/* Frameworks */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatMessage({ id: 'projectOverview.techStack.frameworks' })}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {technologyStack?.frameworks && technologyStack.frameworks.length > 0 ? (
                  technologyStack.frameworks.map((fw: string) => (
                    <Badge key={fw} variant="success" className="px-2 py-0.5 text-xs">
                      {fw}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {formatMessage({ id: 'projectOverview.techStack.noFrameworks' })}
                  </span>
                )}
              </div>
            </div>

            {/* Build Tools */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatMessage({ id: 'projectOverview.techStack.buildTools' })}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {technologyStack?.build_tools && technologyStack.build_tools.length > 0 ? (
                  technologyStack.build_tools.map((tool: string) => (
                    <Badge key={tool} variant="warning" className="px-2 py-0.5 text-xs">
                      {tool}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </div>
            </div>

            {/* Test Frameworks */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatMessage({ id: 'projectOverview.techStack.testFrameworks' })}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {technologyStack?.test_frameworks && technologyStack.test_frameworks.length > 0 ? (
                  technologyStack.test_frameworks.map((fw: string) => (
                    <Badge key={fw} variant="default" className="px-2 py-0.5 text-xs">
                      {fw}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architecture & Key Components - Merged */}
      {(architecture || (keyComponents && keyComponents.length > 0)) && (
        <Card>
          <CardContent className="p-4">
            {/* Architecture Section */}
            {architecture && (
              <>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <Blocks className="w-4 h-4" />
                  {formatMessage({ id: 'projectOverview.architecture.title' })}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Style */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {formatMessage({ id: 'projectOverview.architecture.style' })}
                    </h4>
                    <div className="px-2 py-1.5 bg-background border border-border rounded">
                      <span className="text-foreground font-medium text-sm">{architecture.style}</span>
                    </div>
                  </div>

                  {/* Layers */}
                  {architecture.layers && architecture.layers.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {formatMessage({ id: 'projectOverview.architecture.layers' })}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {architecture.layers.map((layer: string) => (
                          <span key={layer} className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs">
                            {layer}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Patterns */}
                  {architecture.patterns && architecture.patterns.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {formatMessage({ id: 'projectOverview.architecture.patterns' })}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {architecture.patterns.map((pattern: string) => (
                          <span key={pattern} className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs">
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Divider between Architecture and Components */}
            {architecture && keyComponents && keyComponents.length > 0 && (
              <div className="border-t border-border my-4" />
            )}

            {/* Key Components Section */}
            {keyComponents && keyComponents.length > 0 && (
              <>
                <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <Component className="w-4 h-4" />
                  {formatMessage({ id: 'projectOverview.components.title' })}
                </h3>

                <div className="space-y-2">
                  {keyComponents.map((comp: KeyComponent) => {
                    const importance = comp.importance || 'low';
                    const importanceColors: Record<string, string> = {
                      high: 'border-l-2 border-l-destructive bg-destructive/5',
                      medium: 'border-l-2 border-l-warning bg-warning/5',
                      low: 'border-l-2 border-l-muted-foreground bg-muted',
                    };
                    const importanceBadges: Record<string, React.ReactElement> = {
                      high: (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          {formatMessage({ id: 'projectOverview.components.importance.high' })}
                        </Badge>
                      ),
                      medium: (
                        <Badge variant="warning" className="text-xs px-1.5 py-0">
                          {formatMessage({ id: 'projectOverview.components.importance.medium' })}
                        </Badge>
                      ),
                      low: (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {formatMessage({ id: 'projectOverview.components.importance.low' })}
                        </Badge>
                      ),
                    };

                    return (
                      <div
                        key={comp.name}
                        className={`p-2.5 rounded ${importanceColors[importance] || importanceColors.low}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-foreground text-sm">{comp.name}</h4>
                          {importanceBadges[importance]}
                        </div>
                        {comp.description && (
                          <p className="text-xs text-muted-foreground mb-1">{comp.description}</p>
                        )}
                        {comp.responsibility && comp.responsibility.length > 0 && (
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {comp.responsibility.map((resp: string, i: number) => (
                              <li key={i}>{resp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Development Index */}
      {developmentIndex && totalEntries > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <GitBranch className="w-4 h-4" />
                {formatMessage({ id: 'projectOverview.devIndex.title' })}
              </h3>
              <div className="flex items-center gap-1.5">
                {devIndexCategories.map((cat) => {
                  const count = devIndexTotals[cat.key];
                  if (count === 0) return null;
                  const Icon = cat.icon;
                  return (
                    <Badge key={cat.key} variant={cat.color === 'primary' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
                      <Icon className="w-3 h-3 mr-0.5" />
                      {count}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Tabs value={devIndexView} onValueChange={(v) => setDevIndexView(v as DevIndexView)}>
              <div className="flex items-center justify-between mb-3">
                <TabsList className="h-8">
                  <TabsTrigger value="category" className="text-sm px-3 py-1 h-7">
                    <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                    {formatMessage({ id: 'projectOverview.devIndex.categories' })}
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-sm px-3 py-1 h-7">
                    <GitCommitHorizontal className="w-3.5 h-3.5 mr-1" />
                    {formatMessage({ id: 'projectOverview.devIndex.timeline' })}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="category">
                <div className="space-y-3">
                  {devIndexCategories.map((cat) => {
                    const entries = developmentIndex?.[cat.key] || [];
                    if (entries.length === 0) return null;
                    const Icon = cat.icon;

                    return (
                      <div key={cat.key}>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{formatMessage({ id: cat.i18nKey })}</span>
                          <Badge variant="secondary" className="text-xs px-1 py-0">{entries.length}</Badge>
                        </h4>
                        <div className="space-y-1.5">
                          {entries.slice(0, 5).map((entry: DevelopmentIndexEntry & { type?: string; typeLabel?: string; typeIcon?: React.ElementType; typeColor?: string; date?: string }, i: number) => (
                            <div
                              key={i}
                              className="p-2 bg-background border border-border rounded hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-start justify-between mb-0.5">
                                <h5 className="font-medium text-foreground text-sm">{entry.title}</h5>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(entry.archivedAt || entry.date || entry.implemented_at)}
                                </span>
                              </div>
                              {entry.description && (
                                <p className="text-xs text-muted-foreground mb-1">{entry.description}</p>
                              )}
                              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                                {entry.sessionId && (
                                  <span className="px-1.5 py-0.5 bg-primary-light text-primary rounded font-mono">
                                    {entry.sessionId}
                                  </span>
                                )}
                                {entry.sub_feature && (
                                  <span className="px-1.5 py-0.5 bg-muted rounded">{entry.sub_feature}</span>
                                )}
                                {entry.status && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded ${
                                      entry.status === 'completed'
                                        ? 'bg-success-light text-success'
                                        : 'bg-warning-light text-warning'
                                    }`}
                                  >
                                    {entry.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {entries.length > 5 && (
                            <div className="text-sm text-muted-foreground text-center py-1">
                              ... and {entries.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                <div className="space-y-3">
                  {allDevEntries.slice(0, 20).map((entry, i) => {
                    const Icon = entry.typeIcon;
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full bg-${entry.typeColor}-light text-${entry.typeColor} flex items-center justify-center`}
                          >
                            <Icon className="w-3 h-3" />
                          </div>
                          {i < Math.min(allDevEntries.length, 20) - 1 && (
                            <div className="w-0.5 flex-1 bg-border mt-1.5" />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-start justify-between mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={
                                  entry.typeColor === 'primary'
                                    ? 'default'
                                    : entry.typeColor === 'destructive'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                                className="text-xs px-1.5 py-0"
                              >
                                {entry.typeLabel}
                              </Badge>
                              <h5 className="font-medium text-foreground text-sm">{entry.title}</h5>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mb-1">{entry.description}</p>
                          )}
                          <div className="flex items-center gap-1.5 text-xs">
                            {entry.sessionId && (
                              <span className="px-1.5 py-0.5 bg-muted rounded font-mono">
                                {entry.sessionId}
                              </span>
                            )}
                            {entry.sub_feature && (
                              <span className="px-1.5 py-0.5 bg-muted rounded">{entry.sub_feature}</span>
                            )}
                            {entry.tags &&
                              entry.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-accent rounded">
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {allDevEntries.length > 20 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      ... and {allDevEntries.length - 20} more entries
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Guidelines */}
      {guidelines && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ScrollText className="w-5 h-5" />
                {formatMessage({ id: 'projectOverview.guidelines.title' })}
              </h3>
              <div className="flex gap-2">
                {!isEditMode ? (
                  <Button variant="outline" size="sm" onClick={handleEditStart}>
                    <Edit className="w-4 h-4 mr-1" />
                    {formatMessage({ id: 'projectOverview.guidelines.edit' })}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={isUpdating}>
                      <X className="w-4 h-4 mr-1" />
                      {formatMessage({ id: 'projectOverview.guidelines.cancel' })}
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSave} disabled={isUpdating}>
                      <Save className="w-4 h-4 mr-1" />
                      {isUpdating ? formatMessage({ id: 'projectOverview.guidelines.saving' }) : formatMessage({ id: 'projectOverview.guidelines.save' })}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {!isEditMode ? (
                <>
                  {/* Read-only Mode - Conventions */}
                  {guidelines.conventions && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <BookMarked className="w-4 h-4" />
                        <span>{formatMessage({ id: 'projectOverview.guidelines.conventions' })}</span>
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(guidelines.conventions).map(([key, items]) => {
                          const itemList = Array.isArray(items) ? items : [];
                          if (itemList.length === 0) return null;
                          return (
                            <div key={key} className="space-y-1">
                              {itemList.map((item: string, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg"
                                >
                                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                                    {key}
                                  </span>
                                  <span className="text-sm text-foreground">{item}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Read-only Mode - Constraints */}
                  {guidelines.constraints && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span>{formatMessage({ id: 'projectOverview.guidelines.constraints' })}</span>
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(guidelines.constraints).map(([key, items]) => {
                          const itemList = Array.isArray(items) ? items : [];
                          if (itemList.length === 0) return null;
                          return (
                            <div key={key} className="space-y-1">
                              {itemList.map((item: string, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg"
                                >
                                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                                    {key}
                                  </span>
                                  <span className="text-sm text-foreground">{item}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Read-only Mode - Quality Rules */}
                  {guidelines.quality_rules && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        <span>{formatMessage({ id: 'projectOverview.guidelines.qualityRules' })}</span>
                      </h4>
                      {guidelines.quality_rules.length > 0 ? (
                        <div className="space-y-2">
                          {guidelines.quality_rules.map((rule: GuidelineEntry, i: number) => (
                            <div key={i} className="p-3 bg-background border border-border rounded-lg">
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-sm text-foreground font-medium">{rule.rule}</span>
                                {rule.enforced_by && (
                                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                                    {rule.enforced_by}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatMessage({ id: 'projectOverview.guidelines.scope' })}: {rule.scope}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {formatMessage({ id: 'projectOverview.guidelines.noQualityRules' }) || 'No quality rules defined yet. Switch to edit mode to add rules.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Read-only Mode - Learnings */}
                  {guidelines.learnings && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        <span>{formatMessage({ id: 'projectOverview.guidelines.learnings' })}</span>
                      </h4>
                      {guidelines.learnings.length > 0 ? (
                        <div className="space-y-2">
                          {guidelines.learnings.map((learning: LearningEntry, i: number) => (
                            <div
                              key={i}
                              className="p-3 bg-background border border-border rounded-lg border-l-4 border-l-primary"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-sm text-foreground">{learning.insight}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                  {formatDate(learning.date)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                {learning.category && (
                                  <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded">
                                    {learning.category}
                                  </span>
                                )}
                                {learning.session_id && (
                                  <span className="px-2 py-0.5 bg-primary-light text-primary rounded font-mono">
                                    {learning.session_id}
                                  </span>
                                )}
                              </div>
                              {learning.context && (
                                <p className="text-xs text-muted-foreground mt-2">{learning.context}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {formatMessage({ id: 'projectOverview.guidelines.noLearnings' }) || 'No learning summaries yet. Switch to edit mode to add learnings.'}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Edit Mode - Conventions */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <BookMarked className="w-4 h-4" />
                      <span>{formatMessage({ id: 'projectOverview.guidelines.conventions' })}</span>
                    </h4>
                    <div className="space-y-3">
                      {Object.entries({
                        coding_style: 'codingStyle',
                        naming_patterns: 'namingPatterns',
                        file_structure: 'fileStructure',
                        documentation: 'documentation',
                      }).map(([key, labelKey]) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            {formatMessage({ id: `projectOverview.guidelines.conventionCategories.${labelKey}` })}
                          </label>
                          <div className="flex flex-wrap gap-2 p-2 border border-border rounded-lg bg-background min-h-[40px]">
                            {((editedGuidelines?.conventions as any)?.[key] || []).map((item: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                                <span>{item}</span>
                                <button
                                  className="ml-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    const updated = { ...editedGuidelines };
                                    (updated.conventions as any)[key] = ((updated.conventions as any)[key] as string[]).filter((_: string, i: number) => i !== idx);
                                    setEditedGuidelines(updated);
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <input
                              type="text"
                              className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.addItem' })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                  const updated = { ...editedGuidelines };
                                  (updated.conventions as any)[key] = [...((updated.conventions as any)[key] || []), e.currentTarget.value.trim()];
                                  setEditedGuidelines(updated);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit Mode - Constraints */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      <span>{formatMessage({ id: 'projectOverview.guidelines.constraints' })}</span>
                    </h4>
                    <div className="space-y-3">
                      {Object.entries({
                        architecture: 'architecture',
                        tech_stack: 'techStack',
                        performance: 'performance',
                        security: 'security',
                      }).map(([key, labelKey]) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            {formatMessage({ id: `projectOverview.guidelines.constraintCategories.${labelKey}` })}
                          </label>
                          <div className="flex flex-wrap gap-2 p-2 border border-border rounded-lg bg-background min-h-[40px]">
                            {((editedGuidelines?.constraints as any)?.[key] || []).map((item: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                                <span>{item}</span>
                                <button
                                  className="ml-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    const updated = { ...editedGuidelines };
                                    (updated.constraints as any)[key] = ((updated.constraints as any)[key] as string[]).filter((_: string, i: number) => i !== idx);
                                    setEditedGuidelines(updated);
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <input
                              type="text"
                              className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.addItem' })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                  const updated = { ...editedGuidelines };
                                  (updated.constraints as any)[key] = [...((updated.constraints as any)[key] || []), e.currentTarget.value.trim()];
                                  setEditedGuidelines(updated);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit Mode - Quality Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        <span>{formatMessage({ id: 'projectOverview.guidelines.qualityRules' })}</span>
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = { ...editedGuidelines };
                          updated.quality_rules = [...(updated.quality_rules || []), { rule: '', scope: '', enforced_by: '' }];
                          setEditedGuidelines(updated);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {formatMessage({ id: 'projectOverview.guidelines.qualityRuleFields.addRule' })}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(editedGuidelines?.quality_rules || []).map((rule, idx) => (
                        <div key={idx} className="p-3 border border-border rounded-lg space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.rule' })}
                              value={rule.rule}
                              onChange={(e) => {
                                const updated = { ...editedGuidelines };
                                updated.quality_rules![idx].rule = e.target.value;
                                setEditedGuidelines(updated);
                              }}
                            />
                            <button
                              className="text-destructive hover:bg-destructive/10 p-2 rounded"
                              onClick={() => {
                                const updated = { ...editedGuidelines };
                                updated.quality_rules = updated.quality_rules!.filter((_, i) => i !== idx);
                                setEditedGuidelines(updated);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              className="px-2 py-1 text-sm border border-border rounded bg-background"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.scope' })}
                              value={rule.scope}
                              onChange={(e) => {
                                const updated = { ...editedGuidelines };
                                updated.quality_rules![idx].scope = e.target.value;
                                setEditedGuidelines(updated);
                              }}
                            />
                            <input
                              type="text"
                              className="px-2 py-1 text-sm border border-border rounded bg-background"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.enforcedBy' })}
                              value={rule.enforced_by || ''}
                              onChange={(e) => {
                                const updated = { ...editedGuidelines };
                                updated.quality_rules![idx].enforced_by = e.target.value;
                                setEditedGuidelines(updated);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit Mode - Learnings */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        <span>{formatMessage({ id: 'projectOverview.guidelines.learnings' })}</span>
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = { ...editedGuidelines };
                          updated.learnings = [...(updated.learnings || []), { insight: '', category: '', session_id: '', context: '', date: new Date().toISOString() }];
                          setEditedGuidelines(updated);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {formatMessage({ id: 'projectOverview.guidelines.learningFields.addLearning' })}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(editedGuidelines?.learnings || []).map((learning, idx) => (
                        <div key={idx} className="p-3 border border-border rounded-lg space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.insight' })}
                              value={learning.insight}
                              onChange={(e) => {
                                const updated = { ...editedGuidelines };
                                updated.learnings![idx].insight = e.target.value;
                                setEditedGuidelines(updated);
                              }}
                            />
                            <button
                              className="text-destructive hover:bg-destructive/10 p-2 rounded"
                              onClick={() => {
                                const updated = { ...editedGuidelines };
                                updated.learnings = updated.learnings!.filter((_, i) => i !== idx);
                                setEditedGuidelines(updated);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              className="px-2 py-1 text-sm border border-border rounded bg-background"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.category' })}
                              value={learning.category || ''}
                              onChange={(e) => {
                                const updated = { ...editedGuidelines };
                                updated.learnings![idx].category = e.target.value;
                                setEditedGuidelines(updated);
                              }}
                            />
                            <input
                              type="text"
                              className="px-2 py-1 text-sm border border-border rounded bg-background"
                              placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.sessionId' })}
                              value={learning.session_id || ''}
                              onChange={(e) => {
                                const updated = { ...editedGuidelines };
                                updated.learnings![idx].session_id = e.target.value;
                                setEditedGuidelines(updated);
                              }}
                            />
                          </div>
                          <textarea
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                            placeholder={formatMessage({ id: 'projectOverview.guidelines.placeholders.context' })}
                            rows={2}
                            value={learning.context || ''}
                            onChange={(e) => {
                              const updated = { ...editedGuidelines };
                              updated.learnings![idx].context = e.target.value;
                              setEditedGuidelines(updated);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {formatMessage({ id: 'projectOverview.stats.title' })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">{totalFeatures}</div>
              <div className="text-sm text-muted-foreground">
                {formatMessage({ id: 'projectOverview.stats.totalFeatures' })}
              </div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                {formatMessage({ id: 'projectOverview.stats.lastUpdated' })}
              </div>
              <div className="text-sm font-medium text-foreground">
                {allDevEntries.length > 0 ? formatDate(allDevEntries[0].date) : '-'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectOverviewPage;
