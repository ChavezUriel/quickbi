import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { EChart, type EChartHandle } from '@/components/echart';
import { downloadDataUrl } from '@/lib/download';
import { OTHERS_LABEL } from '../lib/explore';
import { buildSerieOption } from '../lib/serie-option';
import type { Currency, ExplorationSerie, MetricDef } from '../types';

interface SeriesChartProps {
  serie: ExplorationSerie;
  metric: MetricDef;
  currency: Currency;
  /** Series resaltadas; vacío = sin selección. */
  highlighted: readonly string[];
  title: string;
  fileName: string;
  onSelect: (name: string, additive: boolean) => void;
}

export interface SeriesChartHandle {
  /** Descarga el lienzo actual como PNG. */
  exportPng: () => void;
}

/**
 * Evolución temporal de la métrica. Pulsar una línea o su entrada de leyenda
 * filtra la sección entera por esa categoría.
 *
 * La exportación se expone hacia arriba en vez de dibujar aquí su botón: su
 * sitio es la esquina de la cabecera de la tarjeta, junto al título, no una
 * fila propia por encima del gráfico.
 */
export const SeriesChart = forwardRef<SeriesChartHandle, SeriesChartProps>(
  function SeriesChart(
    { serie, metric, currency, highlighted, title, fileName, onSelect },
    ref,
  ) {
    const chartRef = useRef<EChartHandle>(null);

    const option = useMemo(
      () =>
        buildSerieOption({
          serie,
          metric,
          currency,
          highlighted,
          ariaDescription: title,
          // La leyenda va debajo para que el gráfico use todo el ancho
          // disponible en el cuadro de mando.
          layout: 'compact',
        }),
      [serie, metric, currency, highlighted, title],
    );

    useImperativeHandle(ref, () => ({
      exportPng: () => {
        const dataUrl = chartRef.current?.toPngDataUrl();
        if (dataUrl !== null && dataUrl !== undefined) {
          downloadDataUrl(`${fileName}-evolucion.png`, dataUrl);
        }
      },
    }));

    return (
      <EChart
        ref={chartRef}
        option={option}
        ariaLabel={title}
        // Altura propia mientras la página scrollea; a partir de `xl` la pone
        // el panel, que ya se ha repartido lo que quedaba de ventana. ECharts
        // se entera por el ResizeObserver del envoltorio.
        className="h-64 w-full sm:h-80 xl:h-full xl:min-h-0 xl:flex-1"
        onSelect={({ name, additive }) => {
          // «Otros» y el período de comparación no son categorías del dataset:
          // filtrar por ellos no querría decir nada.
          if (name === OTHERS_LABEL || name === serie.previous?.name) return;
          onSelect(name, additive);
        }}
      />
    );
  },
);
