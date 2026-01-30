// ========================================
// MainContent Component
// ========================================
// Main content area with scrollable container and Outlet for routes

import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface MainContentProps {
  /** Additional class names */
  className?: string;
  /** Children to render instead of Outlet */
  children?: React.ReactNode;
}

export function MainContent({ className, children }: MainContentProps) {
  return (
    <main
      className={cn(
        'flex-1 overflow-y-auto min-w-0',
        'p-4 md:p-6',
        className
      )}
      role="main"
    >
      {children ?? <Outlet />}
    </main>
  );
}

export default MainContent;
