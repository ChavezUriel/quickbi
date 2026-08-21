import { describe, expect, it } from 'vitest';
import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';
import { computeRfm, quintileScores, segmentOf } from './rfm';

function row(
  cliente: string,
  day: string | null,
  importe: number | null,
  pedido = '',
): AnalysisRow {
  return { day, dims: { cliente, pedido }, values: { importe } };
}

describe('quintileScores', () => {
  it('reparte del 1 al 5 con más es mejor', () => {
    const scores = quintileScores([1, 2, 3, 4, 5], true);
    expect(scores).toEqual([1, 2, 3, 4, 5]);
  });

  it('invierte la escala cuando menos es mejor', () => {
    const scores = quintileScores([1, 2, 3, 4, 5], false);
    expect(scores).toEqual([5, 4, 3, 2, 1]);
  });

  it('da la misma nota a los empatados', () => {
    const scores = quintileScores([7, 7, 7, 7], true);
    expect(new Set(scores).size).toBe(1);
  });

  it('no se sale del rango con un único valor', () => {
    expect(quintileScores([42], true)).toEqual([3]);
  });

  it('devuelve una lista vacía sin valores', () => {
    expect(quintileScores([], true)).toEqual([]);
  });
});

describe('segmentOf', () => {
  it('cubre las 25 combinaciones', () => {
    for (let r = 1; r <= 5; r += 1) {
      for (let f = 1; f <= 5; f += 1) {
        expect(segmentOf(r, f)).toBeTruthy();
      }
    }
  });

  it('reconoce a los campeones y a los perdidos', () => {
    expect(segmentOf(5, 5)).toBe('campeones');
    expect(segmentOf(1, 1)).toBe('perdidos');
    expect(segmentOf(1, 5)).toBe('no_perder');
    expect(segmentOf(5, 1)).toBe('prometedores');
  });
});

describe('computeRfm', () => {
  const rows: AnalysisRow[] = [
    row('Ana', '2026-01-10', 100, 'P1'),
    row('Ana', '2026-03-01', 200, 'P2'),
    row('Luis', '2026-02-01', 50, 'P3'),
    row('Marta', '2025-01-01', 10, 'P4'),
  ];

  const params = {
    customerDim: 'cliente',
    amountColumn: 'importe',
    orderDim: 'pedido',
    referenceDay: '2026-03-01',
  };

  it('agrega importe, frecuencia y recencia por cliente', () => {
    const result = computeRfm(rows, params);
    const ana = result.customers.find((customer) => customer.id === 'Ana');

    expect(ana?.monetary).toBe(300);
    expect(ana?.frequency).toBe(2);
    expect(ana?.recencyDays).toBe(0);
  });

  it('usa el último día del dataset como referencia si no se da ninguno', () => {
    const result = computeRfm(rows, { ...params, referenceDay: null });
    expect(result.referenceDay).toBe('2026-03-01');
  });

  it('cuenta días con compra cuando no hay columna de pedido', () => {
    const sameDay: AnalysisRow[] = [
      row('Ana', '2026-01-10', 100),
      row('Ana', '2026-01-10', 100),
    ];
    const result = computeRfm(sameDay, { ...params, orderDim: null });

    expect(result.customers[0]?.frequency).toBe(1);
    expect(result.customers[0]?.monetary).toBe(200);
  });

  it('descarta las filas sin cliente, sin fecha o sin importe', () => {
    const dirty: AnalysisRow[] = [
      ...rows,
      row(EMPTY_LABEL, '2026-01-01', 100, 'P5'),
      row('Sin fecha', null, 100, 'P6'),
      row('Sin importe', '2026-01-01', null, 'P7'),
    ];
    const result = computeRfm(dirty, params);

    expect(result.ignoredRows).toBe(3);
    expect(result.customers.map((customer) => customer.id)).not.toContain(EMPTY_LABEL);
  });

  it('ordena la cartera por importe descendente', () => {
    const result = computeRfm(rows, params);
    expect(result.customers.map((customer) => customer.id)).toEqual([
      'Ana',
      'Luis',
      'Marta',
    ]);
  });

  it('reparte a todos los clientes en la rejilla', () => {
    const result = computeRfm(rows, params);
    const inGrid = result.grid.reduce((sum, cell) => sum + cell.customers, 0);

    expect(result.grid).toHaveLength(25);
    expect(inGrid).toBe(result.customers.length);
  });

  it('reparte todo el importe entre los segmentos', () => {
    const result = computeRfm(rows, params);
    const total = result.segments.reduce((sum, segment) => sum + segment.monetary, 0);

    expect(total).toBeCloseTo(result.totalMonetary);
    expect(result.totalMonetary).toBe(360);
  });

  it('sobrevive a un dataset sin ninguna fila utilizable', () => {
    const result = computeRfm([row(EMPTY_LABEL, null, null)], params);

    expect(result.customers).toEqual([]);
    expect(result.grid).toHaveLength(25);
    expect(result.segments).toHaveLength(8);
  });
});
