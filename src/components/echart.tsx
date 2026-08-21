import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { useResolvedTheme } from '@/lib/use-resolved-theme';

/**
 * ECharts pesa ~1 MB: se carga bajo demanda, igual que SheetJS. Solo se
 * registran los tipos de gráfico que las herramientas usan —las barras de la
 * tabla de detalle y el mapa de calor de la tabla dinámica son CSS, no
 * lienzo— y el tema oscuro se registra como efecto lateral de su módulo.
 */
let echartsModule: Promise<typeof import('echarts/core')> | null = null;

function loadECharts(): Promise<typeof import('echarts/core')> {
  echartsModule ??= Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
    import('echarts/theme/dark.js'),
  ]).then(([echarts, charts, components, renderers]) => {
    echarts.use([
      charts.BarChart,
      charts.LineChart,
      charts.PieChart,
      charts.ScatterChart,
      charts.HeatmapChart,
      charts.BoxplotChart,
      charts.TreemapChart,
      charts.FunnelChart,
      charts.CustomChart,
      charts.EffectScatterChart,
      components.AriaComponent,
      components.GridComponent,
      components.LegendComponent,
      components.TooltipComponent,
      components.VisualMapComponent,
      components.CalendarComponent,
      components.MarkLineComponent,
      components.MarkPointComponent,
      components.MarkAreaComponent,
      components.DataZoomComponent,
      components.TitleComponent,
      renderers.CanvasRenderer,
    ]);
    return echarts;
  });

  return echartsModule;
}

export interface EChartHandle {
  /** PNG del lienzo a doble resolución, para exportar; `null` si aún carga. */
  toPngDataUrl: () => string | null;
}

export interface EChartSelection {
  /** Nombre de la serie pulsada, o de la entrada de leyenda. */
  name: string;
  /**
   * Categoría del punto pulsado (el valor del eje X, o la porción del
   * circular). `null` cuando el gesto viene de la leyenda, que nombra series
   * y no categorías.
   */
  category: string | null;
  /** Ctrl/Cmd pulsado: la selección se acumula en vez de sustituirse. */
  additive: boolean;
}

interface EChartProps {
  option: EChartsCoreOption;
  /** Descripción accesible («Evolución de la suma de importe por zona»). */
  ariaLabel: string;
  className?: string;
  /** Clic sobre un punto o una línea: alimenta el filtrado cruzado. */
  onSelect?: (selection: EChartSelection) => void;
}

interface ClickParams {
  seriesName?: string;
  name?: string;
  event?: { event?: { ctrlKey?: boolean; metaKey?: boolean } };
}

interface LegendParams {
  name?: string;
  selected?: Record<string, boolean>;
}

/**
 * Envoltorio mínimo de React sobre ECharts: crea la instancia con el tema
 * resuelto, la redimensiona con el contenedor y actualiza la opción.
 */
export const EChart = forwardRef<EChartHandle, EChartProps>(function EChart(
  { option, ariaLabel, className, onSelect },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  // Si el tema cambia mientras el módulo carga, la instancia nueva debe
  // recibir la opción vigente, no la que había al dispararse el efecto.
  const optionRef = useRef(option);
  optionRef.current = option;
  // Los manejadores se leen por referencia: registrarlos como dependencia
  // recrearía el gráfico entero en cada render del padre.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const theme = useResolvedTheme();

  // El tema de ECharts se decide al crear la instancia: hay que recrearla.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void loadECharts().then((echarts) => {
      if (cancelled || !containerRef.current) return;

      const chart = echarts.init(
        containerRef.current,
        theme === 'dark' ? 'dark' : undefined,
      );
      chart.setOption(optionRef.current, { notMerge: true });
      chartRef.current = chart;

      chart.on('click', (params) => {
        const { seriesName, name, event } = params as ClickParams;
        if (seriesName === undefined) return;
        onSelectRef.current?.({
          name: seriesName,
          category: name ?? null,
          additive: event?.event?.ctrlKey === true || event?.event?.metaKey === true,
        });
      });

      // La leyenda aquí no oculta series, selecciona: es el mismo gesto que
      // pulsar la línea. Se restaura la visibilidad para que no desaparezca.
      chart.on('legendselectchanged', (params) => {
        const { name, selected } = params as LegendParams;
        if (name === undefined) return;

        if (selected !== undefined) {
          chart.setOption({
            legend: {
              selected: Object.fromEntries(Object.keys(selected).map((key) => [key, true])),
            },
          });
        }

        onSelectRef.current?.({ name, category: null, additive: false });
      });

      observer = new ResizeObserver(() => chart.resize());
      observer.observe(containerRef.current);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  useImperativeHandle(
    ref,
    () => ({
      toPngDataUrl: () =>
        chartRef.current?.getDataURL({
          type: 'png',
          pixelRatio: 2,
          // El fondo del tema 'dark' de ECharts es opaco y propio; usamos el
          // fondo real de la página para que el PNG no desentone.
          backgroundColor: getComputedStyle(document.body).backgroundColor,
        }) ?? null,
    }),
    // Sin dependencias: se lee en el momento de la llamada.
    [],
  );

  return <div ref={containerRef} role="img" aria-label={ariaLabel} className={className} />;
});
