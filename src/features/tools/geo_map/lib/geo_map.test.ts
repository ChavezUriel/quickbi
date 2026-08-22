import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeGeoMap, lookupGeo } from './geo_map';

function makeRow(dims: Record<string, string>, values: Record<string, number> = {}): AnalysisRow {
  return {
    dims,
    values,
    day: '2024-01-01',
  };
}

describe('lookupGeo', () => {
  it('normalizes country and region names with and without accents and in different cases', () => {
    expect(lookupGeo('ESPAÑA').normalized).toBe('España');
    expect(lookupGeo('espana').normalized).toBe('España');
    expect(lookupGeo('spain').normalized).toBe('España');
    expect(lookupGeo('es').normalized).toBe('España');
    expect(lookupGeo('MÉXICO').normalized).toBe('México');
    expect(lookupGeo('mexico').normalized).toBe('México');
    expect(lookupGeo('mx').normalized).toBe('México');
    expect(lookupGeo('EEUU').normalized).toBe('Estados Unidos');
    expect(lookupGeo('USA').normalized).toBe('Estados Unidos');
    expect(lookupGeo('Bogotá').normalized).toBe('Bogotá');
    expect(lookupGeo('bogota').normalized).toBe('Bogotá');
    expect(lookupGeo('panamá').normalized).toBe('Panamá');
    expect(lookupGeo('panama').normalized).toBe('Panamá');
    expect(lookupGeo('alemania').normalized).toBe('Alemania');
    expect(lookupGeo('germany').normalized).toBe('Alemania');
    expect(lookupGeo('japon').normalized).toBe('Japón');
  });

  it('assigns proper zones to recognized territories and falls back to general for unknown', () => {
    expect(lookupGeo('España').zone).toBe('España');
    expect(lookupGeo('Madrid').zone).toBe('España (Centro)');
    expect(lookupGeo('Cataluña').zone).toBe('España (Noreste)');
    expect(lookupGeo('México').zone).toBe('América Latina');
    expect(lookupGeo('Francia').zone).toBe('Europa');
    expect(lookupGeo('Estados Unidos').zone).toBe('Norteamérica');
    expect(lookupGeo('Japón').zone).toBe('Asia-Pacífico');

    // Unknown category/territory
    const unknown = lookupGeo('sucursal norte central');
    expect(unknown.normalized).toBe('Sucursal Norte Central');
    expect(unknown.zone).toBe('Territorio general');
  });
});

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
      makeRow({ pais: 'espana' }, { ventas: 50 }),
      makeRow({ pais: 'mx' }, { ventas: 150 }),
      makeRow({ pais: 'Francia' }, { ventas: 50 }),
    ];

    const res = computeGeoMap(rows, {
      territoryDim: 'pais',
      metricColumn: 'ventas',
      aggregation: 'sum',
    });

    // 3 distinct territories: España (350), México (150), Francia (50) -> Total: 550
    expect(res.summary.totalValue).toBe(550);
    expect(res.summary.territoryCount).toBe(3);
    expect(res.summary.topTerritory?.normalizedName).toBe('España');
    expect(res.summary.topTerritory?.value).toBe(350);

    const esp = res.territories.find((t) => t.normalizedName === 'España');
    expect(esp?.value).toBe(350);
    expect(esp?.share).toBe(63.64);

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

  it('calculates count aggregation and HHI concentration index even without metricColumn', () => {
    const rows: AnalysisRow[] = [
      makeRow({ ciudad: 'Madrid' }),
      makeRow({ ciudad: 'Madrid' }),
      makeRow({ ciudad: 'Madrid' }),
      makeRow({ ciudad: 'Barcelona' }),
    ];

    const res = computeGeoMap(rows, {
      territoryDim: 'ciudad',
      metricColumn: '',
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
