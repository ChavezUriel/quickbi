import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { MAX_FILE_SIZE_BYTES, detectFileType, parseFile } from './parse-file';
import { FileParseError } from './parse-error';

function csvFile(content: string, name = 'datos.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

function xlsxFile(sheets: Record<string, unknown[][]>, name = 'datos.xlsx'): File {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  }
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], name);
}

describe('detectFileType', () => {
  it.each([
    ['datos.csv', 'csv'],
    ['datos.xlsx', 'xlsx'],
    ['datos.xls', 'xls'],
    ['DATOS.CSV', 'csv'],
    ['informe.final.xlsx', 'xlsx'],
  ])('reconoce %s como %s', (fileName, expected) => {
    expect(detectFileType(fileName)).toBe(expected);
  });

  it.each(['datos.json', 'datos.pdf', 'sin-extension'])('rechaza %s', (fileName) => {
    expect(() => detectFileType(fileName)).toThrow(FileParseError);
  });
});

describe('parseFile: validación previa', () => {
  it('rechaza un archivo vacío', async () => {
    await expect(parseFile(csvFile(''))).rejects.toThrow(FileParseError);
  });

  it('rechaza un archivo por encima del límite de memoria', async () => {
    const file = csvFile('id\n1\n', 'enorme.csv');
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });

    await expect(parseFile(file)).rejects.toThrow(/supera el máximo de 100 MB/);
  });

  it('rechaza un formato no soportado antes de leer el contenido', async () => {
    await expect(parseFile(csvFile('{}', 'datos.json'))).rejects.toThrow(FileParseError);
  });
});

describe('parseFile: CSV', () => {
  it('extrae columnas, filas y metadatos', async () => {
    const dataset = await parseFile(csvFile('id,nombre\n1,Ana\n2,Luis\n'));

    expect(dataset).toMatchObject({
      fileName: 'datos.csv',
      fileType: 'csv',
      columns: ['id', 'nombre'],
      rowCount: 2,
      warnings: [],
    });
    expect(dataset.rows).toEqual([
      { id: '1', nombre: 'Ana' },
      { id: '2', nombre: 'Luis' },
    ]);
  });

  it('NO infiere tipos: preserva ceros a la izquierda y enteros largos', async () => {
    const dataset = await parseFile(
      csvFile('codigo,telefono,id\n007,+34600111222,90071992547409911\n'),
    );

    // Con `dynamicTyping` estos valores se corromperían: 007 → 7 y el id
    // perdería precisión al pasar por un `number`.
    expect(dataset.rows[0]).toEqual({
      codigo: '007',
      telefono: '+34600111222',
      id: '90071992547409911',
    });
  });

  it('normaliza a null las celdas vacías o en blanco', async () => {
    const dataset = await parseFile(csvFile('a,b,c\n1,,   \n'));

    expect(dataset.rows[0]).toEqual({ a: '1', b: null, c: null });
  });

  it('rellena con null las columnas que faltan al final de una fila', async () => {
    const dataset = await parseFile(csvFile('a,b,c\n1\n'));

    expect(dataset.rows[0]).toEqual({ a: '1', b: null, c: null });
  });

  it('desambigua cabeceras duplicadas en lugar de perder la columna', async () => {
    const dataset = await parseFile(csvFile('total,total\n10,20\n'));

    expect(dataset.columns).toEqual(['total', 'total_2']);
    expect(dataset.rows[0]).toEqual({ total: '10', total_2: '20' });
  });

  it('avisa cuando hay filas con más valores que cabeceras', async () => {
    const dataset = await parseFile(csvFile('a,b\n1,2,3\n'));

    expect(dataset.warnings).toHaveLength(1);
    expect(dataset.warnings[0]).toMatch(/más valores/);
  });

  it('respeta los valores entrecomillados con comas y saltos de línea', async () => {
    const dataset = await parseFile(csvFile('a,b\n"Madrid, España","línea 1\nlínea 2"\n'));

    expect(dataset.rows[0]).toEqual({
      a: 'Madrid, España',
      b: 'línea 1\nlínea 2',
    });
  });

  it('ignora las líneas en blanco', async () => {
    const dataset = await parseFile(csvFile('a\n1\n\n\n2\n'));

    expect(dataset.rowCount).toBe(2);
  });

  it('acepta un CSV con cabecera pero sin filas', async () => {
    const dataset = await parseFile(csvFile('a,b\n'));

    expect(dataset.rowCount).toBe(0);
    expect(dataset.columns).toEqual(['a', 'b']);
  });
});

describe('parseFile: Excel', () => {
  it('extrae columnas y filas de la primera hoja', async () => {
    const dataset = await parseFile(
      xlsxFile({
        Ventas: [
          ['producto', 'unidades'],
          ['Teclado', 3],
          ['Ratón', 7],
        ],
      }),
    );

    expect(dataset).toMatchObject({
      fileType: 'xlsx',
      columns: ['producto', 'unidades'],
      rowCount: 2,
      warnings: [],
    });
    // A diferencia del CSV, en Excel el tipo lo declara el propio fichero.
    expect(dataset.rows).toEqual([
      { producto: 'Teclado', unidades: 3 },
      { producto: 'Ratón', unidades: 7 },
    ]);
  });

  it('avisa de las hojas que ha ignorado', async () => {
    const dataset = await parseFile(
      xlsxFile({
        Enero: [['a'], [1]],
        Febrero: [['a'], [2]],
        Marzo: [['a'], [3]],
      }),
    );

    expect(dataset.warnings).toHaveLength(1);
    expect(dataset.warnings[0]).toContain('Enero');
    expect(dataset.warnings[0]).toContain('Febrero, Marzo');
  });

  it('etiqueta un .xls como xls, no como xlsx', async () => {
    const dataset = await parseFile(xlsxFile({ Hoja: [['a'], [1]] }, 'antiguo.xls'));

    expect(dataset.fileType).toBe('xls');
  });

  it('normaliza las cabeceras vacías de la primera fila', async () => {
    const dataset = await parseFile(
      xlsxFile({ Hoja: [['a', null, 'a'], [1, 2, 3]] }),
    );

    expect(dataset.columns).toEqual(['a', 'columna_2', 'a_2']);
  });

  it('rechaza una hoja vacía', async () => {
    await expect(parseFile(xlsxFile({ Vacia: [] }))).rejects.toThrow(FileParseError);
  });
});

describe('parseFile: equivalencia entre formatos', () => {
  it('produce la misma estructura para el mismo contenido textual', async () => {
    const csv = await parseFile(csvFile('a,b\nx,y\n'));
    const excel = await parseFile(xlsxFile({ Hoja: [['a', 'b'], ['x', 'y']] }));

    expect(csv.columns).toEqual(excel.columns);
    expect(csv.rows).toEqual(excel.rows);
    expect(csv.rowCount).toBe(excel.rowCount);
  });
});
