import { describe, expect, it } from 'vitest';
import type { ColumnFormat, ColumnType } from '@/features/dataset/lib/column-types';
import { roleForType, type ColumnProfile } from '@/features/dataset/lib/column-types';
import type { DataRow } from '@/features/dataset/types';
import { OTHERS_LABEL, aggregate, type AggregateSpec } from './aggregate';

function profile(
  name: string,
  type: ColumnType,
  format: ColumnFormat = { kind: 'none' },
): ColumnProfile {
  return {
    name,
    type,
    format,
    role: roleForType(type),
    nullCount: 0,
    invalidCount: 0,
    distinctCount: 0,
    distinctCountExact: true,
    samples: [],
  };
}

const DOT_NUMBER: ColumnFormat = { kind: 'number', decimal: '.' };
const ISO_DATE: ColumnFormat = { kind: 'date', order: 'iso' };

function spec(overrides: Partial<AggregateSpec> = {}): AggregateSpec {
  return {
    dimension: profile('ciudad', 'text'),
    measure: profile('importe', 'number', DOT_NUMBER),
    aggregation: 'sum',
    granularity: 'day',
    sort: 'natural',
    topN: null,
    ...overrides,
  };
}

describe('aggregate: agrupación básica', () => {
  it('suma la medida por categoría respetando el formato de la columna', () => {
    const rows: DataRow[] = [
      { ciudad: 'Madrid', importe: '1,000' }, // separador de miles con punto decimal
      { ciudad: 'Madrid', importe: '2.5' },
      { ciudad: 'Vigo', importe: '10' },
    ];

    const result = aggregate(rows, spec());

    expect(result.rows).toEqual([
      { label: 'Madrid', value: 1002.5, rowCount: 2, isOthers: false },
      { label: 'Vigo', value: 10, rowCount: 1, isOthers: false },
    ]);
    expect(result.excludedCount).toBe(0);
    expect(result.totalRows).toBe(3);
  });

  it('cuenta filas sin necesitar medida', () => {
    const rows: DataRow[] = [{ ciudad: 'A' }, { ciudad: 'A' }, { ciudad: 'B' }];

    const result = aggregate(
      rows,
      spec({ measure: null, aggregation: 'count', sort: 'value-desc' }),
    );

    expect(result.rows).toEqual([
      { label: 'A', value: 2, rowCount: 2, isOthers: false },
      { label: 'B', value: 1, rowCount: 1, isOthers: false },
    ]);
  });

  it('rechaza una agregación con medida ausente en lugar de fallar en silencio', () => {
    expect(() => aggregate([], spec({ measure: null, aggregation: 'sum' }))).toThrow(
      /necesita una medida/,
    );
  });

  it('la media divide solo entre las filas que aportaron valor', () => {
    const rows: DataRow[] = [
      { ciudad: 'A', importe: '10' },
      { ciudad: 'A', importe: '20' },
      { ciudad: 'A', importe: 'N/D' }, // no convertible: ni suma ni cuenta
    ];

    const result = aggregate(rows, spec({ aggregation: 'avg' }));

    expect(result.rows[0]).toMatchObject({ value: 15, rowCount: 2 });
    expect(result.excludedCount).toBe(1);
  });

  it.each([
    ['min', 5],
    ['max', 30],
  ] as const)('calcula el %s por categoría', (aggregation, expected) => {
    const rows: DataRow[] = [
      { ciudad: 'A', importe: '10' },
      { ciudad: 'A', importe: '30' },
      { ciudad: 'A', importe: '5' },
    ];

    const result = aggregate(rows, spec({ aggregation }));

    expect(result.rows[0]?.value).toBe(expected);
  });
});

describe('aggregate: filas excluidas', () => {
  it('cuenta las filas con dimensión vacía o medida no convertible', () => {
    const rows: DataRow[] = [
      { ciudad: 'A', importe: '1' },
      { ciudad: null, importe: '1' }, // sin dimensión
      { ciudad: 'B', importe: 'N/D' }, // medida no convertible
    ];

    const result = aggregate(rows, spec());

    // B no aparece: su única fila no aporta nada y no merece categoría propia.
    expect(result.rows.map((row) => row.label)).toEqual(['A']);
    expect(result.excludedCount).toBe(2);
  });

  it('devuelve un resultado vacío cuando ninguna fila es aprovechable', () => {
    const result = aggregate([{ ciudad: null, importe: 'x' }], spec());

    expect(result.rows).toEqual([]);
    expect(result.excludedCount).toBe(1);
  });
});

describe('aggregate: ordenación', () => {
  const rows: DataRow[] = [
    { ciudad: 'b', importe: '1' },
    { ciudad: 'Álamo', importe: '3' },
    { ciudad: 'abeja', importe: '2' },
  ];

  it('el orden natural del texto es alfabético y sin distinguir mayúsculas', () => {
    const result = aggregate(rows, spec({ sort: 'natural' }));

    expect(result.rows.map((row) => row.label)).toEqual(['abeja', 'Álamo', 'b']);
  });

  it('ordena por valor descendente y ascendente', () => {
    const desc = aggregate(rows, spec({ sort: 'value-desc' }));
    const asc = aggregate(rows, spec({ sort: 'value-asc' }));

    expect(desc.rows.map((row) => row.value)).toEqual([3, 2, 1]);
    expect(asc.rows.map((row) => row.value)).toEqual([1, 2, 3]);
  });
});

describe('aggregate: dimensiones de fecha', () => {
  const rows: DataRow[] = [
    { fecha: '2026-03-10', importe: '1' },
    { fecha: '2026-01-15', importe: '2' },
    { fecha: '2026-01-20', importe: '4' },
  ];

  const dateSpec = (overrides: Partial<AggregateSpec> = {}) =>
    spec({ dimension: profile('fecha', 'date', ISO_DATE), ...overrides });

  it('agrupa por día y ordena cronológicamente con el orden natural', () => {
    const result = aggregate(rows, dateSpec());

    expect(result.rows.map((row) => row.value)).toEqual([2, 4, 1]);
    expect(result.rows[0]?.label).toMatch(/15\/1\/2026/);
  });

  it('agrupa por mes con etiqueta legible', () => {
    const result = aggregate(rows, dateSpec({ granularity: 'month' }));

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.label).toBe('ene 2026');
    expect(result.rows[0]?.value).toBe(6);
    expect(result.rows[1]?.label).toBe('mar 2026');
  });

  it('agrupa por año', () => {
    const result = aggregate(
      [...rows, { fecha: '2025-12-31', importe: '8' }],
      dateSpec({ granularity: 'year' }),
    );

    expect(result.rows.map((row) => [row.label, row.value])).toEqual([
      ['2025', 8],
      ['2026', 7],
    ]);
  });

  it('agrupa por semana', () => {
    const result = aggregate(
      [...rows, { fecha: '2026-01-16', importe: '3' }],
      dateSpec({ granularity: 'week' }),
    );

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]?.label).toMatch(/Semana del 12\/0?1\/2026/);
    expect(result.rows[0]?.value).toBe(5);
    expect(result.rows[1]?.label).toMatch(/Semana del 19\/0?1\/2026/);
    expect(result.rows[1]?.value).toBe(4);
    expect(result.rows[2]?.label).toMatch(/Semana del 0?9\/0?3\/2026/);
    expect(result.rows[2]?.value).toBe(1);
  });

  it('agrupa por trimestre', () => {
    const result = aggregate(
      [
        ...rows,
        { fecha: '2026-05-15', importe: '5' },
        { fecha: '2026-08-20', importe: '10' },
      ],
      dateSpec({ granularity: 'quarter' }),
    );

    expect(result.rows.map((row) => [row.label, row.value])).toEqual([
      ['T1 2026', 7],
      ['T2 2026', 5],
      ['T3 2026', 10],
    ]);
  });

  it('no pliega series temporales en «Otros» aunque superen el top N', () => {
    const result = aggregate(rows, dateSpec({ topN: 1 }));

    expect(result.rows).toHaveLength(3);
    expect(result.rows.some((row) => row.isOthers)).toBe(false);
  });
});

describe('aggregate: dimensiones booleanas', () => {
  it('etiqueta Sí/No y ordena No primero en el orden natural', () => {
    const rows: DataRow[] = [
      { activo: 'sí', importe: '1' },
      { activo: 'no', importe: '2' },
    ];

    const result = aggregate(
      rows,
      spec({ dimension: profile('activo', 'boolean'), sort: 'natural' }),
    );

    expect(result.rows.map((row) => row.label)).toEqual(['No', 'Sí']);
  });
});

describe('aggregate: top N y «Otros»', () => {
  const rows: DataRow[] = [
    { ciudad: 'A', importe: '10' }, // avg 10
    { ciudad: 'B', importe: '20' },
    { ciudad: 'B', importe: '40' }, // avg 30
    { ciudad: 'C', importe: '50' },
    { ciudad: 'C', importe: '70' },
    { ciudad: 'C', importe: '90' }, // avg 70
    { ciudad: 'D', importe: '8' },
  ];

  it('conserva las N categorías mayores y pliega el resto', () => {
    const result = aggregate(rows, spec({ topN: 2, sort: 'value-desc' }));

    expect(result.rows.map((row) => row.label)).toEqual(['C', 'B', OTHERS_LABEL]);
    expect(result.rows[2]).toMatchObject({
      value: 18, // 10 + 8, la suma de A y D
      rowCount: 2, // una fila de A y una de D
      isOthers: true,
    });
  });

  it('la media de «Otros» es la ponderada, no la media de las medias', () => {
    const result = aggregate(rows, spec({ topN: 2, aggregation: 'avg' }));

    // A (10 sobre 1 fila) + D (8 sobre 1 fila): 18 / 2 = 9
    expect(result.rows.find((row) => row.isOthers)?.value).toBe(9);
  });

  it('el mínimo y el máximo de «Otros» son los de sus categorías', () => {
    const min = aggregate(rows, spec({ topN: 2, aggregation: 'min' }));
    const max = aggregate(rows, spec({ topN: 2, aggregation: 'max' }));

    // Por valor quedan fuera A y D; «Otros» hereda su mínimo y su máximo.
    expect(min.rows.find((row) => row.isOthers)?.value).toBe(8);
    expect(max.rows.find((row) => row.isOthers)?.value).toBe(10);
  });

  it('«Otros» queda al final incluso si su valor supera al de las categorías', () => {
    const uniform: DataRow[] = Array.from({ length: 10 }, (_, index) => ({
      ciudad: `C${index}`,
      importe: '10',
    }));

    const result = aggregate(uniform, spec({ topN: 2, sort: 'value-desc' }));

    const others = result.rows.at(-1);
    expect(others?.isOthers).toBe(true);
    expect(others?.value).toBe(80);
  });

  it('no pliega nada si las categorías no superan el top N', () => {
    const result = aggregate(rows, spec({ topN: 10 }));

    expect(result.rows.some((row) => row.isOthers)).toBe(false);
  });
});
