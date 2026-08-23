import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTypeIcon } from '@/components/icons/data-type-icons';
import type { ColumnSubtype } from '@/features/dataset/lib/column-types';
import { COUNT_METRIC_ID, type MetricDef } from '../types';

interface MetricSelectorProps {
  metrics: readonly MetricDef[];
  value: string;
  onChange: (id: string) => void;
}

function subtypeForMetric(metric?: MetricDef): ColumnSubtype {
  if (!metric) return 'decimal';
  if (metric.id === COUNT_METRIC_ID) return 'integer';
  if (metric.format === 'moneda') return 'currency';
  if (metric.format === 'porcentaje') return 'percentage';
  return 'decimal';
}

/** Qué se mide. Todas las métricas comparten dimensión, filtros y período. */
export function MetricSelector({ metrics, value, onChange }: MetricSelectorProps) {
  const selected = metrics.find((m) => m.id === value);
  const selectedSubtype = subtypeForMetric(selected);

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
          <div className="flex items-center gap-1.5 truncate">
            <DataTypeIcon type="number" subtype={selectedSubtype} colored className="size-3.5 shrink-0" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {metrics.map((metric) => {
            const subtype = subtypeForMetric(metric);
            return (
              <SelectItem key={metric.id} value={metric.id}>
                <div className="flex items-center gap-2">
                  <DataTypeIcon type="number" subtype={subtype} colored className="size-3.5 shrink-0" />
                  <span>{metric.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
