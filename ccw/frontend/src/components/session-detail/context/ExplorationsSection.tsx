// ========================================
// ExplorationsSection Component
// ========================================
// Displays exploration data with collapsible sections

import { useIntl } from 'react-intl';
import {
  GitBranch,
  Search,
  Link,
  TestTube,
  FolderOpen,
  FileText,
  Layers
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ExplorationCollapsible } from './ExplorationCollapsible';

export interface ExplorationsData {
  manifest: {
    task_description: string;
    complexity?: string;
    exploration_count: number;
  };
  data: Record<string, {
    project_structure?: string[];
    relevant_files?: string[];
    patterns?: string[];
    dependencies?: string[];
    integration_points?: string[];
    testing?: string[];
  }>;
}

export interface ExplorationsSectionProps {
  data?: ExplorationsData;
}

/**
 * ExplorationsSection component - Displays all exploration angles
 */
export function ExplorationsSection({ data }: ExplorationsSectionProps) {
  const { formatMessage } = useIntl();

  if (!data || !data.data || Object.keys(data.data).length === 0) {
    return null;
  }

  const explorationEntries = Object.entries(data.data);

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {formatMessage({ id: 'sessionDetail.context.explorations.title' })}
          <Badge variant="secondary">
            {data.manifest.exploration_count} {formatMessage({ id: 'sessionDetail.context.explorations.angles' })}
          </Badge>
        </h3>
        <div className="space-y-3">
          {explorationEntries.map(([angle, angleData]) => (
            <ExplorationCollapsible
              key={angle}
              title={formatAngleTitle(angle)}
              icon={<Search className="w-4 h-4 text-muted-foreground" />}
            >
              <AngleContent data={angleData} />
            </ExplorationCollapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface AngleContentProps {
  data: {
    project_structure?: unknown;
    relevant_files?: unknown;
    patterns?: unknown;
    dependencies?: unknown;
    integration_points?: unknown;
    testing?: unknown;
    [key: string]: unknown;
  };
}

/** Check if a string looks like a file/directory path */
function isPathLike(s: string): boolean {
  return /^[\w@.~\-/\\]+(\/[\w@.\-]+)+(\.\w+)?$/.test(s.trim());
}

/** Safely coerce a field to string[] – handles string, array-of-non-strings, etc. */
function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val.length > 0) return [val];
  return [];
}

function AngleContent({ data }: AngleContentProps) {
  const { formatMessage } = useIntl();

  const sections: Array<{
    key: string;
    icon: JSX.Element;
    label: string;
    items: string[];
    renderAs: 'paths' | 'text';
  }> = [];

  const projectStructure = toStringArray(data.project_structure);
  if (projectStructure.length > 0) {
    sections.push({
      key: 'project_structure',
      icon: <FolderOpen className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.projectStructure' }),
      items: projectStructure,
      renderAs: 'paths',
    });
  }

  const relevantFiles = toStringArray(data.relevant_files);
  if (relevantFiles.length > 0) {
    sections.push({
      key: 'relevant_files',
      icon: <FileText className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.relevantFiles' }),
      items: relevantFiles,
      renderAs: 'paths',
    });
  }

  const patterns = toStringArray(data.patterns);
  if (patterns.length > 0) {
    sections.push({
      key: 'patterns',
      icon: <Layers className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.patterns' }),
      items: patterns,
      renderAs: 'text',
    });
  }

  const dependencies = toStringArray(data.dependencies);
  if (dependencies.length > 0) {
    sections.push({
      key: 'dependencies',
      icon: <GitBranch className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.dependencies' }),
      items: dependencies,
      renderAs: 'text',
    });
  }

  const integrationPoints = toStringArray(data.integration_points);
  if (integrationPoints.length > 0) {
    sections.push({
      key: 'integration_points',
      icon: <Link className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.integrationPoints' }),
      items: integrationPoints,
      renderAs: 'text',
    });
  }

  const testing = toStringArray(data.testing);
  if (testing.length > 0) {
    sections.push({
      key: 'testing',
      icon: <TestTube className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.testing' }),
      items: testing,
      renderAs: 'text',
    });
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No data available</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key}>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <span className="text-muted-foreground">{section.icon}</span>
            {section.label}
          </h4>
          {section.renderAs === 'paths' ? (
            <div className="flex flex-wrap gap-1.5">
              {section.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 bg-muted rounded border text-[11px] font-mono text-foreground"
                >
                  <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span className="flex-1">
                    <FormattedTextItem text={item} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** Render text with inline code/path highlighting */
function FormattedTextItem({ text }: { text: string }) {
  // Split on backtick-wrapped or path-like segments
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length === 1) {
    // No backtick segments, check for embedded paths
    const pathParts = text.split(/(\S+\/\S+\.\w+)/g);
    if (pathParts.length === 1) return <>{text}</>;
    return (
      <>
        {pathParts.map((part, i) =>
          isPathLike(part) ? (
            <code key={i} className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">{part}</code>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  }
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function formatAngleTitle(angle: string): string {
  return angle
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
