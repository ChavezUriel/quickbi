import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeReconciliation } from './reconciliation';

function makeRow(dims: Record<string, string>, values: Record<string, number> = {}): AnalysisRow {
  return {
    dims,
    values,
    day: '2024-01-01',
  };
}

describe('computeReconciliation', () => {
  it('returns empty summary when rows are empty', () => {
    const res = computeReconciliation([], { keyDim: 'factura', valueAColumn: 'monto' });
    expect(res.records).toEqual([]);
    expect(res.summary.totalKeys).toBe(0);
    expect(res.summary.netDelta).toBe(0);
    expect(res.summary.exactMatchRate).toBe(0);
  });

  it('conciliates records in dual_columns mode correctly', () => {
    const rows: AnalysisRow[] = [
      // Exact match
      makeRow({ factura: 'F-001' }, { sistema_a: 100, sistema_b: 100 }),
      // Discrepancy (A = 250, B = 200 -> delta = +50)
      makeRow({ factura: 'F-002' }, { sistema_a: 250, sistema_b: 200 }),
      // Only in A
      makeRow({ factura: 'F-003' }, { sistema_a: 80 }),
    ];

    const res = computeReconciliation(rows, {
      keyDim: 'factura',
      valueAColumn: 'sistema_a',
      valueBColumn: 'sistema_b',
      tolerance: 0.01,
    });

    expect(res.summary.totalKeys).toBe(3);
    expect(res.summary.totalA).toBe(430);
    expect(res.summary.totalB).toBe(300);
    expect(res.summary.netDelta).toBe(130);
    expect(res.summary.totalDiscrepancy).toBe(130); // 0 + 50 + 80

    const f1 = res.records.find((r) => r.key === 'F-001');
    expect(f1?.status).toBe('exacto');
    expect(f1?.delta).toBe(0);

    const f2 = res.records.find((r) => r.key === 'F-002');
    expect(f2?.status).toBe('discrepancia');
    expect(f2?.delta).toBe(50);
    expect(f2?.deltaPercent).toBe(25);

    const f3 = res.records.find((r) => r.key === 'F-003');
    expect(f3?.status).toBe('solo_a');
    expect(f3?.delta).toBe(80);
  });

  it('conciliates records in source_dimension mode correctly', () => {
    const rows: AnalysisRow[] = [
      makeRow({ id: 'TX-10', fuente: 'Banco' }, { importe: 500 }),
      makeRow({ id: 'TX-10', fuente: 'ERP' }, { importe: 500 }), // Exact match for TX-10

      makeRow({ id: 'TX-20', fuente: 'Banco' }, { importe: 300 }),
      makeRow({ id: 'TX-20', fuente: 'ERP' }, { importe: 350 }), // Discrepancy for TX-20 (delta = -50)

      makeRow({ id: 'TX-30', fuente: 'ERP' }, { importe: 120 }), // Only in B (ERP)
    ];

    const res = computeReconciliation(rows, {
      keyDim: 'id',
      valueAColumn: 'importe',
      sourceDim: 'fuente',
      sourceAValue: 'Banco',
      sourceBValue: 'ERP',
    });

    expect(res.summary.totalKeys).toBe(3);
    expect(res.summary.totalA).toBe(800);
    expect(res.summary.totalB).toBe(970);
    expect(res.summary.netDelta).toBe(-170);

    const tx10 = res.records.find((r) => r.key === 'TX-10');
    expect(tx10?.status).toBe('exacto');

    const tx20 = res.records.find((r) => r.key === 'TX-20');
    expect(tx20?.status).toBe('discrepancia');
    expect(tx20?.delta).toBe(-50);

    const tx30 = res.records.find((r) => r.key === 'TX-30');
    expect(tx30?.status).toBe('solo_b');
    expect(tx30?.valueA).toBe(0);
    expect(tx30?.valueB).toBe(120);
  });

  it('respects tolerance threshold for rounding differences', () => {
    const rows: AnalysisRow[] = [
      makeRow({ ref: 'R1' }, { a: 100.02, b: 100.00 }),
    ];

    // With tolerance 0.05, delta of 0.02 is classified as exacto
    const res = computeReconciliation(rows, {
      keyDim: 'ref',
      valueAColumn: 'a',
      valueBColumn: 'b',
      tolerance: 0.05,
    });

    expect(res.records[0]?.status).toBe('exacto');
  });
});
