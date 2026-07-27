import { describe, expect, it } from 'vitest';
import { parseBoolean, parseDate, parseNumber } from './parse-values';

describe('parseNumber', () => {
  it.each([
    ['1234', 1234],
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56],
    ['1,234,567.89', 1234567.89],
    ['-42.5', -42.5],
    ['+7', 7],
    ['  10  ', 10],
  ])('con punto decimal lee %s como %s', (text, expected) => {
    expect(parseNumber(text, '.')).toBe(expected);
  });

  it.each([
    ['1234', 1234],
    ['1234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1.234.567,89', 1234567.89],
    ['-42,5', -42.5],
  ])('con coma decimal lee %s como %s', (text, expected) => {
    expect(parseNumber(text, ',')).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12abc', '1..2', '1,2,3', '$10', '10%', '1e5'])(
    'rechaza %s',
    (text) => {
      expect(parseNumber(text, '.')).toBeNull();
    },
  );

  it('no acepta grupos de miles que no sean de tres dígitos', () => {
    expect(parseNumber('1,23', '.')).toBeNull();
    expect(parseNumber('1.23', ',')).toBeNull();
  });

  it('interpreta "1.234" según el separador indicado', () => {
    // El mismo texto, dos números distintos: por eso el formato se decide una
    // vez por columna y no por celda.
    expect(parseNumber('1.234', '.')).toBe(1.234);
    expect(parseNumber('1.234', ',')).toBe(1234);
  });
});

describe('parseDate', () => {
  it('lee ISO sea cual sea el orden configurado', () => {
    for (const order of ['iso', 'dmy', 'mdy'] as const) {
      expect(parseDate('2026-01-15', order)).toEqual(new Date(2026, 0, 15));
    }
  });

  it('acepta un ISO con hora', () => {
    expect(parseDate('2026-01-15T10:30:00Z', 'iso')).toEqual(new Date(2026, 0, 15));
  });

  it('distingue día-mes de mes-día', () => {
    expect(parseDate('01/02/2026', 'dmy')).toEqual(new Date(2026, 1, 1));
    expect(parseDate('01/02/2026', 'mdy')).toEqual(new Date(2026, 0, 2));
  });

  it('admite barras, guiones y puntos como separador', () => {
    for (const text of ['15/01/2026', '15-01-2026', '15.01.2026']) {
      expect(parseDate(text, 'dmy')).toEqual(new Date(2026, 0, 15));
    }
  });

  it('en modo ISO no acepta fechas con barras', () => {
    expect(parseDate('15/01/2026', 'iso')).toBeNull();
  });

  it('rechaza fechas imposibles en lugar de desbordarlas', () => {
    // `new Date(2026, 1, 31)` daría el 3 de marzo sin avisar.
    expect(parseDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseDate('2026-02-30', 'iso')).toBeNull();
    expect(parseDate('32/01/2026', 'dmy')).toBeNull();
  });

  it.each(['', 'ayer', '15/01/26', '2026', 'texto'])('rechaza %s', (text) => {
    expect(parseDate(text, 'dmy')).toBeNull();
  });
});

describe('parseBoolean', () => {
  it.each(['true', 'TRUE', 'Verdadero', 'sí', 'Si', 'yes'])('lee %s como true', (text) => {
    expect(parseBoolean(text)).toBe(true);
  });

  it.each(['false', 'FALSE', 'Falso', 'no', 'NO'])('lee %s como false', (text) => {
    expect(parseBoolean(text)).toBe(false);
  });

  it('no trata 1 y 0 como booleanos', () => {
    // Si lo hiciera, cualquier columna de cantidades binarias dejaría de ser
    // numérica y no se podría medir.
    expect(parseBoolean('1')).toBeNull();
    expect(parseBoolean('0')).toBeNull();
  });

  it.each(['', 'quizá', 'y', 'n'])('rechaza %s', (text) => {
    expect(parseBoolean(text)).toBeNull();
  });
});
