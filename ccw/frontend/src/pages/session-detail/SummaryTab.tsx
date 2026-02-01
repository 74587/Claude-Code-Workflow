// ========================================
// SummaryTab Component
// ========================================
// Summary tab for session detail page with multiple summaries support

import * as React from 'react';
import { useIntl } from 'react-intl';
import { FileText, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import MarkdownModal from '@/components/shared/MarkdownModal';

// ========================================
// Types
// ========================================

export interface SummaryItem {
  name: string;
  content: string;
}

export interface SummaryTabProps {
  summary?: string;
  summaries?: SummaryItem[];
}

// ========================================
// Component
// ========================================

/**
 * SummaryTab component - Display session summary/summaries with modal viewer
 * 
 * @example
 * ```tsx
 * <SummaryTab 
 *   summaries={[{ name: 'Plan Summary', content: '...' }]} 
 * />
 * ```
 */
export function SummaryTab({ summary, summaries }: SummaryTabProps) {
  const { formatMessage } = useIntl();
  const [selectedSummary, setSelectedSummary] = React.useState<SummaryItem | null>(null);

  // Use summaries array if available, otherwise fallback to single summary
  const summaryList: SummaryItem[] = React.useMemo(() => {
    if (summaries && summaries.length > 0) {
      return summaries;
    }
    if (summary) {
      return [{ name: formatMessage({ id: 'sessionDetail.summary.default' }), content: summary }];
    }
    return [];
  }, [summaries, summary, formatMessage]);

  if (summaryList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.summary.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.summary.empty.message' })}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {summaryList.length === 1 ? (
          // Single summary - inline display
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {summaryList[0].name}
              </h3>
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap">{summaryList[0].content}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Multiple summaries - card list with modal viewer
          summaryList.map((item, index) => (
            <SummaryCard
              key={index}
              summary={item}
              onClick={() => setSelectedSummary(item)}
            />
          ))
        )}
      </div>

      {/* Modal Viewer */}
      <MarkdownModal
        isOpen={!!selectedSummary}
        onClose={() => setSelectedSummary(null)}
        title={selectedSummary?.name || ''}
        content={selectedSummary?.content || ''}
        contentType="markdown"
      />
    </>
  );
}

// ========================================
// Sub-Components
// ========================================

interface SummaryCardProps {
  summary: SummaryItem;
  onClick: () => void;
}

function SummaryCard({ summary, onClick }: SummaryCardProps) {
  const { formatMessage } = useIntl();
  
  // Get preview (first 3 lines)
  const lines = summary.content.split('\n');
  const preview = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow" 
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            {summary.name}
          </CardTitle>
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'common.actions.view' })}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
          {preview}{hasMore && '\n...'}
        </pre>
        {hasMore && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Badge variant="secondary">
              {lines.length} {formatMessage({ id: 'sessionDetail.summary.lines' })}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========================================
// Exports
// ========================================

export default SummaryTab;
