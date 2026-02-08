// ========================================
// Enhanced Select - CVA Variant Definitions
// ========================================

import { cva } from 'class-variance-authority';

export const triggerVariants = cva(
  'inline-flex w-full items-center justify-between rounded-lg border bg-background/80 backdrop-blur-sm text-sm ring-offset-background transition-all duration-200 [&>svg]:transition-transform [&>svg]:duration-200',
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-xs gap-1',
        default: 'h-10 px-3 gap-2',
        lg: 'h-12 px-4 text-base gap-2',
      },
      variant: {
        default: 'border-input hover:bg-primary/10',
        ghost: 'border-transparent hover:bg-primary/10',
        outline: 'border-2 border-muted-foreground/30 hover:bg-primary/10',
      },
      state: {
        normal: 'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        error: 'border-destructive focus-within:ring-2 focus-within:ring-destructive/50 focus-within:ring-offset-2',
        disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
      state: 'normal',
    },
  }
);

export const optionItemVariants = cva(
  'relative flex w-full cursor-pointer select-none items-start rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150',
  {
    variants: {
      isSelected: {
        true: "bg-primary/20 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary before:content-[''] before:rounded-l-md",
        false: 'hover:bg-primary/15',
      },
      isDisabled: {
        true: 'pointer-events-none opacity-50',
        false: '',
      },
    },
    defaultVariants: {
      isSelected: false,
      isDisabled: false,
    },
  }
);
