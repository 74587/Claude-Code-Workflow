// ========================================
// DependenciesCard Component
// ========================================
// Displays internal and external dependencies

import { useIntl } from 'react-intl';
import { GitBranch, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export interface InternalDependency {
  from: string;
  type: string;
  to: string;
}

export interface ExternalDependency {
  package: string;
  version?: string;
  usage?: string;
}

export interface DependenciesData {
  internal?: InternalDependency[];
  external?: ExternalDependency[];
}

export interface DependenciesCardProps {
  data?: DependenciesData;
}

/**
 * DependenciesCard component - Displays project dependencies
 */
export function DependenciesCard({ data }: DependenciesCardProps) {
  const { formatMessage } = useIntl();

  if (!data || (!data.internal?.length && !data.external?.length)) {
    return null;
  }

  const internalCount = data.internal?.length || 0;
  const externalCount = data.external?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          {formatMessage({ id: 'sessionDetail.context.dependencies.title' })}
          <Badge variant="secondary">{internalCount + externalCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.internal && data.internal.length > 0 && (
          <InternalDependenciesSection dependencies={data.internal} />
        )}

        {data.external && data.external.length > 0 && (
          <ExternalDependenciesSection dependencies={data.external} />
        )}
      </CardContent>
    </Card>
  );
}

interface InternalDependenciesSectionProps {
  dependencies: InternalDependency[];
}

function InternalDependenciesSection({ dependencies }: InternalDependenciesSectionProps) {
  const { formatMessage } = useIntl();

  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        {formatMessage({ id: 'sessionDetail.context.dependencies.internal' })} ({dependencies.length})
      </h4>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-foreground">
                {formatMessage({ id: 'sessionDetail.context.dependencies.from' })}
              </th>
              <th className="px-4 py-2 text-left font-medium text-foreground">
                {formatMessage({ id: 'sessionDetail.context.dependencies.type' })}
              </th>
              <th className="px-4 py-2 text-left font-medium text-foreground">
                {formatMessage({ id: 'sessionDetail.context.dependencies.to' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {dependencies.map((dep, index) => (
              <tr key={index} className="hover:bg-muted/50">
                <td className="px-4 py-2 font-mono text-foreground">{dep.from}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{dep.type}</Badge>
                </td>
                <td className="px-4 py-2 font-mono text-foreground">{dep.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ExternalDependenciesSectionProps {
  dependencies: ExternalDependency[];
}

function ExternalDependenciesSection({ dependencies }: ExternalDependenciesSectionProps) {
  const { formatMessage } = useIntl();

  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
        <Package className="w-4 h-4" />
        {formatMessage({ id: 'sessionDetail.context.dependencies.external' })} ({dependencies.length})
      </h4>
      <div className="flex flex-wrap gap-2">
        {dependencies.map((dep, index) => (
          <Badge key={index} variant="secondary" className="px-3 py-1.5">
            {dep.package}
            {dep.version && <span className="ml-1 text-foreground">@{dep.version}</span>}
          </Badge>
        ))}
      </div>
      {dependencies.some(d => d.usage) && (
        <div className="mt-3 space-y-1">
          {dependencies
            .filter(d => d.usage)
            .map((dep, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                <span className="font-medium">{dep.package}:</span> {dep.usage}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
