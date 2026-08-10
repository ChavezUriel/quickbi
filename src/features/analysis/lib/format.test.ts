import { describe, expect, it } from 'vitest';
import { formatMetric } from './format';

const options = { format: 'numero' as const, currency: 'MXN' as const };

describe('formatMetric', () => {
  it('uses two decimal places for non-integer metric results', () => {
    expect(formatMetric(12.5, options)).toBe('12,50');
    expect(formatMetric(12.345, options)).toBe('12,35');
  });

  it('does not add decimal places to integer metric results', () => {
    expect(formatMetric(12, options)).toBe('12');
  });

  it('applies the same precision to percentages', () => {
    expect(formatMetric(12.5, { ...options, format: 'porcentaje' })).toBe('12,50 %');
  });

  it('keeps compact values short for axes and narrow cells', () => {
    expect(formatMetric(1250.5, { ...options, compact: true })).toBe('1,3\u00a0mil');
  });
});
