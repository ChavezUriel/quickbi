import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { useResolvedTheme } from '@/lib/use-resolved-theme';

/**
 * ECharts pesa ~1 MB: se carga bajo demanda, igual que SheetJS. Solo se
 * importan los tipos de gráfico y componentes que la app usa, y el tema
 * oscuro se registra como efecto lateral de su propio módulo.
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
      components.AriaComponent,
      components.GridComponent,
      components.LegendComponent,
      components.TooltipComponent,
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

interface EChartProps {
  option: EChartsCoreOption;
  /** Descripción accesible («Suma de importe por provincia»). */
  ariaLabel: string;
  className?: string;
}

/**
 * Envoltorio mínimo de React sobre ECharts: crea la instancia con el tema
 * resuelto, la redimensiona con el contenedor y actualiza la opción.
 */
export const EChart = forwardRef<EChartHandle, EChartProps>(function EChart(
  { option, ariaLabel, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  // Si el tema cambia mientras el módulo carga, la instancia nueva debe
  // recibir la opción vigente, no la que había al dispararse el efecto.
  const optionRef = useRef(option);
  optionRef.current = option;
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
