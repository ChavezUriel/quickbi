import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CURRENCIES,
  CURRENCY_LABEL,
  METRIC_AGG_LABEL,
  METRIC_FORMATS,
  METRIC_FORMAT_LABEL,
} from '../labels';
import type { Currency, MetricFormat } from '../types';
import type { AnalysisConfigState } from '../use-analysis-config';

const NO_DATE = '__sin_fecha__';

/**
 * Segunda mitad del paso 2: qué papel juega cada columna en el cuadro de mando.
 *
 * Los tipos de la tarjeta anterior deciden qué puede ser cada columna; aquí se
 * decide qué **es**: el eje temporal, las categorías por las que abrir y las
 * cifras que se miden.
 */
export function AnalysisSetup({ state }: { state: AnalysisConfigState }) {
  const { config, dateColumns, dimensionColumns, measureColumns, metricSettings } = state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configuración del análisis</CardTitle>
        <CardDescription>
          Prepara el cuadro de mando: sobre qué fecha se ordena el tiempo, por qué
          columnas se puede abrir y qué cifras se miden.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">Eje temporal</h3>
            <p className="text-xs text-muted-foreground">
              Sobre esta columna se calculan el período, la evolución y la comparación.
            </p>
          </div>

          {dateColumns.length === 0 ? (
            <Alert role="status">
              <Info className="size-4" />
              <AlertTitle>Sin columnas de fecha</AlertTitle>
              <AlertDescription>
                El cuadro de mando funcionará igual, pero sin evolución temporal ni
                comparación entre períodos. Si alguna columna contiene fechas, corrige
                su tipo arriba.
              </AlertDescription>
            </Alert>
          ) : (
            <Select
              value={config.dateColumn ?? NO_DATE}
              onValueChange={(value: string | null) => {
                if (value !== null) state.setDateColumn(value === NO_DATE ? null : value);
              }}
              items={[
                ...dateColumns.map((column) => ({
                  value: column.name,
                  label: column.name,
                })),
                { value: NO_DATE, label: 'Sin eje temporal' },
              ]}
            >
              <SelectTrigger className="w-full sm:w-fit" aria-label="Columna de fecha">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateColumns.map((column) => (
                  <SelectItem key={column.name} value={column.name}>
                    {column.name}
                  </SelectItem>
                ))}
                <SelectItem value={NO_DATE}>Sin eje temporal</SelectItem>
              </SelectContent>
            </Select>
          )}
        </section>

        <section className="space-y-2 border-t pt-4">
          <div>
            <h3 className="text-sm font-medium">Dimensiones</h3>
            <p className="text-xs text-muted-foreground">
              Columnas por las que se podrá agrupar y filtrar. Se proponen las de
              cardinalidad razonable; puedes añadir o quitar.
            </p>
          </div>

          {dimensionColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna columna de texto o booleana: el análisis se hará sobre el total.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {dimensionColumns.map((column) => {
                const active = config.dimensions.includes(column.name);

                return (
                  <button
                    key={column.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => state.toggleDimension(column.name)}
                    className={cn(
                      'flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs transition-colors sm:h-7',
                      'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 truncate font-mono">{column.name}</span>
                    <span className={cn('shrink-0 tabular-nums', active ? 'opacity-70' : '')}>
                      {column.distinctCount.toLocaleString('es-ES')}
                      {column.distinctCountExact ? '' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Consulta de contenedor, no de ventana: esta tarjeta es una columna
            estrecha en pantalla ancha y ocupa todo el ancho en móvil. Lo que
            decide la disposición es el sitio que tiene, no el de la pantalla. */}
        <section className="@container space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-medium">Métricas</h3>
            <p className="text-xs text-muted-foreground">
              Cifras que se podrán medir. El recuento de filas está siempre disponible.
            </p>
          </div>

          {measureColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna columna numérica: solo se podrá contar filas.
            </p>
          ) : (
            <ul className="space-y-2">
              {measureColumns.map((column) => {
                const setting = metricSettings[column.name];
                if (setting === undefined) return null;

                return (
                  // En estrecho la fila se apila: nombre arriba, los dos
                  // desplegables a medias debajo. Envueltos en línea quedaban
                  // desplegables de 100 px con el rótulo cortado.
                  <li
                    key={column.name}
                    className="space-y-2 rounded-md border p-2 @md:flex @md:flex-wrap @md:items-center @md:gap-3 @md:space-y-0"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm select-none @md:flex-1">
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        onChange={(event) =>
                          state.setMetricEnabled(column.name, event.target.checked)
                        }
                        className="size-4 shrink-0 rounded border-input text-primary focus:ring-1 focus:ring-ring"
                      />
                      <span className="min-w-0 truncate font-mono text-xs">{column.name}</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2 @md:contents">
                    <Select
                      value={setting.agg}
                      onValueChange={(value: string | null) => {
                        if (value !== null) {
                          state.setMetricSetting(column.name, {
                            agg: value as 'sum' | 'avg',
                          });
                        }
                      }}
                      items={[
                        { value: 'sum', label: METRIC_AGG_LABEL.sum },
                        { value: 'avg', label: METRIC_AGG_LABEL.avg },
                      ]}
                    >
                      <SelectTrigger
                        size="sm"
                        disabled={!setting.enabled}
                        className="h-8 w-full @md:h-7 @md:w-fit"
                        aria-label={`Agregación de ${column.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">{METRIC_AGG_LABEL.sum}</SelectItem>
                        <SelectItem value="avg">{METRIC_AGG_LABEL.avg}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={setting.format}
                      onValueChange={(value: string | null) => {
                        if (value !== null) {
                          state.setMetricSetting(column.name, {
                            format: value as MetricFormat,
                          });
                        }
                      }}
                      items={METRIC_FORMATS.map((format) => ({
                        value: format,
                        label: METRIC_FORMAT_LABEL[format],
                      }))}
                    >
                      <SelectTrigger
                        size="sm"
                        disabled={!setting.enabled}
                        className="h-8 w-full @md:h-7 @md:w-fit"
                        aria-label={`Formato de ${column.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METRIC_FORMATS.map((format) => (
                          <SelectItem key={format} value={format}>
                            {METRIC_FORMAT_LABEL[format]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {state.usesCurrency && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Moneda</span>
              <Select
                value={config.currency}
                onValueChange={(value: string | null) => {
                  if (value !== null) state.setCurrency(value as Currency);
                }}
                items={CURRENCIES.map((currency) => ({
                  value: currency,
                  label: CURRENCY_LABEL[currency],
                }))}
              >
                <SelectTrigger size="sm" aria-label="Moneda de las métricas">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {CURRENCY_LABEL[currency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
