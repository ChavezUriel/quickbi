import { describe, expect, it } from 'vitest';
import { coerceValue, profileColumn, profileColumns } from './infer-columns';
import type { CellValue, DataRow } from '../types';

/** Construye las filas de una sola columna llamada `valor`. */
function rowsOf(values: readonly CellValue[]): DataRow[] {
  return values.map((valor) => ({ valor }));
}

function profileOf(values: readonly CellValue[]) {
  return profileColumn('valor', rowsOf(values));
}

describe('profileColumn: inferencia de tipo', () => {
  it('marca como vacía una columna sin ningún valor', () => {
    const profile = profileOf([null, null]);

    expect(profile.type).toBe('empty');
    expect(profile.nullCount).toBe(2);
  });

  it('respeta los tipos nativos que llegan de Excel', () => {
    expect(profileOf([1, 2, 3]).type).toBe('number');
    expect(profileOf([new Date(2026, 0, 1)]).type).toBe('date');
    expect(profileOf([true, false]).type).toBe('boolean');
  });

  it('infiere números a partir de texto', () => {
    const profile = profileOf(['10', '20', '30']);

    expect(profile.type).toBe('number');
    expect(profile.format).toEqual({ kind: 'number', decimal: '.' });
  });

  it('detecta el separador decimal a nivel de columna', () => {
    const spanish = profileOf(['1.234,50', '2.000,00', '15,75']);
    expect(spanish.format).toEqual({ kind: 'number', decimal: ',' });

    const english = profileOf(['1,234.50', '2,000.00', '15.75']);
    expect(english.format).toEqual({ kind: 'number', decimal: '.' });
  });

  it('infiere fechas y su orden a partir del texto', () => {
    const iso = profileOf(['2026-01-15', '2026-02-20']);
    expect(iso.type).toBe('date');
    expect(iso.format).toEqual({ kind: 'date', order: 'iso' });

    // El 15 en primera posición solo puede ser un día.
    const dmy = profileOf(['15/01/2026', '03/02/2026']);
    expect(dmy.format).toEqual({ kind: 'date', order: 'dmy' });

    // El 15 en segunda posición solo puede ser un día.
    const mdy = profileOf(['01/15/2026', '02/03/2026']);
    expect(mdy.format).toEqual({ kind: 'date', order: 'mdy' });
  });

  it('infiere booleanos escritos en español', () => {
    expect(profileOf(['sí', 'no', 'sí']).type).toBe('boolean');
  });

  it('deja como texto lo que no encaja en nada', () => {
    expect(profileOf(['Ana', 'Luis']).type).toBe('text');
  });

  it('no confunde una columna de ceros y unos con booleanos', () => {
    expect(profileOf(['1', '0', '1']).type).toBe('number');
  });

  it('tolera una celda sucia sin degradar la columna', () => {
    // 9 de 10 valores son números: la columna sigue siendo medible y la celda
    // problemática se cuenta en lugar de arrastrar a las demás.
    const profile = profileOf(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'N/D']);

    expect(profile.type).toBe('number');
    expect(profile.invalidCount).toBe(1);
  });

  it('degrada a texto cuando hay demasiadas celdas sucias', () => {
    const profile = profileOf(['1', '2', '3', 'N/D', 'N/D']);

    expect(profile.type).toBe('text');
    expect(profile.invalidCount).toBe(0);
  });
});

describe('profileColumn: estadísticas', () => {
  it('cuenta vacíos, distintos y muestras', () => {
    const profile = profileOf(['a', 'b', 'a', null, 'c']);

    expect(profile).toMatchObject({
      nullCount: 1,
      distinctCount: 3,
      distinctCountExact: true,
      samples: ['a', 'b', 'a'],
    });
  });

  it('deja de contar distintos al llegar al tope', () => {
    const many = Array.from({ length: 1500 }, (_, index) => `v${index}`);
    const profile = profileOf(many);

    expect(profile.distinctCount).toBe(1000);
    expect(profile.distinctCountExact).toBe(false);
  });
});

describe('profileColumn: papel en el gráfico', () => {
  it('solo los números son medidas', () => {
    expect(profileOf([1, 2]).role).toBe('measure');
    expect(profileOf(['Ana']).role).toBe('dimension');
    expect(profileOf(['2026-01-15']).role).toBe('dimension');
    expect(profileOf([true]).role).toBe('dimension');
  });
});

describe('profileColumn: tipo forzado por el usuario', () => {
  it('reperfila y revela cuántos valores no sobrevivirían', () => {
    const profile = profileColumn('valor', rowsOf(['1', '2', 'Ana', 'Luis']), 'number');

    expect(profile.type).toBe('number');
    expect(profile.role).toBe('measure');
    expect(profile.invalidCount).toBe(2);
  });

  it('detecta el formato apropiado para el tipo forzado', () => {
    const profile = profileColumn('valor', rowsOf(['1.234,5', 'x']), 'number');

    expect(profile.format).toEqual({ kind: 'number', decimal: ',' });
  });
});

describe('profileColumns', () => {
  it('perfila cada columna por separado y conserva el orden', () => {
    const rows: DataRow[] = [
      { producto: 'Teclado', unidades: '3', fecha: '2026-01-15' },
      { producto: 'Ratón', unidades: '12', fecha: '2026-02-20' },
    ];

    const profiles = profileColumns(['producto', 'unidades', 'fecha'], rows);

    expect(profiles.map((profile) => profile.name)).toEqual([
      'producto',
      'unidades',
      'fecha',
    ]);
    expect(profiles.map((profile) => profile.type)).toEqual(['text', 'number', 'date']);
  });
});

describe('coerceValue', () => {
  it('convierte texto al tipo de la columna', () => {
    expect(coerceValue('1.234,5', 'number', { kind: 'number', decimal: ',' })).toBe(1234.5);
    expect(coerceValue('15/01/2026', 'date', { kind: 'date', order: 'dmy' })).toEqual(
      new Date(2026, 0, 15),
    );
    expect(coerceValue('sí', 'boolean', { kind: 'none' })).toBe(true);
  });

  it('deja pasar los valores que ya tienen el tipo correcto', () => {
    expect(coerceValue(42, 'number', { kind: 'number', decimal: '.' })).toBe(42);
  });

  it('devuelve null cuando el valor no encaja', () => {
    expect(coerceValue('Ana', 'number', { kind: 'number', decimal: '.' })).toBeNull();
    expect(coerceValue(null, 'text', { kind: 'none' })).toBeNull();
  });

  it('convierte cualquier cosa a texto', () => {
    expect(coerceValue(42, 'text', { kind: 'none' })).toBe('42');
    expect(coerceValue(true, 'text', { kind: 'none' })).toBe('true');
  });
});
