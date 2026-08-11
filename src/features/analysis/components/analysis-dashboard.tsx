import { useMemo, useRef, type ReactNode } from 'react';
import { Download, Info, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { RANGE_ALL, RANGE_CUSTOM, RANGE_PRESETS } from '../labels';
import { formatCount } from '../lib/format';
import { prepareRows } from '../lib/prepare-rows';
import { TOTAL_DIM } from '../types';
import type { AnalysisConfigState } from '../use-analysis-config';
import { useExploration } from '../use-exploration';
import { DetailTable } from './detail-table';
import { DimensionSelector } from './dimension-selector';
import { FilterBar } from './filter-bar';
import { MetricSelector } from './metric-selector';
import { MovementsList } from './movements-list';
import { SeriesChart, type SeriesChartHandle } from './series-chart';
import { SummaryHeader } from './summary-header';

interface AnalysisDashboardProps {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  analysis: AnalysisConfigState;
}

/**
 * Paso final: exploración multidimensional del dataset.
 *
 * Los tres widgets comparten un único conjunto de filtros. Pulsar en
 * cualquiera de ellos filtra los demás; el que originó la selección se queda
 * entero, con lo elegido resaltado, para poder cambiarla sin deshacerla antes.
 *
 * La disposición tiene tres escalones y siempre reparte todo el ancho que hay;
 * lo que cambia con el tamaño es cuántos paneles comparten fila. Cuando dejan
 * de caber sin apretarse, las tablas bajan —primero el detalle, después los
 * movimientos— en vez de encogerse todos a la vez:
 *
 * - `3xl`: los tres en una fila y la sección clavada a la altura de ventana.
 *   Un cuadro de mando que hay que scrollear no es un cuadro de mando: filtrar
 *   por una categoría y no ver a la vez qué le pasa al total, a la evolución y
 *   al detalle es perder justamente lo que hace útil el gesto.
 * - `lg`: evolución y movimientos arriba, detalle a lo ancho debajo. La fila de
 *   arriba se estira hasta casi la ventana entera y el detalle asoma por abajo.
 * - por debajo: una columna, evolución primero y las dos tablas debajo.
 */
export function AnalysisDashboard({ dataset, mapping, analysis }: AnalysisDashboardProps) {
  const { config } = analysis;
  const chartRef = useRef<SeriesChartHandle>(null);

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, config, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, config],
  );

  const state = useExploration(prepared, config);
  const { metric } = state;

  const dimensionHeader = state.dim === TOTAL_DIM ? 'Total' : state.dim;
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const selectable = state.dim !== TOTAL_DIM;

  const serieResult = state.resultFor('serie');
  const movementsResult = state.resultFor('movimientos');
  const tableResult = state.resultFor('tabla');

  const hasMovements = state.previousWindow !== null;
  const periodLabel =
    RANGE_PRESETS.find((preset) => preset.id === state.rangeId)?.label ??
    (state.rangeId === RANGE_CUSTOM
      ? 'Rango personalizado'
      : state.rangeId === RANGE_ALL
        ? 'Todo el histórico'
        : 'Periodo seleccionado');

  return (
    <div className="flex flex-col gap-3 3xl:h-full 3xl:min-h-0">
      {/* Barra de control: sin cabecera de tarjeta. El título lo dice ya el
          indicador de pasos y la instrucción, la barra inferior; repetirlos
          costaba 70 px permanentes de la única pantalla que hay. */}
      <Card size="sm" className="relative z-20 shrink-0 overflow-visible">
        <CardContent className="space-y-2">
          {/* Donde sí hay scroll, la pista de uso sigue mereciendo su sitio. */}
          <CardDescription className="text-pretty 3xl:hidden">
            Pulsa cualquier categoría —en el gráfico, en los movimientos o en la
            tabla— para filtrar el resto de la sección; con Ctrl o ⌘ se añade a la
            selección.
          </CardDescription>

          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
            <DimensionSelector
              dimensions={config.dimensions}
              value={state.dim}
              onChange={state.setDim}
            />
            <MetricSelector
              metrics={config.metrics}
              value={metric.id}
              onChange={state.setMetricId}
            />
          </div>

          <FilterBar
            state={state}
            distinct={prepared.distinct}
            dimensions={mapping.dimensions.map((column) => column.name)}
            numericColumns={mapping.measures.map((column) => column.name)}
            rows={prepared.rows}
            unmappedColumns={mapping.columns
              .filter((column) => column.type === 'empty')
              .map((column) => column.name)}
          />

          {prepared.dropped > 0 && (
            <p className="text-xs text-pretty text-muted-foreground">
              {formatCount(prepared.dropped)} de {formatCount(dataset.rowCount)} filas
              quedan fuera del análisis por errores de conversión. Puedes preservarlas
              en el paso anterior.
            </p>
          )}
        </CardContent>
      </Card>

      {state.result.items.length === 0 ? (
        <Alert role="status">
          <TriangleAlert className="size-4" />
          <AlertTitle>Sin datos en la selección</AlertTitle>
          <AlertDescription>
            Ninguna fila cumple los filtros dentro del período elegido. Amplía el
            período o quita algún filtro.
          </AlertDescription>
        </Alert>
      ) : (
        <div
          className={cn(
            // La fila única de `3xl` es explícita: es la que se reparte la
            // altura de ventana en vez de crecer con el contenido.
            'grid min-h-0 gap-3 3xl:flex-1 3xl:grid-rows-[minmax(0,1fr)]',
            // El reparto sale de lo que cada panel necesita, no de partes
            // iguales: el detalle pide sitio para sus cinco columnas, el
            // gráfico para su eje de tiempo, y los movimientos son dos listas
            // de «nombre · cifra · variación» que con 400 px van sobradas.
            hasMovements
              ? [
                  'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]',
                  '3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,1.35fr)]',
                ]
              : // Sin comparación no hay movimientos, y el detalle se queda sin
                // las dos columnas que más ancho piden: cabe al lado del
                // gráfico mucho antes.
                'lg:grid-cols-2',
          )}
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
            <SummaryHeader
              result={state.result}
              metric={metric}
              currency={config.currency}
              dimension={dimensionHeader}
              isTotal={state.dim === TOTAL_DIM}
              periodLabel={periodLabel}
            />

            <Panel
            className="flex-1"
            title="Evolución"
            description={
              <>
                {metric.label}
                {selectable && ` por ${dimensionHeader}`}
                {serieResult.serie !== null &&
                  `, agrupada por ${granoName(serieResult.serie.grano)}`}
              </>
            }
            action={
              serieResult.serie !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => chartRef.current?.exportPng()}
                >
                  <Download />
                  PNG
                </Button>
              )
            }
          >
            {serieResult.serie === null ? (
              <Alert role="status">
                <Info className="size-4" />
                <AlertTitle>Sin eje temporal</AlertTitle>
                <AlertDescription>
                  El dataset no tiene ninguna columna de fecha, o no se ha elegido
                  ninguna en el paso anterior. El resto del análisis sigue funcionando,
                  pero no hay evolución ni comparación de períodos.
                </AlertDescription>
              </Alert>
            ) : (
              <SeriesChart
                ref={chartRef}
                serie={serieResult.serie}
                metric={metric}
                currency={config.currency}
                highlighted={state.isEmitter('serie') ? state.selected : []}
                title={`${metric.label}${selectable ? ` por ${dimensionHeader}` : ''}`}
                fileName={baseName}
                onSelect={(name, additive) => state.select('serie', name, additive)}
              />
            )}
            </Panel>
          </div>

          {hasMovements && (
            // Aquí el scroll lo pone la tarjeta: la lista no tiene una altura
            // propia que respetar, simplemente se corta donde acaba el panel.
            //
            // Es el último en bajar: mientras quede fila arriba se queda al
            // lado de la evolución, porque «qué ha subido» se lee contra la
            // curva, no contra la tabla.
            //
            // Es también quien pone el techo de esa fila: sus listas crecen
            // con el número de categorías y sin tope arrastrarían al gráfico
            // hasta dejar el detalle a dos pantallas de scroll. El techo cede
            // ante la altura natural del gráfico —de ahí el `max`— para que en
            // pantallas bajas las dos tarjetas sigan midiendo lo mismo.
            <Panel
              className="order-3 lg:order-2 lg:max-h-[max(33rem,calc(100dvh_-_22rem))] 3xl:max-h-none"
              title="Crecimientos y caídas"
              description={`Variación de ${metric.label.toLocaleLowerCase('es')} frente al período de comparación.`}
              scroll
            >
              <MovementsList
                result={movementsResult}
                metric={metric}
                currency={config.currency}
                selected={state.isEmitter('movimientos') ? state.selected : []}
                selectable={selectable}
                onSelect={(name, additive) => state.select('movimientos', name, additive)}
              />
            </Panel>
          )}

          <Panel
            // La primera en bajar cuando la fila se aprieta: es la que más
            // ancho pide y la que mejor lo aprovecha a lo ancho de la sección.
            className={cn(
              hasMovements && 'order-2 lg:order-3 lg:col-span-2 3xl:col-span-1',
            )}
            title={`Detalle por ${dimensionHeader}`}
            description="Las mismas cifras del gráfico, exactas y exportables."
          >
            <DetailTable
              result={tableResult}
              metric={metric}
              currency={config.currency}
              dimensionHeader={dimensionHeader}
              selected={state.isEmitter('tabla') ? state.selected : []}
              selectable={selectable}
              fileName={baseName}
              onSelect={(name, additive) => state.select('tabla', name, additive)}
            />
          </Panel>
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta de widget. Siempre ocupa el alto de su fila de la rejilla y le pasa
 * el sobrante al contenido, que es quien decide si lo usa (el gráfico) o lo
 * recorta con scroll (la tabla y las listas). Cuando la fila la dimensiona el
 * contenido —una sola columna apilada— «el alto de la fila» es el alto natural
 * y la tarjeta se comporta como cualquier otra.
 */
function Panel({
  className,
  title,
  description,
  action,
  scroll = false,
  children,
}: {
  className?: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  /** El propio panel hace de contenedor con scroll, sin altura interna. */
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className={cn('h-full min-h-0 min-w-0', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-xs text-pretty">{description}</CardDescription>
        {action !== undefined && action !== false && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          scroll && 'overflow-y-auto overscroll-contain',
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function granoName(grano: string): string {
  switch (grano) {
    case 'dia':
      return 'días';
    case 'semana':
      return 'semanas';
    case 'trimestre':
      return 'trimestres';
    case 'anio':
      return 'años';
    default:
      return 'meses';
  }
}
