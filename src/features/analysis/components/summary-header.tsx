import { formatWindow } from '../lib/dates';
import { formatCount, formatMetric } from '../lib/format';
import type { Currency, ExplorationResult, MetricDef } from '../types';
import { DeltaPill } from './delta-pill';

interface SummaryHeaderProps {
  result: ExplorationResult;
  metric: MetricDef;
  currency: Currency;
}

/**
 * Encabezado con la cifra total del período y su variación. Es el marco que da
 * sentido al resto: sin él, un ranking de subidas no dice si el conjunto sube.
 *
 * Va en una sola línea —rótulo, cifra, variación y período uno tras otro— en
 * vez de apilado. Es la misma información, pero la altura que ahorra en la
 * barra de control se la queda el gráfico, que es lo que hay debajo.
 */
export function SummaryHeader({ result, metric, currency }: SummaryHeaderProps) {
  const delta =
    result.previousTotal === null || result.previousTotal === 0
      ? null
      : ((result.total - result.previousTotal) / Math.abs(result.previousTotal)) * 100;

  return (
    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs text-muted-foreground">{metric.label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatMetric(result.total, { format: metric.format, currency })}
        </p>
        {result.previousTotal !== null && (
          // La escala es el propio valor: aquí no hay conjunto con el que
          // comparar la intensidad, así que el color satura al máximo.
          <DeltaPill value={delta} scale={Math.abs(delta ?? 0)} className="self-center" />
        )}
        {result.window !== null && (
          <p className="text-xs text-pretty text-muted-foreground">
            {formatWindow(result.window)}
            {result.previousWindow !== null && (
              <>
                {' · frente a '}
                {formatWindow(result.previousWindow)}:{' '}
                <span className="tabular-nums">
                  {formatMetric(result.previousTotal, {
                    format: metric.format,
                    currency,
                  })}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      <dl className="flex shrink-0 items-baseline gap-x-5 text-xs text-muted-foreground">
        <Stat label="Filas" value={formatCount(result.rowsMatched)} />
        <Stat label="Categorías" value={formatCount(result.items.length)} />
        {result.rowsWithoutDate > 0 && (
          <Stat label="Sin fecha" value={formatCount(result.rowsWithoutDate)} />
        )}
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
