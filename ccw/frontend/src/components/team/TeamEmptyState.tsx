// ========================================
// TeamEmptyState Component
// ========================================
// Empty state displayed when no teams are available

import { useIntl } from 'react-intl';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

export function TeamEmptyState() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">
              {formatMessage({ id: 'team.empty.title' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'team.empty.description' })}
            </p>
          </div>
          <code className="px-3 py-1.5 bg-muted rounded text-xs font-mono">
            /team:coordinate
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
