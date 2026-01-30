// ========================================
// 404 Not Found Page
// ========================================
// Displayed when user navigates to a non-existent route

import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function NotFoundPage() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Card className="max-w-md w-full p-8 text-center">
        {/* 404 Number */}
        <div className="text-6xl font-bold text-primary mb-4">404</div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Page Not Found
        </h1>
        <p className="text-muted-foreground mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="default" asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>

        {/* Help Link */}
        <p className="text-sm text-muted-foreground mt-6">
          Need help? Visit the{' '}
          <Link to="/help" className="text-primary hover:underline">
            Help page
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default NotFoundPage;
