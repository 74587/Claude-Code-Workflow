// ========================================
// AssetsCard Component
// ========================================
// Displays assets with category tabs and card grid

import { useIntl } from 'react-intl';
import { FileText, Code, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

export interface AssetItem {
  path: string;
  relevance_score?: number;
  scope?: string;
  contains?: string[];
}

export interface AssetsData {
  documentation?: AssetItem[];
  source_code?: AssetItem[];
  tests?: AssetItem[];
}

export interface AssetsCardProps {
  data?: AssetsData;
}

/**
 * AssetsCard component - Displays project assets with categorization
 */
export function AssetsCard({ data }: AssetsCardProps) {
  const { formatMessage } = useIntl();

  if (!data || (!data.documentation?.length && !data.source_code?.length && !data.tests?.length)) {
    return null;
  }

  const docCount = data.documentation?.length || 0;
  const sourceCount = data.source_code?.length || 0;
  const testCount = data.tests?.length || 0;
  const totalAssets = docCount + sourceCount + testCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {formatMessage({ id: 'sessionDetail.context.assets.title' })}
          <Badge variant="secondary">{totalAssets}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={docCount > 0 ? 'documentation' : sourceCount > 0 ? 'source_code' : 'tests'}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documentation" disabled={!docCount}>
              <FileText className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'sessionDetail.context.categories.documentation' })}
              {docCount > 0 && <span className="ml-1 text-xs">({docCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="source_code" disabled={!sourceCount}>
              <Code className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'sessionDetail.context.categories.sourceCode' })}
              {sourceCount > 0 && <span className="ml-1 text-xs">({sourceCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="tests" disabled={!testCount}>
              <TestTube className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'sessionDetail.context.categories.tests' })}
              {testCount > 0 && <span className="ml-1 text-xs">({testCount})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documentation" className="mt-4">
            <AssetGrid items={data.documentation || []} type="documentation" />
          </TabsContent>

          <TabsContent value="source_code" className="mt-4">
            <AssetGrid items={data.source_code || []} type="source_code" />
          </TabsContent>

          <TabsContent value="tests" className="mt-4">
            <AssetGrid items={data.tests || []} type="tests" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface AssetGridProps {
  items: AssetItem[];
  type: string;
}

function AssetGrid({ items }: AssetGridProps) {
  const { formatMessage } = useIntl();

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {formatMessage({ id: 'sessionDetail.context.assets.noData' })}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-foreground truncate">{item.path}</p>
            </div>
            {item.relevance_score !== undefined && (
              <Badge
                variant={item.relevance_score > 0.7 ? 'success' : item.relevance_score > 0.4 ? 'default' : 'secondary'}
                className="flex-shrink-0"
              >
                {Math.round(item.relevance_score * 100)}%
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {item.scope && (
              <span className="text-muted-foreground">
                {formatMessage({ id: 'sessionDetail.context.assets.scope' })}: {item.scope}
              </span>
            )}
            {item.contains && item.contains.length > 0 && (
              <span className="text-muted-foreground">
                {formatMessage({ id: 'sessionDetail.context.assets.contains' })}: {item.contains.join(', ')}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
