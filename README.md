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

La aplicación es un asistente de tres pasos:

1. **Carga de archivos** — ingesta de CSV/Excel, fusión de ficheros con el mismo
   esquema, vista previa y resumen de qué puede hacer el análisis con ese dataset.
2. **Configuración de campos** — confirmación de los tipos inferidos y elección
   del papel de cada columna: eje temporal, dimensiones y métricas.
3. **Análisis cruzado** — cuadro de mando multidimensional con filtrado cruzado.

```
src/
├── components/
│   ├── ui/                  Primitivas de shadcn (no editar a mano)
│   ├── echart.tsx           Envoltorio React perezoso sobre echarts/core
│   ├── error-boundary.tsx   Evita la pantalla en blanco ante un fallo de render
│   └── theme-toggle.tsx
├── features/
│   ├── dataset/             Objeto de dominio central
│   │   ├── types.ts             ParsedDataset, DataRow, CellValue
│   │   └── lib/
│   │       ├── column-types.ts     ColumnProfile, ColumnType, formatos
│   │       ├── parse-values.ts     Texto → número / fecha / booleano (puro)
│   │       └── infer-columns.ts    Perfilado de columnas + coerceValue
│   ├── mapping/             Confirmación de tipos (paso 2)
│   │   ├── labels.ts            Etiquetas en español
│   │   ├── use-column-mapping.ts
│   │   └── components/
│   ├── analysis/            Cuadro de mando de análisis cruzado (paso 3)
│   │   ├── types.ts             FilterSet, MetricDef, ExplorationResult…
│   │   ├── labels.ts            Etiquetas y presets de período
│   │   ├── use-analysis-config.ts  Qué columnas alimentan el cuadro (paso 2)
│   │   ├── use-exploration.ts      Estado de la sección: filtros y emisor
│   │   ├── lib/
│   │   │   ├── dates.ts            Aritmética de calendario sobre días ISO (puro)
│   │   │   ├── filters.ts          Conjunto de filtros compartido (puro)
│   │   │   ├── prepare-rows.ts     Dataset → filas normalizadas, una sola vez
│   │   │   ├── explore.ts          Motor: agrupa, compara y construye la serie (puro)
│   │   │   ├── serie-option.ts     Serie → opción de ECharts (puro)
│   │   │   ├── format.ts           Formateo es-ES de métricas y variaciones
│   │   │   └── export-csv.ts       Detalle → CSV es-ES para Excel (puro)
│   │   └── components/
│   │       ├── analysis-dashboard.tsx  Ensambla la sección
│   │       ├── analysis-setup.tsx      Configuración del análisis (paso 2)
│   │       ├── dataset-readiness.tsx   Qué ofrece el dataset (paso 1)
│   │       ├── filter-bar.tsx          Período, comparación, grano y filtros
│   │       ├── series-chart.tsx        Evolución temporal
│   │       ├── movements-list.tsx      Subidas, caídas y desaparecidos
│   │       ├── detail-table.tsx        Detalle por categoría con barras
│   │       └── delta-pill.tsx          Insignia de variación con escala divergente
│   ├── wizard/              Asistente de tres pasos
│   └── upload/              Ingesta de ficheros
│       ├── components/
│       └── lib/
│           ├── headers.ts            Normalización de cabeceras (puro)
│           ├── parse-file.ts         File → ParsedDataset (corre en el worker)
│           ├── parse-file.worker.ts  Entrada del Web Worker
│           ├── parse-client.ts       API del hilo principal
│           └── parse-error.ts        FileParseError
└── lib/                     Utilidades transversales (cn, tema, descargas)
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
solo el gráfico de líneas y los componentes necesarios, en lugar
de `echarts-for-react`: ese wrapper arrastra el paquete completo de golpe y su
versión 3 es anterior a ECharts 6, que es la que usa este proyecto. El tema
oscuro se recrea con la instancia —`setOption` no basta— observando la clase
`dark` del elemento raíz, y el fondo del gráfico es transparente para que se vea
la tarjeta y no el lienzo por defecto del tema.

**El ancla temporal es el último día del dataset, no hoy.** «Últimos 3 meses»
se cuenta hacia atrás desde la fecha más reciente del fichero: un export cerrado
en marzo mostraría tres meses vacíos si el ancla fuera el reloj del navegador.
La ventana de comparación se desplaza en las mismas unidades del preset y se
recorta al día equivalente —tres meses contra tres meses, con el último a la
misma altura—, porque comparar un mes completo contra uno a medias inventa una
caída que no existe.

**El cuadro de mando cabe en una pantalla.** A partir de `xl` el paso 3 deja de
ser un documento que crece y se clava a la altura de la ventana: barra de
control arriba y los tres paneles en una sola fila que se reparte lo que queda,
con el scroll dentro de cada uno. La razón es el filtrado cruzado: pulsar una
categoría y no ver a la vez qué le pasa al total, a la evolución y al detalle es
perder justamente lo que hace útil el gesto. Por debajo de `xl` no hay altura
que repartir —encajarlo a la fuerza daría tres cajas de 80 px— y se vuelve al
documento largo. La altura viaja por una cadena de `flex-1` + `min-h-0` desde
`AppShell` hasta el lienzo, así que el ancho de cada panel ya no se parece al de
la ventana: lo que decide cuántas columnas enseña la tabla de detalle o si los
movimientos van en fila o apilados son consultas de contenedor, no de pantalla.

**El cuadro de mando calcula dos veces, no una.** Al pulsar una categoría, el
widget que originó el clic sigue viendo todas las suyas (con lo elegido
resaltado y el resto atenuado) mientras los demás muestran ya el conjunto
filtrado. Son dos ejecuciones del motor sobre el mismo conjunto de filtros: una
con la condición de la dimensión activa y otra sin ella. Sin eso, filtrar por
«Norte» dejaría en pantalla un único elemento y no habría forma de cambiar la
selección sin deshacerla antes.

**Las filas se normalizan una sola vez.** `prepare-rows.ts` convierte el dataset
a fechas ISO, texto y número antes de explorar. Es lo que hace que el filtrado
cruzado se sienta instantáneo: sin ello, cada clic volvería a interpretar
«1.234,56» y «15/01/2026» en cada fila y para cada widget.

**La participación solo existe si la métrica es acumulativa.** Una suma reparte
su total entre las categorías; una media, no (la media de las partes no es la
media del todo). Por eso con una media no hay porcentaje de participación ni
residuo «Otros», y un período sin datos se dibuja como hueco y no como cero:
un cero fingiría un desplome donde solo hubo silencio.

**Las filas que quedan fuera se cuentan.** Las que no tienen fecha convertible
no entran en ninguna ventana temporal y se muestran aparte («Sin fecha: 12»),
igual que las descartadas por errores de conversión, que se recuerdan con un
enlace mental al paso anterior donde se pueden preservar.

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

1. Ingesta de CSV/Excel, fusión de varios ficheros con el mismo esquema y
   vista previa del dataset.
2. Inferencia de tipos por columna (número, fecha, booleano, texto) con
   detección de formato y estadísticas de calidad, corregible a mano.
3. Configuración del análisis: eje temporal, dimensiones y métricas (suma o
   media de cualquier columna numérica, más el recuento de filas), con formato
   de número, moneda o porcentaje.
4. Cuadro de mando de análisis cruzado:
   - selección de la dimensión activa (o el total sin agrupar) y de la métrica;
   - período por presets o rango libre, granularidad automática o forzada, y
     comparación contra el período anterior, el mismo del año anterior o un
     rango propio;
   - filtrado cruzado bidireccional entre la evolución, los movimientos y la
     tabla, con selección múltiple mediante Ctrl/⌘;
   - evolución temporal con las diez series mayores y el residuo «Otros»,
     superponiendo el período de comparación cuando hay una sola serie;
   - rankings de subidas, caídas y desaparecidos;
   - detalle por categoría con participación, valor previo y variación.
5. Tema claro/oscuro y exportación a PNG y CSV.

Posibles siguientes pasos: varias métricas a la vez en la misma tabla, jerarquías
de dimensiones (drill-down encadenado), cálculo en un Web Worker para datasets
de más de 100 000 filas, y modo offline instalable (PWA).
