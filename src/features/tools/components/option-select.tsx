import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
}

/**
 * Desplegable de una lista de opciones. La primitiva pide los `items` por
 * separado para poder pintar el valor elegido en el disparador, y repetir esa
 * pareja en cada control de cada herramienta era el ruido que más se notaba.
 */
export function OptionSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  size = 'default',
  disabled = false,
}: {
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  size?: 'sm' | 'default';
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next: string | null) => {
        if (next !== null) onChange(next);
      }}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
    >
      <SelectTrigger
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn('w-full', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
