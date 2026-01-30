// ========================================
// Language Switcher Component
// ========================================
// Language selection dropdown with flag icons

import { Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/utils';

export interface LanguageSwitcherProps {
  /** Compact variant for header (smaller, icon-only trigger) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Language options with flag emojis and labels
const LANGUAGE_OPTIONS = [
  { value: 'en' as const, label: 'English', flag: '🇺🇸' },
  { value: 'zh' as const, label: '中文', flag: '🇨🇳' },
] as const;

/**
 * Language switcher component
 * Allows users to switch between English and Chinese
 */
export function LanguageSwitcher({ compact = false, className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectTrigger
        className={cn(
          compact ? 'w-[110px]' : 'w-[160px]',
          'gap-2',
          className
        )}
        aria-label="Select language"
      >
        {compact ? (
          <>
            <Languages className="w-4 h-4" />
            <SelectValue />
          </>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        {LANGUAGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              <span className="text-base">{option.flag}</span>
              <span>{option.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default LanguageSwitcher;
