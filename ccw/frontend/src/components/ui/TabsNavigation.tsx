// ========================================
// TabsNavigation Component
// ========================================
// Reusable tab navigation with underline style

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface TabsNavigationProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: TabItem[];
  className?: string;
}

export function TabsNavigation({ value, onValueChange, tabs, className }: TabsNavigationProps) {
  return (
    <div className={cn("flex gap-2 border-b border-border", className)}>
      {tabs.map((tab) => (
        <Button
          key={tab.value}
          variant="ghost"
          disabled={tab.disabled}
          className={cn(
            "border-b-2 rounded-none h-11 px-4 gap-2",
            value === tab.value
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onValueChange(tab.value)}
        >
          {tab.icon}
          {tab.label}
          {tab.badge}
        </Button>
      ))}
    </div>
  );
}
