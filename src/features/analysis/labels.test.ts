import { describe, expect, it } from 'vitest';
import { RANGE_PRESETS, RANGE_PRESETS_BY_ID } from './labels';

describe('RANGE_PRESETS lookup performance', () => {
  it('correctly maps all range preset ids', () => {
    for (const preset of RANGE_PRESETS) {
      expect(RANGE_PRESETS_BY_ID[preset.id]).toBe(preset);
    }
  });

  it('compares Array.find vs Record lookup equivalence', () => {
    const idsToLookup = ['7d', '30d', '3m', '6m', '12m', '3a', 'invalid_id'];

    for (const id of idsToLookup) {
      const fromArray = RANGE_PRESETS.find((option) => option.id === id);
      const fromRecord = RANGE_PRESETS_BY_ID[id];
      expect(fromRecord).toBe(fromArray);
    }
  });
});
