import * as React from "react";
import { useIntl } from "react-intl";
import { cn } from "@/lib/utils";

export interface VariablePickerProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

const VariablePicker = React.forwardRef<HTMLSelectElement, VariablePickerProps>(
  ({ className, options, value, onChange, placeholder, emptyMessage, ...props }, ref) => {
    const { formatMessage } = useIntl();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value);
    };

    return (
      <select
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="">
            {placeholder}
          </option>
        )}
        {options.length === 0 ? (
          <option value="" disabled>
            {emptyMessage || formatMessage({ id: 'orchestrator.variablePicker.empty' })}
          </option>
        ) : (
          options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))
        )}
      </select>
    );
  }
);
VariablePicker.displayName = "VariablePicker";

export { VariablePicker };
