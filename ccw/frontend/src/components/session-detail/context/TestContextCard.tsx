// ========================================
// TestContextCard Component
// ========================================
// Displays test context with stats and framework info

import { useIntl } from 'react-intl';
import { TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FieldRenderer } from './FieldRenderer';

export interface TestFramework {
  name?: string;
  plugins?: string[];
}

export interface FrameworkConfig {
  backend?: TestFramework;
  frontend?: TestFramework;
}

export interface TestContextData {
  frameworks?: FrameworkConfig;
  existing_tests?: string[];
  coverage_config?: Record<string, unknown>;
  test_markers?: string[];
}

export interface TestContextCardProps {
  data?: TestContextData;
}

/**
 * TestContextCard component - Displays testing context and frameworks
 */
export function TestContextCard({ data }: TestContextCardProps) {
  const { formatMessage } = useIntl();

  if (!data || (!data.frameworks && !data.existing_tests?.length && !data.test_markers?.length)) {
    return null;
  }

  const testCount = data.existing_tests?.length || 0;
  const markerCount = data.test_markers?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          {formatMessage({ id: 'sessionDetail.context.testContext.title' })}
          {testCount > 0 && (
            <Badge variant="secondary">{testCount} {formatMessage({ id: 'sessionDetail.context.testContext.tests' })}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        {(testCount > 0 || markerCount > 0) && (
          <div className="flex gap-4">
            {testCount > 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm text-foreground">
                  {testCount} {formatMessage({ id: 'sessionDetail.context.testContext.existingTests' })}
                </span>
              </div>
            )}
            {markerCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="text-sm text-foreground">
                  {markerCount} {formatMessage({ id: 'sessionDetail.context.testContext.markers' })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Framework Cards */}
        {data.frameworks && (
          <FrameworkSection frameworks={data.frameworks} />
        )}

        {/* Test Markers */}
        {data.test_markers && data.test_markers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {formatMessage({ id: 'sessionDetail.context.testContext.markers' })}
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.test_markers.map((marker, index) => (
                <Badge key={index} variant="info" className="px-2 py-0.5">
                  {marker}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Coverage Config */}
        {data.coverage_config && Object.keys(data.coverage_config).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {formatMessage({ id: 'sessionDetail.context.testContext.coverage' })}
            </h4>
            <FieldRenderer value={data.coverage_config} type="object" />
          </div>
        )}

        {/* Existing Tests List */}
        {data.existing_tests && data.existing_tests.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {formatMessage({ id: 'sessionDetail.context.testContext.existingTests' })}
            </h4>
            <FieldRenderer value={data.existing_tests} type="array" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FrameworkSectionProps {
  frameworks: FrameworkConfig;
}

function FrameworkSection({ frameworks }: FrameworkSectionProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {frameworks.backend && (
        <FrameworkCard
          title={formatMessage({ id: 'sessionDetail.context.testContext.backend' })}
          framework={frameworks.backend}
        />
      )}
      {frameworks.frontend && (
        <FrameworkCard
          title={formatMessage({ id: 'sessionDetail.context.testContext.frontend' })}
          framework={frameworks.frontend}
        />
      )}
    </div>
  );
}

interface FrameworkCardProps {
  title: string;
  framework: TestFramework;
}

function FrameworkCard({ title, framework }: FrameworkCardProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="p-3 border rounded-lg">
      <div className="text-sm font-medium text-foreground mb-2">{title}</div>
      <div className="space-y-1">
        {framework.name && (
          <div className="text-xs text-muted-foreground">
            {formatMessage({ id: 'sessionDetail.context.testContext.framework' })}: {framework.name}
          </div>
        )}
        {framework.plugins && framework.plugins.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {framework.plugins.map((plugin, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {plugin}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
