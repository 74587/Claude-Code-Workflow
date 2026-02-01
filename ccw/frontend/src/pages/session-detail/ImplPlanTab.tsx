// ========================================
// ImplPlanTab Component
// ========================================
// IMPL Plan tab for session detail page

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Ruler, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import MarkdownModal from '@/components/shared/MarkdownModal';

// ========================================
// Types
// ========================================

export interface ImplPlanTabProps {
  implPlan?: string;
}

// ========================================
// Component
// ========================================

/**
 * ImplPlanTab component - Display IMPL_PLAN.md content with modal viewer
 * 
 * @example
 * ```tsx
 * <ImplPlanTab 
 *   implPlan="# Implementation Plan\n\n## Steps..."}
 * />
 * ```
 */
export function ImplPlanTab({ implPlan }: ImplPlanTabProps) {
  const { formatMessage } = useIntl();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  if (!implPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Ruler className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.implPlan.empty.title' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'sessionDetail.implPlan.empty.message' })}
        </p>
      </div>
    );
  }

  // Get preview (first 5 lines)
  const lines = implPlan.split('\n');
  const preview = lines.slice(0, 5).join('\n');
  const hasMore = lines.length > 5;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ruler className="w-5 h-5" />
              {formatMessage({ id: 'sessionDetail.implPlan.title' })}
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsModalOpen(true)}
            >
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
            <div className="mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsModalOpen(true)}
                className="w-full"
              >
                {formatMessage({ id: 'sessionDetail.implPlan.viewFull' }, { count: lines.length })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Viewer */}
      <MarkdownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="IMPL_PLAN.md"
        content={implPlan}
        contentType="markdown"
        maxWidth="3xl"
      />
    </>
  );
}

// ========================================
// Exports
// ========================================

export default ImplPlanTab;
