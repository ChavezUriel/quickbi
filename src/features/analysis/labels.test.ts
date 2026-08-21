import { describe, expect, it } from 'vitest';
import { RANGE_PRESETS, RANGE_PRESETS_BY_ID } from './labels';

describe('RANGE_PRESETS lookup performance', () => {
  it('correctly maps all range preset ids', () => {
    for (const preset of RANGE_PRESETS) {
      expect(RANGE_PRESETS_BY_ID[preset.id]).toBe(preset);
    }
  });

  it('compares Array.find vs Record lookup speed', () => {
    const idsToLookup = ['7d', '30d', '3m', '6m', '12m', '3a', 'invalid_id'];
    const iterations = 100_000;

    // Measure Array.find
    const startArray = performance.now();
    let countArray = 0;
    for (let i = 0; i < iterations; i++) {
      const id = idsToLookup[i % idsToLookup.length]!;
      const preset = RANGE_PRESETS.find((option) => option.id === id);
      if (preset !== undefined) countArray++;
    }
    const durationArray = performance.now() - startArray;

    // Measure Record lookup
    const startRecord = performance.now();
    let countRecord = 0;
    for (let i = 0; i < iterations; i++) {
      const id = idsToLookup[i % idsToLookup.length]!;
      const preset = RANGE_PRESETS_BY_ID[id];
      if (preset !== undefined) countRecord++;
    }
    const durationRecord = performance.now() - startRecord;

    expect(countArray).toBe(countRecord);

    console.log(`\n⚡ Benchmark Results (${iterations.toLocaleString()} iterations):`);
    console.log(`Array.prototype.find : ${durationArray.toFixed(3)} ms`);
    console.log(`Record O(1) lookup   : ${durationRecord.toFixed(3)} ms`);
    const speedup = durationArray / Math.max(durationRecord, 0.0001);
    console.log(`Speedup factor       : ${speedup.toFixed(2)}x faster\n`);
  });
});
