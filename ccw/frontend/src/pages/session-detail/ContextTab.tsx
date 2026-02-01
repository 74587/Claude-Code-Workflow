// ========================================
// ContextTab Component
// ========================================
// Context tab for session detail page

import { useIntl } from 'react-intl';
import {
  Package,
  FileCode,
  Tag,
  Settings,
  BookOpen,
  CheckSquare,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { SessionDetailContext } from '@/lib/api';
import {
  ExplorationsSection,
  AssetsCard,
  DependenciesCard,
  TestContextCard,
  ConflictDetectionCard,
} from '@/components/session-detail/context';

export interface ContextTabProps {
  context?: SessionDetailContext;
}

/**
 * ContextTab component - Display session context information
 */
export function ContextTab({ context }: ContextTabProps) {
  const { formatMessage } = useIntl();

  if (!context) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.context.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.context.empty.message' })}
        </p>
      </div>
    );
  }

  const hasRequirements = context.requirements && context.requirements.length > 0;
  const hasFocusPaths = context.focus_paths && context.focus_paths.length > 0;
  const hasArtifacts = context.artifacts && context.artifacts.length > 0;
  const hasSharedContext = context.shared_context;
  const hasExtendedContext = context.context;
  const hasExplorations = context.explorations;

  if (
    !hasRequirements &&
    !hasFocusPaths &&
    !hasArtifacts &&
    !hasSharedContext &&
    !hasExtendedContext &&
    !hasExplorations
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.context.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.context.empty.message' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Original Context Sections - Maintained for backward compatibility */}
      {hasRequirements && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              {formatMessage({ id: 'sessionDetail.context.requirements' })}
              <Badge variant="secondary">{context.requirements!.length}</Badge>
            </h3>
            <ul className="space-y-2">
              {context.requirements!.map((req, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 p-3 bg-background rounded-lg border"
                >
                  <span className="text-primary font-bold">{i + 1}.</span>
                  <span className="text-sm text-foreground flex-1">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasFocusPaths && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              {formatMessage({ id: 'sessionDetail.context.focusPaths' })}
              <Badge variant="secondary">{context.focus_paths!.length}</Badge>
            </h3>
            <div className="space-y-2">
              {context.focus_paths!.map((path, i) => (
                <div
                  key={i}
                  className="p-3 bg-background rounded-lg border font-mono text-sm text-foreground"
                >
                  {path}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasArtifacts && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {formatMessage({ id: 'sessionDetail.context.artifacts' })}
              <Badge variant="secondary">{context.artifacts!.length}</Badge>
            </h3>
            <div className="flex flex-wrap gap-2">
              {context.artifacts!.map((artifact, i) => (
                <Badge key={i} variant="outline" className="px-3 py-1.5">
                  {artifact}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasSharedContext && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {formatMessage({ id: 'sessionDetail.context.sharedContext' })}
            </h3>

            {context.shared_context!.tech_stack && context.shared_context!.tech_stack.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {formatMessage({ id: 'sessionDetail.context.techStack' })}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {context.shared_context!.tech_stack!.map((tech, i) => (
                    <Badge key={i} variant="success" className="px-3 py-1.5">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {context.shared_context!.conventions && context.shared_context!.conventions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {formatMessage({ id: 'sessionDetail.context.conventions' })}
                </h4>
                <ul className="space-y-1">
                  {context.shared_context!.conventions!.map((conv, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{conv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Extended Context Sections from context-package.json */}
      {hasExplorations && <ExplorationsSection data={context.explorations} />}

      {hasExtendedContext && context.context!.assets && (
        <AssetsCard data={context.context!.assets} />
      )}

      {hasExtendedContext && context.context!.dependencies && (
        <DependenciesCard data={context.context!.dependencies} />
      )}

      {hasExtendedContext && context.context!.test_context && (
        <TestContextCard data={context.context!.test_context} />
      )}

      {hasExtendedContext && context.context!.conflict_detection && (
        <ConflictDetectionCard data={context.context!.conflict_detection} />
      )}
    </div>
  );
}
