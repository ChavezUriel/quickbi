import { describe, expect, it } from 'vitest';
import { computeExploration, OTHERS_LABEL, resolveWindows, TOTAL_LABEL } from './explore';
import { EMPTY_FILTERS, lastPeriods, setDateCondition, setSelected } from './filters';
import { columnMetric } from './metrics';
import { TOTAL_DIM, type AnalysisRow, type DateWindow } from '../types';

const importe = columnMetric('importe', 'sum', 'moneda');
const media = columnMetric('importe', 'avg', 'numero');

function row(day: string | null, zona: string, importeValue: number | null): AnalysisRow {
  return { day, dims: { zona }, values: { importe: importeValue } };
}

const WINDOW: DateWindow = { desde: '2026-07-01', hasta: '2026-07-31' };
const PREVIOUS: DateWindow = { desde: '2026-06-01', hasta: '2026-06-30' };

const BASE = {
  dim: 'zona',
  metric: importe,
  filters: EMPTY_FILTERS,
  window: WINDOW,
  previousWindow: PREVIOUS,
  grano: 'mes' as const,
};

describe('resolveWindows', () => {
  const bounds: DateWindow = { desde: '2024-01-05', hasta: '2026-08-07' };

  it('ancla los últimos N meses al último día del dataset, no a hoy', () => {
    const filters = setDateCondition(EMPTY_FILTERS, lastPeriods('fecha', 3, 'mes'));

    expect(resolveWindows(filters, bounds, 'ninguna').current).toEqual({
      desde: '2026-06-01',
      hasta: '2026-08-07',
    });
  });

  it('sin condición temporal abarca todo el histórico', () => {
    expect(resolveWindows(EMPTY_FILTERS, bounds, 'ninguna').current).toEqual(bounds);
  });

  it('desplaza la comparación en las unidades del preset', () => {
    const filters = setDateCondition(EMPTY_FILTERS, lastPeriods('fecha', 3, 'mes'));

    expect(resolveWindows(filters, bounds, 'anterior').previous).toEqual({
      desde: '2026-03-01',
      hasta: '2026-05-07',
    });
  });

  it('con rango explícito compara contra la duración inmediatamente anterior', () => {
    const filters = setDateCondition(EMPTY_FILTERS, {
      op: 'entre_fechas',
      column: 'fecha',
      desde: '2026-08-01',
      hasta: '2026-08-10',
    });

    expect(resolveWindows(filters, bounds, 'anterior').previous).toEqual({
      desde: '2026-07-22',
      hasta: '2026-07-31',
    });
  });

  it('sin comparación no devuelve ventana previa', () => {
    expect(resolveWindows(EMPTY_FILTERS, bounds, 'ninguna').previous).toBeNull();
  });
});

describe('computeExploration', () => {
  const rows: AnalysisRow[] = [
    row('2026-07-05', 'Norte', 100),
    row('2026-07-20', 'Norte', 50),
    row('2026-07-10', 'Sur', 60),
    row('2026-06-15', 'Norte', 200), // período anterior
    row('2026-06-16', 'Sur', 30),
    row('2026-06-17', 'Este', 40), // desaparece en el período actual
    row('2026-05-01', 'Norte', 999), // fuera de ambas ventanas
  ];

  it('agrupa, calcula participación y compara contra el período previo', () => {
    const result = computeExploration(rows, BASE);

    expect(result.items.map((item) => item.name)).toEqual(['Norte', 'Sur']);

    const norte = result.items[0];
    expect(norte?.value).toBe(150);
    expect(norte?.previousValue).toBe(200);
    expect(norte?.deltaPct).toBeCloseTo(-25);
    expect(norte?.sharePct).toBeCloseTo((150 / 210) * 100);

    expect(result.total).toBe(210);
    expect(result.previousTotal).toBe(270);
  });

  it('ordena subidas y caídas por variación, y lista lo desaparecido aparte', () => {
    const result = computeExploration(rows, BASE);

    expect(result.subidas.map((item) => item.name)).toEqual(['Sur']);
    expect(result.caidas.map((item) => item.name)).toEqual(['Norte']);
    expect(result.desaparecidos).toEqual([{ name: 'Este', previousValue: 40 }]);
  });

  it('deja el delta en null cuando no hay base de comparación', () => {
    const result = computeExploration([row('2026-07-05', 'Nueva', 10)], BASE);

    expect(result.items[0]?.previousValue).toBe(0);
    expect(result.items[0]?.deltaPct).toBeNull();
  });

  it('no calcula participación en métricas no acumulativas', () => {
    const result = computeExploration(rows, { ...BASE, metric: media });

    expect(result.items[0]?.sharePct).toBeNull();
    // Media de Norte en julio: (100 + 50) / 2.
    expect(result.items.find((item) => item.name === 'Norte')?.value).toBe(75);
    // Media global, no media de medias.
    expect(result.total).toBe(210 / 3);
  });

  it('aplica los filtros de dimensión antes de agregar', () => {
    const filters = setSelected(EMPTY_FILTERS, 'zona', ['Sur']);
    const result = computeExploration(rows, { ...BASE, filters });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(60);
  });

  it('agrupa en una sola categoría sin dimensión', () => {
    const result = computeExploration(rows, { ...BASE, dim: TOTAL_DIM });

    expect(result.items).toEqual([
      expect.objectContaining({ name: TOTAL_LABEL, value: 210, sharePct: 100 }),
    ]);
  });

  it('cuenta las filas sin fecha en vez de descartarlas en silencio', () => {
    const result = computeExploration([...rows, row(null, 'Norte', 5)], BASE);

    expect(result.rowsWithoutDate).toBe(1);
    expect(result.rowsMatched).toBe(3);
  });
});

describe('serie temporal', () => {
  const daily: AnalysisRow[] = [
    row('2026-07-01', 'Norte', 10),
    row('2026-07-03', 'Norte', 5),
    row('2026-07-03', 'Sur', 7),
  ];

  const params = {
    ...BASE,
    window: { desde: '2026-07-01', hasta: '2026-07-03' },
    previousWindow: null,
    grano: 'dia' as const,
  };

  it('genera un cubo por período, también los vacíos', () => {
    const result = computeExploration(daily, params);

    expect(result.serie?.periods).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(result.serie?.series.find((serie) => serie.name === 'Norte')?.values).toEqual([
      10, 0, 5,
    ]);
  });

  it('deja hueco en los períodos sin datos de una media', () => {
    const result = computeExploration(daily, { ...params, metric: media });

    expect(result.serie?.series.find((serie) => serie.name === 'Norte')?.values).toEqual([
      10,
      null,
      5,
    ]);
  });

  it('pliega en «Otros» lo que queda fuera de las diez primeras series', () => {
    const many: AnalysisRow[] = Array.from({ length: 14 }, (_, index) =>
      row('2026-07-01', `Z${String(index).padStart(2, '0')}`, 14 - index),
    );

    const result = computeExploration(many, params);
    const others = result.serie?.series.at(-1);

    expect(result.serie?.series).toHaveLength(11);
    expect(others?.name).toBe(OTHERS_LABEL);
    // Las cuatro series descartadas valen 4 + 3 + 2 + 1.
    expect(others?.values[0]).toBe(10);
  });

  it('superpone el período anterior cuando solo hay una serie', () => {
    const result = computeExploration(
      [...daily, row('2026-06-29', 'Norte', 100)],
      {
        ...params,
        dim: TOTAL_DIM,
        previousWindow: { desde: '2026-06-28', hasta: '2026-06-30' },
      },
    );

    expect(result.serie?.previous?.values).toEqual([0, 100, 0]);
  });
});
