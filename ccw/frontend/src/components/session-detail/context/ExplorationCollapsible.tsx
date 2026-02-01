// ========================================
// ExplorationCollapsible Component
// ========================================
// Collapsible section for exploration angles

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/Collapsible';
import { cn } from '@/lib/utils';

export interface ExplorationCollapsibleProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * ExplorationCollapsible component - Collapsible section for exploration data
 */
export function ExplorationCollapsible({
  title,
  icon,
  defaultOpen = false,
  children,
  className,
}: ExplorationCollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('border rounded-lg', className)}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-foreground">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-0">
        <div className="mt-2 space-y-2">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
