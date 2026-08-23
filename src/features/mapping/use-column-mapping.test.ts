// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ParsedDataset } from '@/features/dataset/types';
import { useColumnMapping, type ColumnMappingState } from './use-column-mapping';

// @ts-expect-error configure React test environment for act()
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setupHook(dataset: ParsedDataset) {
  let result!: ColumnMappingState;

  function TestComponent() {
    result = useColumnMapping(dataset);
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    get current() {
      return result;
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const mockDataset: ParsedDataset = {
  id: 'test-dataset',
  fileName: 'test.csv',
  fileType: 'csv',
  warnings: [],
  rowCount: 3,
  columns: [
    {
      name: 'id',
      type: 'text',
      format: { kind: 'none' },
      role: 'dimension',
      nullCount: 0,
      invalidCount: 0,
      distinctCount: 3,
      distinctCountExact: true,
      samples: ['1', '2', '3'],
    },
    {
      name: 'fecha',
      type: 'date',
      format: { kind: 'date', order: 'iso' },
      role: 'dimension',
      nullCount: 0,
      invalidCount: 0,
      distinctCount: 3,
      distinctCountExact: true,
      samples: ['2026-01-01', '2026-01-02', '2026-01-03'],
    },
    {
      name: 'ventas',
      type: 'number',
      format: { kind: 'number', decimal: '.' },
      role: 'measure',
      nullCount: 0,
      invalidCount: 0,
      distinctCount: 3,
      distinctCountExact: true,
      samples: ['100', '200', '300'],
    },
  ],
  rows: [
    { id: '1', fecha: '2026-01-01', ventas: 100 },
    { id: '2', fecha: '2026-01-02', ventas: 200 },
    { id: '3', fecha: '2026-01-03', ventas: 300 },
  ],
};

describe('useColumnMapping', () => {
  it('selects all non-empty columns by default and deselects completely empty columns', () => {
    const datasetWithEmpty: ParsedDataset = {
      ...mockDataset,
      columns: [
        ...mockDataset.columns,
        {
          name: 'vacia',
          type: 'empty',
          format: { kind: 'none' },
          role: 'dimension',
          nullCount: 3,
          invalidCount: 0,
          distinctCount: 0,
          distinctCountExact: true,
          samples: [],
        },
      ],
      rows: mockDataset.rows.map((r) => ({ ...r, vacia: null })),
    };

    const hook = setupHook(datasetWithEmpty);
    expect(hook.current.allColumns).toHaveLength(4);
    expect(hook.current.columns).toHaveLength(3);
    expect(hook.current.isColumnSelected('id')).toBe(true);
    expect(hook.current.isColumnSelected('fecha')).toBe(true);
    expect(hook.current.isColumnSelected('ventas')).toBe(true);
    expect(hook.current.isColumnSelected('vacia')).toBe(false);
    hook.cleanup();
  });

  it('allows deselecting a column', () => {
    const hook = setupHook(mockDataset);

    act(() => {
      hook.current.setColumnSelected('fecha', false);
    });

    expect(hook.current.allColumns).toHaveLength(3);
    expect(hook.current.columns).toHaveLength(2);
    expect(hook.current.isColumnSelected('fecha')).toBe(false);
    expect(hook.current.isColumnSelected('ventas')).toBe(true);
    expect(hook.current.dateColumns).toHaveLength(0);
    expect(hook.current.measures).toHaveLength(1);
    expect(hook.current.dimensions).toHaveLength(1);

    hook.cleanup();
  });

  it('allows re-selecting a deselected column', () => {
    const hook = setupHook(mockDataset);

    act(() => {
      hook.current.setColumnSelected('ventas', false);
    });
    expect(hook.current.columns).toHaveLength(2);
    expect(hook.current.measures).toHaveLength(0);

    act(() => {
      hook.current.setColumnSelected('ventas', true);
    });
    expect(hook.current.columns).toHaveLength(3);
    expect(hook.current.measures).toHaveLength(1);

    hook.cleanup();
  });

  it('toggles column selection', () => {
    const hook = setupHook(mockDataset);

    act(() => {
      hook.current.toggleColumnSelection('id');
    });
    expect(hook.current.isColumnSelected('id')).toBe(false);
    expect(hook.current.columns).toHaveLength(2);

    act(() => {
      hook.current.toggleColumnSelection('id');
    });
    expect(hook.current.isColumnSelected('id')).toBe(true);
    expect(hook.current.columns).toHaveLength(3);

    hook.cleanup();
  });

  it('supports deselectAllColumns and selectAllColumns', () => {
    const hook = setupHook(mockDataset);

    act(() => {
      hook.current.deselectAllColumns();
    });
    expect(hook.current.columns).toHaveLength(0);
    expect(hook.current.allColumns).toHaveLength(3);
    expect(hook.current.dimensions).toHaveLength(0);
    expect(hook.current.measures).toHaveLength(0);
    expect(hook.current.dateColumns).toHaveLength(0);

    act(() => {
      hook.current.selectAllColumns();
    });
    expect(hook.current.columns).toHaveLength(3);
    expect(hook.current.dimensions).toHaveLength(1);
    expect(hook.current.measures).toHaveLength(1);
    expect(hook.current.dateColumns).toHaveLength(1);

    hook.cleanup();
  });

  it('ignores conversion errors in deselected columns for effectiveRowCount', () => {
    const datasetWithInvalid: ParsedDataset = {
      id: 'invalid-ds',
      fileName: 'invalid.csv',
      fileType: 'csv',
      warnings: [],
      rowCount: 2,
      columns: [
        {
          name: 'num',
          type: 'number',
          format: { kind: 'number', decimal: '.' },
          role: 'measure',
          nullCount: 0,
          invalidCount: 1,
          distinctCount: 2,
          distinctCountExact: true,
          samples: ['10', 'abc'],
        },
        {
          name: 'cat',
          type: 'text',
          format: { kind: 'none' },
          role: 'dimension',
          nullCount: 0,
          invalidCount: 0,
          distinctCount: 2,
          distinctCountExact: true,
          samples: ['A', 'B'],
        },
      ],
      rows: [
        { num: 10, cat: 'A' },
        { num: 'abc', cat: 'B' },
      ],
    };

    const hook = setupHook(datasetWithInvalid);
    // When 'num' is selected and strict (preserveInvalid false), effective rows should be 1
    expect(hook.current.effectiveRowCount).toBe(1);

    // When 'num' is deselected, its invalid values should not discard rows
    act(() => {
      hook.current.setColumnSelected('num', false);
    });
    expect(hook.current.effectiveRowCount).toBe(2);

    hook.cleanup();
  });

  it('allows manually adjusting column subtype and preserves valid overrides', () => {
    const hook = setupHook(mockDataset);

    // Initial subtype for 'id' is identifier
    act(() => {
      hook.current.setColumnSubtype('id', 'geo');
    });

    const idCol = hook.current.columns.find((c) => c.name === 'id');
    expect(idCol?.subtype).toBe('geo');

    // Change subtype for 'ventas' to currency
    act(() => {
      hook.current.setColumnSubtype('ventas', 'currency');
    });
    const ventasCol = hook.current.columns.find((c) => c.name === 'ventas');
    expect(ventasCol?.subtype).toBe('currency');

    hook.cleanup();
  });

  it('resets incompatible subtype overrides when column type changes', () => {
    const hook = setupHook(mockDataset);

    // Set 'id' to 'geo' (valid for text)
    act(() => {
      hook.current.setColumnSubtype('id', 'geo');
    });
    expect(hook.current.columns.find((c) => c.name === 'id')?.subtype).toBe('geo');

    // Change 'id' type to 'number' -> 'geo' is not a valid number subtype
    act(() => {
      hook.current.setColumnType('id', 'number');
    });
    const updatedIdCol = hook.current.columns.find((c) => c.name === 'id');
    expect(updatedIdCol?.type).toBe('number');
    expect(updatedIdCol?.subtype).not.toBe('geo');

    hook.cleanup();
  });
});

