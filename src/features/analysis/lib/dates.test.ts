import { describe, expect, it } from 'vitest';
import {
  addMonths,
  autoGranularity,
  bucketOf,
  daysBetween,
  formatCompactWindow,
  generateBuckets,
  shiftByDuration,
  shiftWindow,
  startOfUnit,
} from './dates';

describe('addMonths', () => {
  it('conserva el día cuando existe en el mes destino', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('recorta al último día en vez de desbordar al mes siguiente', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });
});

describe('startOfUnit', () => {
  it('lleva la semana al lunes anterior', () => {
    // 2026-08-07 es viernes.
    expect(startOfUnit('2026-08-07', 'semana')).toBe('2026-08-03');
    expect(startOfUnit('2026-08-03', 'semana')).toBe('2026-08-03');
    // 2026-08-09 es domingo: pertenece a la semana que empezó el lunes 3.
    expect(startOfUnit('2026-08-09', 'semana')).toBe('2026-08-03');
  });

  it('trunca mes, trimestre y año', () => {
    expect(startOfUnit('2026-08-07', 'mes')).toBe('2026-08-01');
    expect(startOfUnit('2026-08-07', 'trimestre')).toBe('2026-07-01');
    expect(startOfUnit('2026-08-07', 'anio')).toBe('2026-01-01');
  });
});

describe('bucketOf', () => {
  it('usa claves independientes del idioma', () => {
    expect(bucketOf('2026-08-07', 'dia')).toBe('2026-08-07');
    expect(bucketOf('2026-08-07', 'semana')).toBe('2026-08-03');
    expect(bucketOf('2026-08-07', 'mes')).toBe('2026-08');
    expect(bucketOf('2026-08-07', 'trimestre')).toBe('2026-T3');
    expect(bucketOf('2026-08-07', 'anio')).toBe('2026');
  });
});

describe('formatCompactWindow', () => {
  it('uses abbreviated month and two-digit year', () => {
    expect(formatCompactWindow({ desde: '2026-05-02', hasta: '2026-05-09' })).toBe(
      '2/may/26 \u2014 9/may/26',
    );
  });
});

describe('generateBuckets', () => {
  it('genera también los períodos vacíos', () => {
    expect(generateBuckets({ desde: '2026-05-14', hasta: '2026-08-07' }, 'mes')).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
  });

  it('incluye el período del último día', () => {
    expect(generateBuckets({ desde: '2026-08-05', hasta: '2026-08-07' }, 'dia')).toEqual([
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
  });
});

describe('autoGranularity', () => {
  it('elige el grano según la amplitud de la ventana', () => {
    expect(autoGranularity({ desde: '2026-07-01', hasta: '2026-08-07' })).toBe('dia');
    expect(autoGranularity({ desde: '2026-01-01', hasta: '2026-08-07' })).toBe('semana');
    expect(autoGranularity({ desde: '2024-01-01', hasta: '2026-08-07' })).toBe('mes');
    expect(autoGranularity({ desde: '2015-01-01', hasta: '2026-08-07' })).toBe('trimestre');
  });
});

describe('shiftWindow', () => {
  it('recorta el final al día equivalente del período previo', () => {
    // «Últimos 3 meses» hasta el 7 de agosto: junio, julio y siete días de agosto.
    const current = { desde: '2026-06-01', hasta: '2026-08-07' };

    expect(shiftWindow(current, 3, 'mes')).toEqual({
      desde: '2026-03-01',
      hasta: '2026-05-07',
    });
  });

  it('desplaza un año completo', () => {
    expect(shiftWindow({ desde: '2026-06-01', hasta: '2026-08-07' }, 1, 'anio')).toEqual({
      desde: '2025-06-01',
      hasta: '2025-08-07',
    });
  });
});

describe('shiftByDuration', () => {
  it('encadena la ventana previa justo antes de la actual', () => {
    const previous = shiftByDuration({ desde: '2026-08-01', hasta: '2026-08-10' });

    expect(previous).toEqual({ desde: '2026-07-22', hasta: '2026-07-31' });
    expect(daysBetween(previous.desde, previous.hasta)).toBe(9);
  });
});
