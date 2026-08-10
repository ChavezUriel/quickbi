import { cn } from '@/lib/utils';
import { formatNaturalWindow } from '../lib/dates';
import { formatCount, formatMetric } from '../lib/format';
import type { Currency, ExplorationResult, MetricDef } from '../types';
import { DeltaPill } from './delta-pill';

interface SummaryHeaderProps {
  result: ExplorationResult;
  metric: MetricDef;
  currency: Currency;
  dimension: string;
  isTotal: boolean;
}

/**
 * Resumen del periodo colocado justo encima de la evolucion temporal. La
 * cifra principal ocupa el primer KPI y los contadores completan la misma
 * tira visual, dejando la barra de controles para selectores y filtros.
 */
export function SummaryHeader({ result, metric, currency, dimension, isTotal }: SummaryHeaderProps) {
  const delta =
    result.previousTotal === null || result.previousTotal === 0
      ? null
      : ((result.total - result.previousTotal) / Math.abs(result.previousTotal)) * 100;

  return (
    <section
      aria-label="Resumen del periodo"
      className={cn(
        'grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3',
        isTotal
          ? 'sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)]'
          : 'sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)]',
      )}
    >
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="text-xs text-muted-foreground">{metric.label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-2xl font-semibold tabular-nums">
            {formatMetric(result.total, { format: metric.format, currency })}
          </p>
          {result.previousTotal !== null && (
            // The scale is the value itself: there is no peer set to compare
            // against, so the color saturates at the maximum.
            <DeltaPill value={delta} scale={Math.abs(delta ?? 0)} />
          )}
        </div>
        {result.window !== null && (
          <div className="mt-0.5 text-xs text-pretty text-muted-foreground">
            {result.previousWindow !== null ? (
              <>
                <p>{formatNaturalWindow(result.window)} comparado con</p>
                <p>
                  <span className="tabular-nums">
                    {formatMetric(result.previousTotal, {
                      format: metric.format,
                      currency,
                    })}
                  </span>{' '}
                  {formatNaturalWindow(result.previousWindow)}
                </p>
              </>
            ) : (
              <p>{formatNaturalWindow(result.window)}</p>
            )}
          </div>
        )}
      </div>

      <dl className="contents">
        <Stat label="Registros" value={formatCount(result.rowsMatched)} />
        {!isTotal && (
          <Stat label={pluralizeDimension(dimension)} value={formatCount(result.items.length)} />
        )}
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 border-t pt-2 text-xs text-muted-foreground sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
      <dt>{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** Pluralizes the visible dimension name for the KPI label. */
function pluralizeDimension(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) return label;

  const lastWordMatch = trimmed.match(/^(.*?)([^\s]+)$/u);
  if (lastWordMatch === null) return label;

  const prefix = lastWordMatch[1] ?? '';
  const word = lastWordMatch[2] ?? '';
  if (word.length === 0) return label;
  const plural = word.toLocaleLowerCase('es').endsWith('z')
    ? `${word.slice(0, -1)}ces`
    : /[aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc]$/iu.test(word)
      ? `${word}s`
      : `${word}es`;

  return `${prefix}${plural}`;
}
