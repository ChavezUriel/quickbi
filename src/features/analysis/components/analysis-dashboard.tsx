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
 * A partir de `xl` la sección deja de ser un documento y pasa a ser un cuadro
 * de mando de verdad: barra de control arriba, los tres paneles en una sola
 * fila que se reparte la altura que queda de ventana, y el scroll dentro de
 * cada panel. Un cuadro de mando que hay que scrollear no es un cuadro de
 * mando: filtrar por una categoría y no ver a la vez qué le pasa al total, a la
 * evolución y al detalle es perder justamente lo que hace útil el gesto.
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

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
      {/* Barra de control: sin cabecera de tarjeta. El título lo dice ya el
          indicador de pasos y la instrucción, la barra inferior; repetirlos
          costaba 70 px permanentes de la única pantalla que hay. */}
      <Card size="sm" className="shrink-0">
        <CardContent className="space-y-2">
          {/* Donde sí hay scroll, la pista de uso sigue mereciendo su sitio. */}
          <CardDescription className="text-pretty xl:hidden">
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
            dimensions={config.dimensions}
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
        // Los tres paneles en una fila: el gráfico y el detalle se llevan el
        // ancho —uno necesita área de trazado, el otro cinco columnas de
        // cifras— y los movimientos, que son dos listas cortas, el resto.
        <div
          className={cn(
            'grid min-h-0 gap-3 xl:flex-1',
            // El reparto sale de lo que cada panel necesita, no de partes
            // iguales: el detalle pide sitio para sus cinco columnas, el
            // gráfico para su eje de tiempo, y los movimientos son dos listas
            // de «nombre · cifra · variación» que con 400 px van sobradas.
            hasMovements
              ? 'xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.72fr)_minmax(0,1.33fr)]'
              : 'xl:grid-cols-2',
          )}
        >
          <div className="min-w-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-3">
            <SummaryHeader
              result={state.result}
              metric={metric}
              currency={config.currency}
              dimension={dimensionHeader}
              isTotal={state.dim === TOTAL_DIM}
            />

            <Panel
            className="xl:flex-1"
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
            <Panel
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
 * Tarjeta de widget. Fuera de `xl` es una tarjeta normal que crece con su
 * contenido; a partir de ahí se estira hasta el alto de la fila y le pasa el
 * sobrante al contenido, que es quien decide si lo usa (el gráfico) o lo
 * recorta con scroll (la tabla y las listas).
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
    <Card size="sm" className={cn('min-w-0 xl:h-full xl:min-h-0', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-xs text-pretty">{description}</CardDescription>
        {action !== undefined && action !== false && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent
        className={cn(
          'flex min-h-0 flex-col xl:flex-1',
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
