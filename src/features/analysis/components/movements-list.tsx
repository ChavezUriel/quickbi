import { ArrowDownRight, ArrowUpRight, Ghost } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deltaScale, formatMetric } from '../lib/format';
import type { Currency, ExplorationItem, ExplorationResult, MetricDef } from '../types';
import { DeltaPill } from './delta-pill';

interface MovementsListProps {
  result: ExplorationResult;
  metric: MetricDef;
  currency: Currency;
  /** Categorías seleccionadas: se resaltan y el resto se atenúa. */
  selected: readonly string[];
  /** `false` cuando la dimensión activa es el total y no hay nada que filtrar. */
  selectable: boolean;
  onSelect: (name: string, additive: boolean) => void;
}

/**
 * Quién sube y quién baja respecto al período de comparación. Ordena por
 * variación, no por tamaño: lo interesante es el cambio, no el volumen, que ya
 * cuenta la tabla de detalle.
 */
export function MovementsList({
  result,
  metric,
  currency,
  selected,
  selectable,
  onSelect,
}: MovementsListProps) {
  // La escala de color es común a las dos listas: si no, la mayor caída y la
  // mayor subida se pintarían igual de intensas aunque una sea diez veces mayor.
  const scale = deltaScale(
    [...result.subidas, ...result.caidas].map((item) => item.deltaPct),
  );

  // Tres columnas cuando la tarjeta las tiene; una apilada cuando vive en la
  // columna estrecha del cuadro de mando. Lo decide el contenedor, no la
  // ventana: a 1920 px esta tarjeta mide 440, no 1900.
  return (
    <div className="@container">
      <div className="grid gap-3 @2xl:grid-cols-3">
        <Column
        title="Mayores subidas"
        icon={<ArrowUpRight className="size-4 text-emerald-600" aria-hidden />}
        empty="Nada sube respecto al período anterior."
        items={result.subidas}
        scale={scale}
        metric={metric}
        currency={currency}
        selected={selected}
        selectable={selectable}
        onSelect={onSelect}
      />

      <Column
        title="Mayores caídas"
        icon={<ArrowDownRight className="size-4 text-red-600" aria-hidden />}
        empty="Nada baja respecto al período anterior."
        items={result.caidas}
        scale={scale}
        metric={metric}
        currency={currency}
        selected={selected}
        selectable={selectable}
        onSelect={onSelect}
      />

      <div className="space-y-2 rounded-lg border p-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Ghost className="size-4 text-muted-foreground" aria-hidden />
          Desaparecidos
        </h3>
        {result.desaparecidos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nada que estuviera antes haya dejado de aparecer.
          </p>
        ) : (
          <ul className="space-y-1">
            {result.desaparecidos.map((item) => (
              <li
                key={item.name}
                className="flex items-baseline justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-muted-foreground" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatMetric(item.previousValue, {
                    format: metric.format,
                    currency,
                    compact: true,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

function Column({
  title,
  icon,
  empty,
  items,
  scale,
  metric,
  currency,
  selected,
  selectable,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  items: readonly ExplorationItem[];
  scale: number;
  metric: MetricDef;
  currency: Currency;
  selected: readonly string[];
  selectable: boolean;
  onSelect: (name: string, additive: boolean) => void;
}) {
  const dimming = selected.length > 0;

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const isSelected = selected.includes(item.name);

            return (
              <li key={item.name}>
                <button
                  type="button"
                  disabled={!selectable}
                  aria-pressed={selectable ? isSelected : undefined}
                  onClick={(event) => onSelect(item.name, event.ctrlKey || event.metaKey)}
                  className={cn(
                    // `min-h-8` da un objetivo táctil decente sin abrir la
                    // lista en pantallas donde caben diez entradas.
                    'flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors',
                    selectable && 'hover:bg-muted',
                    selectable ? 'cursor-pointer' : 'cursor-default',
                    dimming && !isSelected && 'opacity-40',
                    isSelected && 'bg-muted',
                  )}
                >
                  <span className="min-w-0 truncate" title={item.name}>
                    {item.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatMetric(item.value, {
                        format: metric.format,
                        currency,
                        compact: true,
                      })}
                    </span>
                    <DeltaPill value={item.deltaPct} scale={scale} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
