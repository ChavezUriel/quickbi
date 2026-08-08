# QuickBI

Análisis exploratorio y BI **100 % en el navegador**. Cargas un CSV o un Excel, lo
exploras, y los datos nunca salen de tu máquina: no hay backend, no hay subida, no
hay telemetría.

## Requisitos

- Node.js 20 o superior
- npm

## Puesta en marcha

```bash
npm install
npm run dev
```

> `npm install` descarga SheetJS desde `cdn.sheetjs.com` (ver [Dependencias](#dependencias)),
> así que la primera instalación necesita acceso a ese dominio.

## Scripts

| Script                  | Qué hace                                          |
| ----------------------- | ------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo con HMR                    |
| `npm run build`         | Comprueba tipos y genera el build de producción   |
| `npm run preview`       | Sirve el build de producción localmente           |
| `npm run lint`          | Oxlint                                            |
| `npm test`              | Tests (Vitest)                                    |
| `npm run test:watch`    | Tests en modo watch                               |
| `npm run test:coverage` | Tests con informe de cobertura                    |
| `npm run check`         | Lint + tipos + tests (lo que debe pasar en CI)     |

## Arquitectura

```
src/
├── components/
│   ├── ui/                  Primitivas de shadcn (no editar a mano)
│   ├── error-boundary.tsx   Evita la pantalla en blanco ante un fallo de render
│   └── theme-toggle.tsx
├── features/
│   ├── dataset/             Objeto de dominio central + estado compartido
│   │   ├── types.ts             ParsedDataset, DataRow, CellValue
│   │   ├── lib/
│   │   │   ├── column-types.ts     ColumnProfile, ColumnType, formatos
│   │   │   ├── parse-values.ts     Texto → número / fecha / booleano (puro)
│   │   │   └── infer-columns.ts    Perfilado de columnas + coerceValue
│   │   ├── dataset-context.ts
│   │   ├── dataset-provider.tsx
│   │   └── use-dataset.ts
│   ├── mapping/             Confirmación de tipos y configuración del gráfico
│   │   ├── types.ts             ChartMapping, Aggregation
│   │   ├── labels.ts            Etiquetas en español
│   │   ├── use-column-mapping.ts
│   │   └── components/
│   ├── chart/               Agregación y visualización
│   │   ├── types.ts             ChartConfig, ChartType, DateGranularity
│   │   ├── labels.ts            Etiquetas en español
│   │   ├── use-chart-config.ts  Ajustes derivados de la dimensión
│   │   ├── lib/
│   │   │   ├── aggregate.ts        Filas → categorías agregadas (puro)
│   │   │   ├── chart-option.ts     Resultado → opción de ECharts (puro)
│   │   │   ├── export-csv.ts       Resultado → CSV es-ES para Excel (puro)
│   │   │   └── download.ts         Descargas locales (blob/data URL)
│   │   └── components/
│   │       ├── echart.tsx          Envoltorio React perezoso sobre echarts/core
│   │       ├── chart-view.tsx      Tarjeta del gráfico: controles y exportación
│   │       └── chart-table.tsx     Los mismos datos en tabla (accesibilidad)
│   └── upload/              Ingesta de ficheros
│       ├── components/
│       └── lib/
│           ├── headers.ts            Normalización de cabeceras (puro)
│           ├── parse-file.ts         File → ParsedDataset (corre en el worker)
│           ├── parse-file.worker.ts  Entrada del Web Worker
│           ├── parse-client.ts       API del hilo principal
│           └── parse-error.ts        FileParseError
└── lib/                     Utilidades transversales (cn, tema)
```

### Decisiones de diseño

**El parsing corre en un Web Worker.** `XLSX.read` es síncrono y Papa en modo
string también: con un fichero grande, hacerlo en el hilo principal congelaría la
pestaña entera —incluido el spinner que dice «procesando»—. Si el navegador no
soporta workers de módulo, `parse-client.ts` cae al hilo principal en vez de fallar.

**No se infieren tipos al leer un CSV.** `dynamicTyping` de Papa está desactivado a
propósito: convierte `"007"` en `7`, rompe teléfonos y códigos postales, y pierde
precisión en identificadores por encima de `Number.MAX_SAFE_INTEGER`. En un CSV no
hay información de tipo, así que se conserva el texto y la decisión se toma más
adelante, en el mapeo de columnas, donde el usuario la ve y puede corregirla. En
Excel es distinto: el tipo lo declara el propio fichero, así que sí se respeta.

**Las cabeceras se normalizan en un único sitio.** `normalizeHeaders` recorta
espacios, nombra las columnas vacías y desambigua duplicados. Sin esto, dos
columnas llamadas igual se sobrescriben en silencio al construir los objetos fila.
Ambos formatos pasan por la misma función, de modo que un CSV y un XLSX con el
mismo contenido producen exactamente la misma estructura.

**Nada se descarta en silencio.** Las hojas de Excel ignoradas, las filas con más
valores que cabeceras y demás incidencias viajan en `ParsedDataset.warnings` y se
muestran junto a la vista previa.

**SheetJS se carga bajo demanda.** Son ~360 KB que quien solo sube CSV no debería
pagar; se importa dinámicamente dentro de `parseExcel`.

**ECharts también se carga bajo demanda y se usa sin wrapper.** Es ~1 MB que no se
descarga hasta que hay algo que pintar. `echart.tsx` importa `echarts/core` con
solo los gráficos (barras, líneas, sectores) y componentes necesarios, en lugar
de `echarts-for-react`: ese wrapper arrastra el paquete completo de golpe y su
versión 3 es anterior a ECharts 6, que es la que usa este proyecto. El tema
oscuro se recrea con la instancia —`setOption` no basta— observando la clase
`dark` del elemento raíz, y el fondo del gráfico es transparente para que se vea
la tarjeta y no el lienzo por defecto del tema.

**«Otros» se calcula sobre los acumuladores, no sobre los valores.** Al plegar
las categorías por debajo del top N, la media de «Otros» es la media ponderada
de sus filas (no la media de las medias) y el mínimo/máximo son los de sus
categorías. «Otros» se ordena siempre al final. En dimensiones de fecha no hay
top N: una serie temporal recortada por valor deja de contar su historia; ahí
el control es la granularidad (día, mes, año).

**Las filas excluidas del gráfico se cuentan.** Una fila cuya dimensión o medida
no se convierte al tipo elegido no aporta a ninguna categoría; el total se
muestra bajo el gráfico («2 de 17 filas no se han representado»), como ya hace
el mapeo con «N no convertibles».

**El CSV exportado habla español de Excel.** Separador `;` (la coma es el
decimal), números en formato es-ES y BOM de UTF-8 para que Excel lo abra sin el
asistente de importación.

**El formato de una columna se decide una vez, no celda a celda.** `"1.234"` son
1234 o 1,234 según de dónde venga el fichero, y `"01/02/2026"` es el 1 de febrero
o el 2 de enero. Ambos casos se resuelven mirando la columna entera: se prueban
las dos lecturas y gana la que encaja en más filas (`"15/01"` solo puede ser
D/M, `"1,5"` solo puede ser coma decimal). El formato detectado se muestra en el
mapeo, porque una columna leída del revés es un error silencioso si no se ve.

**La inferencia tolera suciedad.** Basta con que el 90 % de los valores no vacíos
encajen para aceptar un tipo: una celda con «N/D» en una columna de importes no
debería degradarla a texto y dejarla fuera de los gráficos. Los valores que no
encajan se cuentan y se muestran («2 no convertibles»), nunca se ocultan. Si el
usuario corrige un tipo a mano, la columna se vuelve a perfilar para que vea al
momento cuántos valores no sobrevivirían a su elección.

## Privacidad

La promesa de que «los datos nunca salen de tu navegador» no se queda en el copy:
el build inyecta una CSP con `connect-src 'none'`, que bloquea `fetch`, `XHR`,
`WebSocket` y `sendBeacon`. Si alguna dependencia intentara llamar a casa, fallaría
de forma visible en la consola, y cualquiera puede comprobarlo en las devtools.

La política se inyecta solo en el build (`vite.config.ts`): en desarrollo, el HMR
de Vite necesita un WebSocket que `connect-src 'none'` bloquearía.

`frame-ancestors` se ignora dentro de un `<meta>`, así que si despliegas esto
conviene añadir como cabecera HTTP en el servidor:

```
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

## Dependencias

`xlsx` se instala desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, no
desde npm. La copia del registro de npm está congelada en 0.18.5 y arrastra dos
avisos sin corrección disponible (prototype pollution GHSA-4r6h-8v6p-xvw6 y ReDoS
GHSA-5pgg-2g8v-p4x9); dado que esta app procesa ficheros no confiables, se usa la
distribución oficial de SheetJS. Es el método de instalación
[documentado por SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs).

`npm audit --omit=dev` debe salir limpio. Los avisos que quedan en dependencias de
desarrollo vienen del CLI de `shadcn` y no llegan al bundle.

## Estado

Implementado:

1. Ingesta de CSV/Excel y vista previa del dataset.
2. Inferencia de tipos por columna (número, fecha, booleano, texto) con
   detección de formato y estadísticas de calidad.
3. Mapeo: confirmación o corrección de los tipos y elección de dimensión,
   medida y agregación.
4. Agregación de los datos según el mapeo (`aggregate.ts`): suma, media,
   recuento, mínimo y máximo, con granularidad de fechas, ordenación y
   plegado top N en «Otros».
5. Renderizado con ECharts (barras, líneas, sectores), tema claro/oscuro,
   tabla de datos agregados y exportación a PNG y CSV.

Posibles siguientes pasos: varias medidas a la vez, filtros sobre las filas,
y modo offline instalable (PWA).
