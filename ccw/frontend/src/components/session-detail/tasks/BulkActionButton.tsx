// ========================================
// BulkActionButton Component
// ========================================
// Reusable button component for bulk actions

import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/Button';
import type { LucideIcon } from 'lucide-react';

export interface BulkActionButtonProps extends Omit<ButtonProps, 'leftIcon'> {
  icon: LucideIcon;
  label: string;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * BulkActionButton component - Button with icon for bulk actions
 */
export function BulkActionButton({
  icon: Icon,
  label,
  isLoading = false,
  disabled = false,
  variant = 'default',
  size = 'sm',
  className = '',
  ...props
}: BulkActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
      className={className}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-1.5" />
      )}
      {label}
    </Button>
  );
}
