// ========================================
// SummaryTab Component
// ========================================
// Summary tab for session detail page

import { useIntl } from 'react-intl';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

export interface SummaryTabProps {
  summary?: string;
}

/**
 * SummaryTab component - Display session summary
 */
export function SummaryTab({ summary }: SummaryTabProps) {
  const { formatMessage } = useIntl();

  if (!summary) {
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
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {formatMessage({ id: 'sessionDetail.summary.title' })}
        </h3>
        <div className="prose prose-sm max-w-none text-foreground">
          <p className="whitespace-pre-wrap">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
