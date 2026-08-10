import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MetricDef } from '../types';

interface MetricSelectorProps {
  metrics: readonly MetricDef[];
  value: string;
  onChange: (id: string) => void;
}

/** Qué se mide. Todas las métricas comparten dimensión, filtros y período. */
export function MetricSelector({ metrics, value, onChange }: MetricSelectorProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-sm font-medium">Métrica</span>
      <Select
        value={value}
        onValueChange={(next: string | null) => {
          if (next !== null) onChange(next);
        }}
        items={metrics.map((metric) => ({ value: metric.id, label: metric.label }))}
      >
        <SelectTrigger className="h-9 w-full sm:h-8 sm:w-fit" aria-label="Métrica analizada">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {metrics.map((metric) => (
            <SelectItem key={metric.id} value={metric.id}>
              {metric.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
