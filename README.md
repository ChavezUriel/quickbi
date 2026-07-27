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
│   │   ├── dataset-context.ts
│   │   ├── dataset-provider.tsx
│   │   └── use-dataset.ts
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

Implementado: ingesta de CSV/Excel y vista previa del dataset.
Siguiente: mapeo de columnas y visualizaciones (ECharts ya está instalado).
