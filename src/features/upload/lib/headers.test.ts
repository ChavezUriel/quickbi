import { describe, expect, it } from 'vitest';
import { normalizeHeaders } from './headers';

describe('normalizeHeaders', () => {
  it('recorta los espacios extremos', () => {
    expect(normalizeHeaders([' total ', '\tprecio\n'])).toEqual(['total', 'precio']);
  });

  it('da un nombre posicional a las cabeceras vacías', () => {
    expect(normalizeHeaders(['id', '', null, undefined])).toEqual([
      'id',
      'columna_2',
      'columna_3',
      'columna_4',
    ]);
  });

  it('convierte a texto las cabeceras no textuales', () => {
    expect(normalizeHeaders([2024, true])).toEqual(['2024', 'true']);
  });

  it('desambigua los duplicados en lugar de sobrescribirlos', () => {
    expect(normalizeHeaders(['total', 'total', 'total'])).toEqual([
      'total',
      'total_2',
      'total_3',
    ]);
  });

  it('trata " total" y "total" como duplicados una vez recortados', () => {
    expect(normalizeHeaders(['total', ' total'])).toEqual(['total', 'total_2']);
  });

  it('no colisiona cuando el sufijo ya existe como cabecera propia', () => {
    // Un contador ciego habría emitido "total_2" dos veces, perdiendo una columna.
    expect(normalizeHeaders(['total', 'total', 'total_2'])).toEqual([
      'total',
      'total_2',
      'total_2_2',
    ]);
  });

  it('siempre devuelve nombres únicos', () => {
    const columns = normalizeHeaders(['a', 'a', 'a_2', 'a_2', '', '', 'columna_5']);
    expect(new Set(columns).size).toBe(columns.length);
  });

  it('devuelve una lista vacía para una cabecera vacía', () => {
    expect(normalizeHeaders([])).toEqual([]);
  });
});
