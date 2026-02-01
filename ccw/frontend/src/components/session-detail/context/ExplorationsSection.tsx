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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ExplorationCollapsible } from './ExplorationCollapsible';
import { FieldRenderer } from './FieldRenderer';

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          {formatMessage({ id: 'sessionDetail.context.explorations.title' })}
          <span className="text-sm font-normal text-muted-foreground">
            ({data.manifest.exploration_count} {formatMessage({ id: 'sessionDetail.context.explorations.angles' })})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
    project_structure?: string[];
    relevant_files?: string[];
    patterns?: string[];
    dependencies?: string[];
    integration_points?: string[];
    testing?: string[];
  };
}

function AngleContent({ data }: AngleContentProps) {
  const { formatMessage } = useIntl();

  const sections: Array<{
    key: string;
    icon: JSX.Element;
    label: string;
    data: unknown;
  }> = [];

  if (data.project_structure && data.project_structure.length > 0) {
    sections.push({
      key: 'project_structure',
      icon: <FolderOpen className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.projectStructure' }),
      data: data.project_structure,
    });
  }

  if (data.relevant_files && data.relevant_files.length > 0) {
    sections.push({
      key: 'relevant_files',
      icon: <FileText className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.relevantFiles' }),
      data: data.relevant_files,
    });
  }

  if (data.patterns && data.patterns.length > 0) {
    sections.push({
      key: 'patterns',
      icon: <Layers className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.patterns' }),
      data: data.patterns,
    });
  }

  if (data.dependencies && data.dependencies.length > 0) {
    sections.push({
      key: 'dependencies',
      icon: <GitBranch className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.dependencies' }),
      data: data.dependencies,
    });
  }

  if (data.integration_points && data.integration_points.length > 0) {
    sections.push({
      key: 'integration_points',
      icon: <Link className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.integrationPoints' }),
      data: data.integration_points,
    });
  }

  if (data.testing && data.testing.length > 0) {
    sections.push({
      key: 'testing',
      icon: <TestTube className="w-4 h-4" />,
      label: formatMessage({ id: 'sessionDetail.context.explorations.testing' }),
      data: data.testing,
    });
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No data available</p>;
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <div key={section.key} className="flex items-start gap-2">
          <span className="text-muted-foreground mt-0.5">{section.icon}</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {section.label}
            </p>
            <FieldRenderer value={section.data} type="array" />
          </div>
        </div>
      ))}
    </div>
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
