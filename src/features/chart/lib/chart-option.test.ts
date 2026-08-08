import { describe, expect, it } from 'vitest';
import { aggregateToCsv } from './export-csv';
import { buildChartOption, type ChartTitles } from './chart-option';
import type { AggregateResult } from './aggregate';

const titles: ChartTitles = { title: 'Suma de importe por ciudad', valueName: 'Suma de importe' };

function result(rows: [string, number][], isOthers = false): AggregateResult {
  return {
    rows: rows.map(([label, value]) => ({ label, value, rowCount: 1, isOthers })),
    excludedCount: 0,
    totalRows: rows.length,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- la opción de ECharts es un árbol laxo; en los tests se inspecciona por partes */
type AnyOption = Record<string, any>;

describe('buildChartOption', () => {
  it('monta un gráfico de barras con las categorías en el eje x', () => {
    const option = buildChartOption(result([['A', 1], ['B', 2]]), 'bar', titles) as AnyOption;

    expect(option.xAxis.data).toEqual(['A', 'B']);
    expect(option.series[0].type).toBe('bar');
    expect(option.series[0].data).toEqual([1, 2]);
    expect(option.aria).toMatchObject({ enabled: true, description: titles.title });
  });

  it('el gráfico de sectores usa pares nombre/valor y tooltip por elemento', () => {
    const option = buildChartOption(result([['A', 1]]), 'pie', titles) as AnyOption;

    expect(option.series[0].type).toBe('pie');
    expect(option.series[0].data).toEqual([{ name: 'A', value: 1 }]);
    expect(option.tooltip.trigger).toBe('item');
    expect(option.xAxis).toBeUndefined();
  });

  it('rota las etiquetas del eje cuando hay muchas categorías', () => {
    const few = buildChartOption(result([['A', 1]]), 'bar', titles) as AnyOption;
    const many = buildChartOption(
      result(Array.from({ length: 20 }, (_, i) => [`C${i}`, i])),
      'bar',
      titles,
    ) as AnyOption;

    expect(few.xAxis.axisLabel.rotate).toBe(0);
    expect(many.xAxis.axisLabel.rotate).toBe(45);
  });

  it('formatea los números del tooltip en es-ES', () => {
    const option = buildChartOption(result([['A', 1]]), 'bar', titles) as AnyOption;

    expect(option.tooltip.valueFormatter(1234567.5)).toBe('1.234.567,5');
  });
});

describe('aggregateToCsv', () => {
  it('genera CSV con punto y coma, números es-ES y BOM', () => {
    const csv = aggregateToCsv(result([['Madrid', 12345.5]]), 'ciudad', 'Suma de importe');

    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM para que Excel lea UTF-8
    expect(csv.slice(1)).toBe('ciudad;Suma de importe;Filas\r\nMadrid;12.345,5;1');
  });

  it('entrecomilla las etiquetas que contienen el separador o comillas', () => {
    const csv = aggregateToCsv(result([['Madrid; sur', 1], ['"raro"', 2]]), 'ciudad', 'valor');

    expect(csv).toContain('"Madrid; sur";1;1');
    expect(csv).toContain('"""raro""";2;1');
  });
});
