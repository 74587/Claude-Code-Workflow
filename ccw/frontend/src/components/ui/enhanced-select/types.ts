// ========================================
// Enhanced Select - Internal Types
// ========================================

export interface EnhancedSelectOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  group?: string;
}

export interface EnhancedSelectProps {
  options: EnhancedSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'default' | 'lg';
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}
