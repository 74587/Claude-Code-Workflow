// ========================================
// LiteContextContent Component
// ========================================
// Extracted from LiteTasksPage - renders context data sections for lite sessions

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  Compass,
  Stethoscope,
  FolderOpen,
  FileText,
  Package,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Code,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ExplorationsSection,
  AssetsCard,
  ConflictDetectionCard,
} from '@/components/session-detail/context';
import type { ExplorationsData } from '@/components/session-detail/context/ExplorationsSection';
import type {
  LiteSessionContext,
  LiteDiagnosisItem,
  LiteTaskSession,
} from '@/lib/api';

/**
 * Convert diagnoses from either `items[]` (lite-scanner) or `data{}` (session-routes) format
 * into a uniform LiteDiagnosisItem array.
 */
function getDiagnosisItems(diagnoses: LiteSessionContext['diagnoses']): LiteDiagnosisItem[] {
  if (!diagnoses) return [];
  if (diagnoses.items?.length) return diagnoses.items;
  if (diagnoses.data) {
    return Object.entries(diagnoses.data).map(([angle, content]) => ({
      id: angle,
      title: angle.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()),
      ...(typeof content === 'object' && content !== null ? content : {}),
    })) as LiteDiagnosisItem[];
  }
  return [];
}

/**
 * ContextSection - Collapsible section wrapper for context items
 */
function ContextSection({
  icon,
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Card className="border-border" onClick={(e) => e.stopPropagation()}>
      <button
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px]">{badge}</Badge>
        )}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <CardContent className="px-3 pb-3 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * ContextContent - Renders the context data sections for a lite session
 */
function ContextContent({
  contextData,
  session,
}: {
  contextData: LiteSessionContext;
  session: LiteTaskSession;
}) {
  const { formatMessage } = useIntl();
  const plan = session.plan || {};
  const ctx = contextData.context;

  const hasExplorations = !!(contextData.explorations?.manifest);
  const diagnosisItems = getDiagnosisItems(contextData.diagnoses);
  const hasDiagnoses = !!(contextData.diagnoses?.manifest || diagnosisItems.length > 0);
  const hasContext = !!ctx;
  const hasFocusPaths = !!(plan.focus_paths as string[] | undefined)?.length;
  const hasSummary = !!(plan.summary as string | undefined);
  const hasAnyContent = hasExplorations || hasDiagnoses || hasContext || hasFocusPaths || hasSummary;

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Package className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'liteTasks.contextPanel.empty' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Explorations Section */}
      {hasExplorations && (
        <ContextSection
          icon={<Compass className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.explorations' })}
          badge={
            contextData.explorations?.manifest?.exploration_count
              ? formatMessage(
                  { id: 'liteTasks.contextPanel.explorationsCount' },
                  { count: contextData.explorations.manifest.exploration_count }
                )
              : undefined
          }
        >
          <div className="space-y-2">
            {!!contextData.explorations?.manifest?.task_description && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatMessage({ id: 'liteTasks.contextPanel.taskDescription' })}:
                </span>{' '}
                {String(contextData.explorations.manifest.task_description)}
              </div>
            )}
            {!!contextData.explorations?.manifest?.complexity && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatMessage({ id: 'liteTasks.contextPanel.complexity' })}:
                </span>{' '}
                <Badge variant="info" className="text-[10px]">
                  {String(contextData.explorations.manifest.complexity)}
                </Badge>
              </div>
            )}
            {contextData.explorations?.data && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Object.keys(contextData.explorations.data).map((angle) => (
                  <Badge key={angle} variant="secondary" className="text-[10px] capitalize">
                    {angle.replace(/-/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </ContextSection>
      )}

      {/* Diagnoses Section */}
      {hasDiagnoses && (
        <ContextSection
          icon={<Stethoscope className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.diagnoses' })}
          badge={
            diagnosisItems.length > 0
              ? formatMessage(
                  { id: 'liteTasks.contextPanel.diagnosesCount' },
                  { count: diagnosisItems.length }
                )
              : undefined
          }
        >
          {diagnosisItems.map((item, i) => (
            <div key={i} className="text-xs text-muted-foreground py-1 border-b border-border/50 last:border-0">
              {item.title || item.description || `Diagnosis ${i + 1}`}
            </div>
          ))}
        </ContextSection>
      )}

      {/* Context Package Section */}
      {hasContext && ctx && (
        <ContextSection
          icon={<Package className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.contextPackage' })}
        >
          <div className="space-y-2 text-xs">
            {ctx.task_description && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.taskDescription' })}:</span>{' '}
                {ctx.task_description}
              </div>
            )}

            {ctx.constraints && ctx.constraints.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.constraints' })}:</span>
                </div>
                <div className="space-y-1 pl-2">
                  {ctx.constraints.map((c, i) => (
                    <div key={i} className="text-muted-foreground flex items-start gap-1">
                      <span className="text-primary/50">&bull;</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ctx.focus_paths && ctx.focus_paths.length > 0 && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.focusPaths' })}:</span>{' '}
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {ctx.focus_paths.map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {ctx.relevant_files && ctx.relevant_files.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.relevantFiles' })}:</span>{' '}
                  <Badge variant="outline" className="text-[10px] align-middle">
                    {ctx.relevant_files.length}
                  </Badge>
                </div>
                <div className="space-y-0.5 pl-2 max-h-32 overflow-y-auto">
                  {ctx.relevant_files.map((f, i) => {
                    const filePath = typeof f === 'string' ? f : f.path;
                    const reason = typeof f === 'string' ? undefined : (f.rationale || f.reason);
                    return (
                      <div key={i} className="group flex items-start gap-1 text-muted-foreground hover:bg-muted/30 rounded px-1 py-0.5">
                        <span className="text-primary/50 shrink-0">{i + 1}.</span>
                        <span className="font-mono text-xs truncate flex-1" title={filePath}>
                          {filePath}
                        </span>
                        {reason && (
                          <span className="text-[10px] text-muted-foreground/60 truncate ml-1" title={reason}>
                            ({reason})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {ctx.dependencies && ctx.dependencies.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.dependencies' })}:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ctx.dependencies.map((d, i) => {
                    const depInfo = typeof d === 'string'
                      ? { name: d, type: '', version: '' }
                      : d as { name: string; type?: string; version?: string };
                    return (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {depInfo.name}
                        {depInfo.version && <span className="ml-1 opacity-70">@{depInfo.version}</span>}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {ctx.session_id && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.sessionId' })}:</span>{' '}
                <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{ctx.session_id}</span>
              </div>
            )}

            {ctx.metadata && (
              <div>
                <div className="text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{formatMessage({ id: 'liteTasks.contextPanel.metadata' })}:</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pl-2 text-muted-foreground">
                  {Object.entries(ctx.metadata).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-primary/60">{k}:</span>
                      <span className="truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ContextSection>
      )}

      {/* Conflict Risks (simple inline list) */}
      {ctx?.conflict_risks && Array.isArray(ctx.conflict_risks) && ctx.conflict_risks.length > 0 && (
        <ContextSection
          icon={<AlertTriangle className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.conflictRisks' })}
        >
          <ul className="space-y-1">
            {ctx.conflict_risks.map((r, i) => {
              const desc = typeof r === 'string' ? r : r.description;
              const severity = typeof r === 'string' ? undefined : r.severity;
              return (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  {severity && <Badge variant={severity === 'high' ? 'destructive' : 'warning'} className="text-[10px]">{severity}</Badge>}
                  <span>{desc}</span>
                </li>
              );
            })}
          </ul>
        </ContextSection>
      )}

      {/* Structured Conflict Detection (higher priority than simple conflict_risks) */}
      {ctx?.conflict_detection && (
        <ConflictDetectionCard data={ctx.conflict_detection} />
      )}

      {/* Assets */}
      {ctx?.assets && (
        <AssetsCard data={ctx.assets} />
      )}

      {/* Enhanced Explorations - when angle data has detail fields */}
      {contextData.explorations?.data &&
       Object.values(contextData.explorations.data).some(angle =>
         angle.project_structure?.length || angle.relevant_files?.length || angle.patterns?.length
       ) && (
        <ExplorationsSection data={{
          manifest: {
            task_description: contextData.explorations.manifest?.task_description || '',
            complexity: contextData.explorations.manifest?.complexity,
            exploration_count: contextData.explorations.manifest?.exploration_count || Object.keys(contextData.explorations.data).length,
          },
          data: contextData.explorations.data as ExplorationsData['data'],
        }} />
      )}

      {/* Focus Paths from Plan */}
      {hasFocusPaths && (
        <ContextSection
          icon={<FolderOpen className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.focusPaths' })}
        >
          <div className="flex flex-wrap gap-1.5">
            {(plan.focus_paths as string[]).map((p, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                {p}
              </Badge>
            ))}
          </div>
        </ContextSection>
      )}

      {/* Plan Summary */}
      {hasSummary && (
        <ContextSection
          icon={<FileText className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.summary' })}
        >
          <p className="text-xs text-muted-foreground">{plan.summary as string}</p>
        </ContextSection>
      )}

      {/* Raw JSON Debug View */}
      {contextData.context && (
        <ContextSection
          icon={<Code className="h-4 w-4" />}
          title={formatMessage({ id: 'liteTasks.contextPanel.rawJson' })}
          defaultOpen={false}
        >
          <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
            {JSON.stringify(contextData.context, null, 2)}
          </pre>
        </ContextSection>
      )}
    </div>
  );
}

export { ContextContent as LiteContextContent, ContextSection as LiteContextSection };
