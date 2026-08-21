import {
  ChartArea,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartPie,
  ChartScatter,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHART_KIND_LABEL, type ChartKind } from '../lib/build-chart';

const ICONS: Record<ChartKind, LucideIcon> = {
  barras: ChartColumn,
  barras_apiladas: ChartColumnStacked,
  lineas: ChartLine,
  area: ChartArea,
  circular: ChartPie,
  dispersion: ChartScatter,
};

const HINTS: Record<ChartKind, string> = {
  barras: 'Comparar categorías entre sí.',
  barras_apiladas: 'Ver el total y su composición a la vez.',
  lineas: 'Seguir una evolución en el tiempo.',
  area: 'Evolución de un total acumulado.',
  circular: 'Repartir un total entre pocas partes.',
  dispersion: 'Relacionar dos métricas entre sí.',
};

const KINDS = Object.keys(ICONS) as ChartKind[];

/**
 * El tipo de gráfico, como una tira de opciones y no como un desplegable: es
 * la decisión que más cambia lo que se ve, y elegirla a ciegas por su nombre
 * cuesta más que reconocerla por su forma.
 */
export function ChartKindPicker({
  value,
  onChange,
  compact = false,
}: {
  value: ChartKind;
  onChange: (kind: ChartKind) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de gráfico"
      className={cn(
        'grid gap-2',
        compact ? 'grid-cols-6' : 'grid-cols-3 sm:grid-cols-6',
      )}
    >
      {KINDS.map((kind) => {
        const Icon = ICONS[kind];
        const active = kind === value;

        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${CHART_KIND_LABEL[kind]} — ${HINTS[kind]}`}
            onClick={() => onChange(kind)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              active
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden />
            {!compact && (
              <span className="text-xs leading-tight text-balance">
                {CHART_KIND_LABEL[kind]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
