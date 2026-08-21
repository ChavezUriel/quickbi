import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { Download, ImageDown, Sparkles, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EChart, type EChartHandle } from '@/components/echart';
import { downloadDataUrl, downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { formatCount } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  computeCorrelationMatrix,
  computePairDetails,
  correlationLabel,
} from '../lib/correlations';
import { correlationMatrixToCsv, pairDetailsToCsv } from '../lib/export-correlations-csv';
import type { CorrelationsConfigState } from '../use-correlations-config';

export function CorrelationsDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: CorrelationsConfigState;
}) {
  const heatmapRef = useRef<EChartHandle>(null);
  const scatterRef = useRef<EChartHandle>(null);

  const [activeX, setActiveX] = useState<string | null>(state.selectedX);
  const [activeY, setActiveY] = useState<string | null>(state.selectedY);

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const measures = state.availableMeasures;

  const matrix = useMemo(() => {
    if (measures.length < 2) return null;
    return computeCorrelationMatrix(prepared.rows, measures);
  }, [prepared.rows, measures]);

  // Fallback active pair
  const currentX = activeX ?? state.selectedX ?? measures[0] ?? '';
  const currentY = activeY ?? state.selectedY ?? measures[1] ?? measures[0] ?? '';

  const pairDetails = useMemo(() => {
    if (!currentX || !currentY) return null;
    return computePairDetails(prepared.rows, currentX, currentY, state.labelDim);
  }, [prepared.rows, currentX, currentY, state.labelDim]);

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  // Heatmap EChart option
  const heatmapOption = useMemo<EChartsCoreOption>(() => {
    if (!matrix) return {};

    const data: [number, number, number | null][] = [];
    for (let i = 0; i < matrix.measures.length; i++) {
      for (let j = 0; j < matrix.measures.length; j++) {
        const cell = matrix.cells[i]?.[j];
        data.push([j, i, cell?.r ?? null]);
      }
    }

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const xName = matrix.measures[params.value[0]];
          const yName = matrix.measures[params.value[1]];
          const val = params.value[2];
          return `<div class="font-sans text-xs">
            <div class="font-semibold">${xName} ⟷ ${yName}</div>
            <div class="mt-1">Coef. Pearson (r): <b>${val !== null ? Number(val).toFixed(3) : 'n/d'}</b></div>
          </div>`;
        },
      },
      grid: {
        top: 30,
        bottom: 60,
        left: 100,
        right: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: matrix.measures,
        splitArea: { show: true },
        axisLabel: {
          rotate: 30,
          interval: 0,
          fontSize: 11,
          overflow: 'truncate',
          width: 80,
        },
      },
      yAxis: {
        type: 'category',
        data: matrix.measures,
        splitArea: { show: true },
        axisLabel: {
          fontSize: 11,
          overflow: 'truncate',
          width: 80,
        },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 14,
        itemHeight: 120,
        text: ['+1.0', '-1.0'],
        inRange: {
          color: ['#ef4444', '#f8fafc', '#3b82f6'],
        },
      },
      series: [
        {
          name: 'Correlación',
          type: 'heatmap',
          data,
          label: {
            show: matrix.measures.length <= 8,
            formatter: (p: any) => (p.value[2] !== null ? Number(p.value[2]).toFixed(2) : '·'),
            fontSize: 11,
            color: '#0f172a',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }, [matrix]);

  // Scatter & Regression EChart option
  const scatterOption = useMemo<EChartsCoreOption>(() => {
    if (!pairDetails || pairDetails.points.length === 0) return {};

    const pointsData = pairDetails.points.map((p) => [p.x, p.y, p.label]);

    let markLineData: any[] = [];
    if (pairDetails.regression && pairDetails.points.length >= 2) {
      const minX = Math.min(...pairDetails.points.map((p) => p.x));
      const maxX = Math.max(...pairDetails.points.map((p) => p.x));
      const startY = pairDetails.regression.slope * minX + pairDetails.regression.intercept;
      const endY = pairDetails.regression.slope * maxX + pairDetails.regression.intercept;

      markLineData = [
        [
          { coord: [minX, startY], symbol: 'none' },
          {
            coord: [maxX, endY],
            symbol: 'none',
            lineStyle: { color: '#ef4444', width: 2, type: 'dashed' },
            label: {
              show: true,
              formatter: pairDetails.regression.equation,
              position: 'insideEndTop',
              color: '#ef4444',
            },
          },
        ],
      ];
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const pt = params.value;
          return `<div class="font-sans text-xs">
            <div class="font-semibold">${pt[2] ?? 'Punto'}</div>
            <div>${currentX}: <b>${Number(pt[0]).toLocaleString('es-MX')}</b></div>
            <div>${currentY}: <b>${Number(pt[1]).toLocaleString('es-MX')}</b></div>
          </div>`;
        },
      },
      grid: {
        top: 30,
        bottom: 50,
        left: 60,
        right: 30,
        containLabel: true,
      },
      xAxis: {
        name: currentX,
        nameLocation: 'middle',
        nameGap: 30,
        type: 'value',
        scale: true,
      },
      yAxis: {
        name: currentY,
        type: 'value',
        scale: true,
      },
      series: [
        {
          type: 'scatter',
          data: pointsData,
          symbolSize: 8,
          itemStyle: {
            color: '#3b82f6',
            opacity: 0.75,
          },
          markLine: {
            silent: true,
            animation: false,
            data: markLineData,
          },
        },
      ],
    };
  }, [pairDetails, currentX, currentY]);

  if (!matrix || measures.length < 2) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Métricas insuficientes</AlertTitle>
        <AlertDescription>
          Se necesitan al menos dos columnas numéricas mapeadas para calcular la matriz de
          correlaciones.
        </AlertDescription>
      </Alert>
    );
  }

  const topPos = matrix.topPositive[0];
  const topNeg = matrix.topNegative[0];

  return (
    <div className="space-y-3">
      {/* Top KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Variables analizadas"
          value={`${formatCount(measures.length)} métricas`}
          hint={`${formatCount(matrix.pairs.length)} parejas únicas calculadas`}
        />
        <Tile
          label="Mayor correlación directa (+)"
          value={topPos ? `r = +${topPos.r.toFixed(2)}` : 'Ninguna'}
          hint={topPos ? `${topPos.xMeasure} ⟷ ${topPos.yMeasure}` : undefined}
          badge={topPos ? 'Directa' : undefined}
          badgeVariant="positive"
        />
        <Tile
          label="Mayor correlación inversa (-)"
          value={topNeg ? `r = ${topNeg.r.toFixed(2)}` : 'Ninguna'}
          hint={topNeg ? `${topNeg.xMeasure} ⟷ ${topNeg.yMeasure}` : undefined}
          badge={topNeg ? 'Inversa' : undefined}
          badgeVariant="negative"
        />
        <Tile
          label="Pareja seleccionada"
          value={pairDetails?.r !== null && pairDetails?.r !== undefined ? `r = ${pairDetails.r.toFixed(2)}` : 'n/d'}
          hint={
            pairDetails?.regression
              ? `R² = ${(pairDetails.regression.r2 * 100).toFixed(1)}% de varianza explicada`
              : `${currentX} vs ${currentY}`
          }
        />
      </div>

      {/* Main Charts: Heatmap Matrix + Scatter Plot */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Matriz de correlación (Heatmap)</CardTitle>
            <CardDescription className="text-xs">
              Valores cercanos a +1 (azul) indican relación directa; valores cercanos a -1 (rojo)
              indican relación inversa. Pulsa en la tabla inferior para cambiar el par.
            </CardDescription>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const url = heatmapRef.current?.toPngDataUrl();
                  if (url) downloadDataUrl(`${baseName}-matriz-correlaciones.png`, url);
                }}
              >
                <ImageDown className="size-3.5" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 ml-1"
                onClick={() =>
                  downloadTextFile(
                    `${baseName}-matriz-correlaciones.csv`,
                    correlationMatrixToCsv(matrix),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                <Download className="size-3.5" />
                CSV
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <EChart
              ref={heatmapRef}
              option={heatmapOption}
              ariaLabel="Matriz de correlación"
              className="h-80 w-full"
            />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>
              Dispersión y regresión: {currentX} vs {currentY}
            </CardTitle>
            <CardDescription className="text-xs">
              {correlationLabel(pairDetails?.r ?? null)}
              {pairDetails?.regression && ` · ${pairDetails.regression.equation}`}
            </CardDescription>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={!pairDetails}
                onClick={() => {
                  const url = scatterRef.current?.toPngDataUrl();
                  if (url) downloadDataUrl(`${baseName}-dispersion-${currentX}-${currentY}.png`, url);
                }}
              >
                <ImageDown className="size-3.5" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 ml-1"
                disabled={!pairDetails}
                onClick={() => {
                  if (pairDetails) {
                    downloadTextFile(
                      `${baseName}-dispersion-${currentX}-${currentY}.csv`,
                      pairDetailsToCsv(pairDetails),
                      'text/csv;charset=utf-8',
                    );
                  }
                }}
              >
                <Download className="size-3.5" />
                CSV
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <EChart
              ref={scatterRef}
              option={scatterOption}
              ariaLabel={`Diagrama de dispersión entre ${currentX} y ${currentY}`}
              className="h-80 w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Regression & Statistics Detail */}
      {pairDetails?.regression && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" />
              Detalle estadístico de la relación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="rounded-md border p-2.5">
                <span className="text-muted-foreground block">Ecuación de la recta</span>
                <span className="text-sm font-semibold font-mono">{pairDetails.regression.equation}</span>
              </div>
              <div className="rounded-md border p-2.5">
                <span className="text-muted-foreground block">Bondad de ajuste (R²)</span>
                <span className="text-sm font-semibold tabular-nums">
                  {(pairDetails.regression.r2 * 100).toFixed(2)} %
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  de la variación de {currentY} se explica por {currentX}
                </span>
              </div>
              <div className="rounded-md border p-2.5">
                <span className="text-muted-foreground block">Pendiente (m) / Intersección (b)</span>
                <span className="text-sm font-semibold tabular-nums">
                  m = {pairDetails.regression.slope.toFixed(3)} · b = {pairDetails.regression.intercept.toFixed(2)}
                </span>
              </div>
              <div className="rounded-md border p-2.5">
                <span className="text-muted-foreground block">Muestra / Desviaciones</span>
                <span className="text-sm font-semibold tabular-nums">
                  N = {formatCount(pairDetails.count)} · σX = {pairDetails.regression.xStd.toFixed(2)} · σY = {pairDetails.regression.yStd.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranked Correlation Pairs Table */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Todas las parejas de variables</CardTitle>
          <CardDescription className="text-xs">
            Ordenadas por magnitud de correlación (|r|). Haz clic en una fila para examinarla en el gráfico de dispersión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Variable X</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Variable Y</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Coeficiente r</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">R²</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Fuerza</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {matrix.pairs.map((pair) => {
                  const isSelected =
                    (pair.xMeasure === currentX && pair.yMeasure === currentY) ||
                    (pair.xMeasure === currentY && pair.yMeasure === currentX);

                  return (
                    <tr
                      key={`${pair.xMeasure}-${pair.yMeasure}`}
                      className={cn(
                        'border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors',
                        isSelected && 'bg-primary/5 font-medium',
                      )}
                      onClick={() => {
                        setActiveX(pair.xMeasure);
                        setActiveY(pair.yMeasure);
                      }}
                    >
                      <td className="px-3 py-1.5">{pair.xMeasure}</td>
                      <td className="px-3 py-1.5">{pair.yMeasure}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {pair.r >= 0 ? `+${pair.r.toFixed(3)}` : pair.r.toFixed(3)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {(pair.r * pair.r * 100).toFixed(1)} %
                      </td>
                      <td className="px-3 py-1.5">
                        <PairStrengthBadge r={pair.r} />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveX(pair.xMeasure);
                            setActiveY(pair.yMeasure);
                          }}
                        >
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PairStrengthBadge({ r }: { r: number }) {
  const abs = Math.abs(r);
  if (abs >= 0.8) {
    return (
      <Badge variant="outline" className={r > 0 ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200'}>
        {r > 0 ? 'Muy fuerte (+)' : 'Muy fuerte (-)'}
      </Badge>
    );
  }
  if (abs >= 0.6) {
    return (
      <Badge variant="outline" className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200">
        {r > 0 ? 'Fuerte (+)' : 'Fuerte (-)'}
      </Badge>
    );
  }
  if (abs >= 0.4) {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200">
        Moderada
      </Badge>
    );
  }
  if (abs >= 0.2) {
    return (
      <Badge variant="outline" className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-200">
        Débil
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground border-transparent">
      Nula
    </Badge>
  );
}

function Tile({
  label,
  value,
  hint,
  badge,
  badgeVariant,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeVariant?: 'positive' | 'negative';
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0 h-4',
              badgeVariant === 'positive' && 'bg-blue-500/10 text-blue-600 border-blue-200',
              badgeVariant === 'negative' && 'bg-rose-500/10 text-rose-600 border-rose-200',
            )}
          >
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-lg font-semibold tabular-nums mt-0.5">{value}</p>
      {hint !== undefined && <p className="text-xs text-pretty text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
