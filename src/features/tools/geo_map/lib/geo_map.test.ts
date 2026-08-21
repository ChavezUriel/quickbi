import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeGeoMap } from './geo_map';

function makeRow(dims: Record<string, string>, values: Record<string, number> = {}): AnalysisRow {
  return {
    dims,
    values,
    day: '2024-01-01',
  };
}

describe('computeGeoMap', () => {
  it('returns empty result when no rows given', () => {
    const res = computeGeoMap([], { territoryDim: 'pais', metricColumn: 'ventas' });
    expect(res.territories).toEqual([]);
    expect(res.summary.totalValue).toBe(0);
    expect(res.summary.territoryCount).toBe(0);
    expect(res.summary.topTerritory).toBeNull();
  });

  it('aggregates sum of metric by territory with normalization and ranking', () => {
    const rows: AnalysisRow[] = [
      makeRow({ pais: 'es' }, { ventas: 100 }),
      makeRow({ pais: 'España' }, { ventas: 200 }),
      makeRow({ pais: 'mx' }, { ventas: 150 }),
      makeRow({ pais: 'Francia' }, { ventas: 50 }),
    ];

    const res = computeGeoMap(rows, {
      territoryDim: 'pais',
      metricColumn: 'ventas',
      aggregation: 'sum',
    });

    // 3 distinct territories: España (300), México (150), Francia (50) -> Total: 500
    expect(res.summary.totalValue).toBe(500);
    expect(res.summary.territoryCount).toBe(3);
    expect(res.summary.topTerritory?.normalizedName).toBe('España');
    expect(res.summary.topTerritory?.value).toBe(300);

    const esp = res.territories.find((t) => t.normalizedName === 'España');
    expect(esp?.value).toBe(300);
    expect(esp?.share).toBe(60);

    expect(res.summary.top3Concentration).toBe(100);
  });

  it('calculates average aggregation and secondary metric', () => {
    const rows: AnalysisRow[] = [
      makeRow({ region: 'Madrid' }, { ventas: 100, margen: 20 }),
      makeRow({ region: 'Madrid' }, { ventas: 300, margen: 60 }),
      makeRow({ region: 'Cataluña' }, { ventas: 200, margen: 40 }),
    ];

    const res = computeGeoMap(rows, {
      territoryDim: 'region',
      metricColumn: 'ventas',
      secondaryColumn: 'margen',
      aggregation: 'avg',
    });

    const madrid = res.territories.find((t) => t.normalizedName === 'Comunidad de Madrid' || t.territory === 'Madrid');
    expect(madrid?.value).toBe(200); // (100+300)/2
    expect(madrid?.secondaryValue).toBe(40); // (20+60)/2
    expect(madrid?.rowCount).toBe(2);
    expect(madrid?.avgPerRecord).toBe(200);
  });

  it('calculates count aggregation and HHI concentration index', () => {
    const rows: AnalysisRow[] = [
      makeRow({ ciudad: 'Madrid' }, { pedidos: 1 }),
      makeRow({ ciudad: 'Madrid' }, { pedidos: 1 }),
      makeRow({ ciudad: 'Madrid' }, { pedidos: 1 }),
      makeRow({ ciudad: 'Barcelona' }, { pedidos: 1 }),
    ];

    const res = computeGeoMap(rows, {
      territoryDim: 'ciudad',
      metricColumn: 'pedidos',
      aggregation: 'count',
    });

    expect(res.territories[0]?.normalizedName).toBe('Comunidad de Madrid');
    expect(res.territories[0]?.value).toBe(3);
    expect(res.territories[0]?.share).toBe(75);
    expect(res.territories[1]?.share).toBe(25);
    // HHI = 75^2 + 25^2 = 5625 + 625 = 6250
    expect(res.summary.herfindahlIndex).toBe(6250);
  });

  it('handles topN filtering correctly', () => {
    const rows: AnalysisRow[] = [
      makeRow({ estado: 'A' }, { val: 50 }),
      makeRow({ estado: 'B' }, { val: 40 }),
      makeRow({ estado: 'C' }, { val: 30 }),
      makeRow({ estado: 'D' }, { val: 20 }),
    ];

    const res = computeGeoMap(rows, {
      territoryDim: 'estado',
      metricColumn: 'val',
      topN: 2,
    });

    expect(res.territories).toHaveLength(2);
    expect(res.territories[0]?.normalizedName).toBe('A');
    expect(res.territories[1]?.normalizedName).toBe('B');
    // Summary maintains global statistics
    expect(res.summary.territoryCount).toBe(4);
    expect(res.summary.totalValue).toBe(140);
  });
});
