import { describe, expect, it } from 'vitest';
import { computeSpc } from './spc';

describe('computeSpc', () => {
  it('handles empty input gracefully', () => {
    const res = computeSpc([], { measureCol: 'val' });
    expect(res.validPoints).toBe(0);
    expect(res.mean).toBe(0);
    expect(res.isProcessInControl).toBe(true);
    expect(res.points).toEqual([]);
  });

  it('calculates Shewhart control limits correctly with Moving Range method', () => {
    const rows = [
      { val: 10 },
      { val: 12 },
      { val: 10 },
      { val: 11 },
      { val: 9 },
      { val: 10 },
    ];
    const res = computeSpc(rows, { measureCol: 'val', sigmaMethod: 'moving-range' });

    expect(res.validPoints).toBe(6);
    expect(res.mean).toBeCloseTo(10.333, 2);
    expect(res.sigma).toBeGreaterThan(0);
    expect(res.ucl).toBeCloseTo(res.mean + 3 * res.sigma, 2);
    expect(res.lcl).toBeCloseTo(res.mean - 3 * res.sigma, 2);
    expect(res.isProcessInControl).toBe(true);
  });

  it('detects Rule 1 violation (point outside 3-sigma limits)', () => {
    const rows = [
      { val: 10 },
      { val: 10 },
      { val: 10 },
      { val: 10 },
      { val: 10 },
      { val: 50 }, // Massive spike outside UCL
    ];
    const res = computeSpc(rows, { measureCol: 'val' });

    expect(res.isProcessInControl).toBe(false);
    expect(res.violationsCount).toBeGreaterThan(0);
    const rule1 = res.violationLog.find((v) => v.rule.ruleNumber === 1);
    expect(rule1).toBeDefined();
    expect(rule1?.value).toBe(50);
  });

  it('detects Rule 4 violation (shift of 8 consecutive points on one side of center line)', () => {
    // 8 points above mean, then 8 points below mean
    const rows = [
      { val: 15 },
      { val: 16 },
      { val: 15 },
      { val: 17 },
      { val: 16 },
      { val: 15 },
      { val: 16 },
      { val: 17 }, // 8th point above
      { val: 5 },
      { val: 4 },
      { val: 5 },
      { val: 6 },
      { val: 5 },
      { val: 4 },
      { val: 5 },
      { val: 6 },
    ];
    const res = computeSpc(rows, { measureCol: 'val', targetMean: 10 });

    const rule4 = res.violationLog.find((v) => v.rule.ruleNumber === 4);
    expect(rule4).toBeDefined();
  });

  it('detects Rule 5 violation (trend of 6 consecutively increasing points)', () => {
    const rows = [
      { val: 10 },
      { val: 11 },
      { val: 12 },
      { val: 13 },
      { val: 14 },
      { val: 15 }, // 6 increasing
    ];
    const res = computeSpc(rows, { measureCol: 'val' });

    const rule5 = res.violationLog.find((v) => v.rule.ruleNumber === 5);
    expect(rule5).toBeDefined();
  });
});
