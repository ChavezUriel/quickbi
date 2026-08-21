import { describe, expect, it } from 'vitest';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import { normalizeName, suggestColumn } from './slot-suggest';

function column(name: string, distinctCount = 10): ColumnProfile {
  return {
    name,
    type: 'text',
    format: { kind: 'none' },
    role: 'dimension',
    nullCount: 0,
    invalidCount: 0,
    distinctCount,
    distinctCountExact: true,
    samples: [],
  };
}

describe('normalizeName', () => {
  it('quita acentos y mayúsculas', () => {
    expect(normalizeName('Año Fiscal')).toBe('ano fiscal');
    expect(normalizeName('CÓDIGO')).toBe('codigo');
  });
});

describe('suggestColumn', () => {
  it('devuelve null cuando no hay candidatas', () => {
    expect(suggestColumn([], { hints: ['cliente'] })).toBeNull();
  });

  it('prefiere el nombre exacto sobre el que solo contiene la pista', () => {
    const columns = [column('id_cliente'), column('cliente')];
    expect(suggestColumn(columns, { hints: ['cliente'] })).toBe('cliente');
  });

  it('respeta el orden de las pistas', () => {
    const columns = [column('comprador'), column('cliente')];
    expect(suggestColumn(columns, { hints: ['cliente', 'comprador'] })).toBe('cliente');
  });

  it('casa sin distinguir acentos', () => {
    expect(suggestColumn([column('Código de cliente')], { hints: ['codigo'] })).toBe(
      'Código de cliente',
    );
  });

  it('desempata por cardinalidad alta cuando ninguna pista casa', () => {
    const columns = [column('zona', 4), column('email', 900)];
    expect(suggestColumn(columns, { hints: ['cliente'], cardinality: 'alta' })).toBe(
      'email',
    );
  });

  it('desempata por cardinalidad baja cuando se pide una categoría', () => {
    const columns = [column('zona', 4), column('email', 900)];
    expect(suggestColumn(columns, { hints: ['tipo'], cardinality: 'baja' })).toBe('zona');
  });

  it('cae en la primera columna cuando la cardinalidad es indiferente', () => {
    const columns = [column('a'), column('b')];
    expect(suggestColumn(columns, { hints: ['nada'] })).toBe('a');
  });
});
