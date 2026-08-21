import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

/**
 * Mapa geográfico y análisis territorial.
 * 100 % offline sin dependencias de red externas.
 *
 * Agrega métricas por territorio (país, comunidad, estado, provincia o ciudad),
 * normaliza regiones y zonas geográficas, y calcula la concentración territorial.
 */

export interface GeoTerritory {
  /** Nombre del territorio según aparece en los datos. */
  territory: string;
  /** Nombre normalizado o etiqueta limpia. */
  normalizedName: string;
  /** Código o zona geográfica inferida (ej. 'Europa', 'LatAm', 'Norteamérica', 'España'). */
  zone: string;
  /** Valor agregado de la métrica principal. */
  value: number;
  /** Valor de la métrica secundaria (si existe). */
  secondaryValue: number | null;
  /** Número de registros o transacciones en este territorio. */
  rowCount: number;
  /** Promedio por registro (`value / rowCount`). */
  avgPerRecord: number;
  /** Porcentaje sobre el total global de la métrica (`0 - 100`). */
  share: number;
  /** Porcentaje acumulado ordenado por volumen (`0 - 100`). */
  cumulativeShare: number;
  /** Posición en el ranking territorial (1 = mayor volumen). */
  rank: number;
}

export interface GeoSummary {
  /** Valor total global acumulado de todos los territorios. */
  totalValue: number;
  /** Total de registros analizados. */
  totalRows: number;
  /** Cantidad de territorios distintos identificados. */
  territoryCount: number;
  /** Territorio con mayor volumen. */
  topTerritory: GeoTerritory | null;
  /** Concentración del Top 3 (% de volumen acumulado en los 3 mayores territorios). */
  top3Concentration: number;
  /** Concentración del Top 5 (% de volumen acumulado en los 5 mayores territorios). */
  top5Concentration: number;
  /** Promedio por territorio (`totalValue / territoryCount`). */
  avgPerTerritory: number;
  /** Índice de concentración Herfindahl-Hirschman (0 a 10.000). */
  herfindahlIndex: number;
}

export interface GeoMapResult {
  /** Lista de territorios ordenada por valor descendente. */
  territories: GeoTerritory[];
  /** Resumen general de métricas territoriales. */
  summary: GeoSummary;
  /** Filas ignoradas por falta de territorio o datos nulos. */
  ignoredRows: number;
}

export type GeoAggregation = 'sum' | 'avg' | 'count';

export interface GeoMapParams {
  /** Columna de dimensión geográfica (país, región, estado, etc.). */
  territoryDim: string;
  /** Columna de métrica numérica principal. */
  metricColumn: string;
  /** Columna de métrica numérica secundaria (opcional). */
  secondaryColumn?: string | null;
  /** Tipo de agregación (sum, avg, count). */
  aggregation?: GeoAggregation;
  /** Límite de territorios principales a mostrar (0 = todos). */
  topN?: number;
}

// Diccionario offline para normalización y asignación de zonas geográficas
const GEO_DICTIONARY: Record<string, { normalized: string; zone: string }> = {
  // España y Comunidades Autónomas
  es: { normalized: 'España', zone: 'España' },
  esp: { normalized: 'España', zone: 'España' },
  spain: { normalized: 'España', zone: 'España' },
  españa: { normalized: 'España', zone: 'España' },
  madrid: { normalized: 'Comunidad de Madrid', zone: 'España (Centro)' },
  'comunidad de madrid': { normalized: 'Comunidad de Madrid', zone: 'España (Centro)' },
  cataluña: { normalized: 'Cataluña', zone: 'España (Noreste)' },
  catalunya: { normalized: 'Cataluña', zone: 'España (Noreste)' },
  barcelona: { normalized: 'Barcelona', zone: 'España (Noreste)' },
  andalucía: { normalized: 'Andalucía', zone: 'España (Sur)' },
  andalucia: { normalized: 'Andalucía', zone: 'España (Sur)' },
  sevilla: { normalized: 'Sevilla', zone: 'España (Sur)' },
  valencia: { normalized: 'Comunidad Valenciana', zone: 'España (Este)' },
  'comunidad valenciana': { normalized: 'Comunidad Valenciana', zone: 'España (Este)' },
  galicia: { normalized: 'Galicia', zone: 'España (Noroeste)' },
  'país vasco': { normalized: 'País Vasco', zone: 'España (Norte)' },
  'pais vasco': { normalized: 'País Vasco', zone: 'España (Norte)' },
  euskadi: { normalized: 'País Vasco', zone: 'España (Norte)' },
  castilla: { normalized: 'Castilla y León', zone: 'España (Centro)' },
  'castilla y leon': { normalized: 'Castilla y León', zone: 'España (Centro)' },
  'castilla y león': { normalized: 'Castilla y León', zone: 'España (Centro)' },
  'castilla la mancha': { normalized: 'Castilla-La Mancha', zone: 'España (Centro)' },
  'castilla-la mancha': { normalized: 'Castilla-La Mancha', zone: 'España (Centro)' },
  canarias: { normalized: 'Canarias', zone: 'España (Islas)' },
  baleares: { normalized: 'Illes Balears', zone: 'España (Islas)' },
  aragon: { normalized: 'Aragón', zone: 'España (Noreste)' },
  aragón: { normalized: 'Aragón', zone: 'España (Noreste)' },
  murcia: { normalized: 'Región de Murcia', zone: 'España (Este)' },
  asturias: { normalized: 'Asturias', zone: 'España (Norte)' },
  navarra: { normalized: 'Navarra', zone: 'España (Norte)' },
  extremadura: { normalized: 'Extremadura', zone: 'España (Oeste)' },
  cantabria: { normalized: 'Cantabria', zone: 'España (Norte)' },
  'la rioja': { normalized: 'La Rioja', zone: 'España (Norte)' },

  // Países de América Latina
  mx: { normalized: 'México', zone: 'América Latina' },
  mex: { normalized: 'México', zone: 'América Latina' },
  mexico: { normalized: 'México', zone: 'América Latina' },
  méxico: { normalized: 'México', zone: 'América Latina' },
  cdmx: { normalized: 'Ciudad de México', zone: 'México' },
  jalisco: { normalized: 'Jalisco', zone: 'México' },
  'nuevo leon': { normalized: 'Nuevo León', zone: 'México' },
  'nuevo león': { normalized: 'Nuevo León', zone: 'México' },
  co: { normalized: 'Colombia', zone: 'América Latina' },
  col: { normalized: 'Colombia', zone: 'América Latina' },
  colombia: { normalized: 'Colombia', zone: 'América Latina' },
  bogota: { normalized: 'Bogotá', zone: 'Colombia' },
  bogotá: { normalized: 'Bogotá', zone: 'Colombia' },
  ar: { normalized: 'Argentina', zone: 'América Latina' },
  arg: { normalized: 'Argentina', zone: 'América Latina' },
  argentina: { normalized: 'Argentina', zone: 'América Latina' },
  'buenos aires': { normalized: 'Buenos Aires', zone: 'Argentina' },
  cl: { normalized: 'Chile', zone: 'América Latina' },
  chl: { normalized: 'Chile', zone: 'América Latina' },
  chile: { normalized: 'Chile', zone: 'América Latina' },
  santiago: { normalized: 'Santiago', zone: 'Chile' },
  pe: { normalized: 'Perú', zone: 'América Latina' },
  per: { normalized: 'Perú', zone: 'América Latina' },
  peru: { normalized: 'Perú', zone: 'América Latina' },
  perú: { normalized: 'Perú', zone: 'América Latina' },
  lima: { normalized: 'Lima', zone: 'Perú' },
  br: { normalized: 'Brasil', zone: 'América Latina' },
  bra: { normalized: 'Brasil', zone: 'América Latina' },
  brasil: { normalized: 'Brasil', zone: 'América Latina' },
  brazil: { normalized: 'Brasil', zone: 'América Latina' },

  // Países de Europa & Norteamérica
  us: { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  usa: { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  'united states': { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  'estados unidos': { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  ca: { normalized: 'Canadá', zone: 'Norteamérica' },
  can: { normalized: 'Canadá', zone: 'Norteamérica' },
  canada: { normalized: 'Canadá', zone: 'Norteamérica' },
  canadá: { normalized: 'Canadá', zone: 'Norteamérica' },
  uk: { normalized: 'Reino Unido', zone: 'Europa' },
  gbr: { normalized: 'Reino Unido', zone: 'Europa' },
  'united kingdom': { normalized: 'Reino Unido', zone: 'Europa' },
  'reino unido': { normalized: 'Reino Unido', zone: 'Europa' },
  fr: { normalized: 'Francia', zone: 'Europa' },
  fra: { normalized: 'Francia', zone: 'Europa' },
  france: { normalized: 'Francia', zone: 'Europa' },
  francia: { normalized: 'Francia', zone: 'Europa' },
  de: { normalized: 'Alemania', zone: 'Europa' },
  deu: { normalized: 'Alemania', zone: 'Europa' },
  germany: { normalized: 'Alemania', zone: 'Europa' },
  alemania: { normalized: 'Alemania', zone: 'Europa' },
  it: { normalized: 'Italia', zone: 'Europa' },
  ita: { normalized: 'Italia', zone: 'Europa' },
  italy: { normalized: 'Italia', zone: 'Europa' },
  italia: { normalized: 'Italia', zone: 'Europa' },
  pt: { normalized: 'Portugal', zone: 'Europa' },
  prt: { normalized: 'Portugal', zone: 'Europa' },
  portugal: { normalized: 'Portugal', zone: 'Europa' },
};

function lookupGeo(name: string): { normalized: string; zone: string } {
  const key = name.trim().toLowerCase();
  const match = GEO_DICTIONARY[key];
  if (match) return match;

  // Si no está en el diccionario, capitalizar y zona 'Territorio general'
  const normalized = name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return {
    normalized: normalized || name,
    zone: 'Territorio general',
  };
}

/**
 * Calcula la distribución territorial de métricas.
 * Agrupa por territorio normalizado para unificar códigos y nombres (ej. 'es' y 'España').
 */
export function computeGeoMap(
  rows: readonly AnalysisRow[],
  params: GeoMapParams,
): GeoMapResult {
  const {
    territoryDim,
    metricColumn,
    secondaryColumn = null,
    aggregation = 'sum',
    topN = 0,
  } = params;

  let ignoredRows = 0;

  interface Draft {
    rawTerritory: string;
    normalizedName: string;
    zone: string;
    sumVal: number;
    sumSec: number;
    count: number;
  }

  const drafts = new Map<string, Draft>();

  for (const row of rows) {
    const rawTerritory = row.dims[territoryDim];

    if (
      rawTerritory === undefined ||
      rawTerritory === EMPTY_LABEL ||
      rawTerritory.trim() === ''
    ) {
      ignoredRows += 1;
      continue;
    }

    const territory = rawTerritory.trim();
    const geoInfo = lookupGeo(territory);
    const groupKey = geoInfo.normalized.toLowerCase();

    const val = row.values[metricColumn] ?? 0;
    const secVal = secondaryColumn ? (row.values[secondaryColumn] ?? 0) : 0;

    const existing = drafts.get(groupKey);
    if (!existing) {
      drafts.set(groupKey, {
        rawTerritory: territory,
        normalizedName: geoInfo.normalized,
        zone: geoInfo.zone,
        sumVal: Number.isFinite(val) ? val : 0,
        sumSec: Number.isFinite(secVal) ? secVal : 0,
        count: 1,
      });
    } else {
      if (Number.isFinite(val)) existing.sumVal += val;
      if (Number.isFinite(secVal)) existing.sumSec += secVal;
      existing.count += 1;
    }
  }

  if (drafts.size === 0) {
    return {
      territories: [],
      summary: {
        totalValue: 0,
        totalRows: 0,
        territoryCount: 0,
        topTerritory: null,
        top3Concentration: 0,
        top5Concentration: 0,
        avgPerTerritory: 0,
        herfindahlIndex: 0,
      },
      ignoredRows,
    };
  }

  // 1. Calcular el valor de cada territorio según la agregación
  const rawList = Array.from(drafts.values()).map((draft) => {
    let value = draft.sumVal;
    let secondaryValue: number | null = secondaryColumn ? draft.sumSec : null;

    if (aggregation === 'avg') {
      value = draft.count > 0 ? draft.sumVal / draft.count : 0;
      if (secondaryColumn && secondaryValue !== null) {
        secondaryValue = draft.count > 0 ? draft.sumSec / draft.count : 0;
      }
    } else if (aggregation === 'count') {
      value = draft.count;
    }

    return {
      territory: draft.rawTerritory,
      normalizedName: draft.normalizedName,
      zone: draft.zone,
      value: Math.round(value * 100) / 100,
      secondaryValue: secondaryValue !== null ? Math.round(secondaryValue * 100) / 100 : null,
      rowCount: draft.count,
      avgPerRecord: draft.count > 0 ? Math.round((draft.sumVal / draft.count) * 100) / 100 : 0,
    };
  });

  // 2. Ordenar por valor descendente
  rawList.sort((a, b) => b.value - a.value);

  const totalValue = rawList.reduce((acc, item) => acc + (item.value > 0 ? item.value : 0), 0);
  const totalRows = rawList.reduce((acc, item) => acc + item.rowCount, 0);

  // 3. Asignar shares, acumulados y ranking
  let runningShare = 0;
  let hhi = 0;

  const territories: GeoTerritory[] = rawList.map((item, index) => {
    const share = totalValue > 0 ? Math.max(0, (item.value / totalValue) * 100) : 0;
    runningShare += share;
    hhi += Math.pow(share, 2);

    return {
      ...item,
      rank: index + 1,
      share: Math.round(share * 100) / 100,
      cumulativeShare: Math.min(100, Math.round(runningShare * 100) / 100),
    };
  });

  // Top 3 y Top 5 concentration
  const top3Concentration = territories.slice(0, 3).reduce((acc, t) => acc + t.share, 0);
  const top5Concentration = territories.slice(0, 5).reduce((acc, t) => acc + t.share, 0);

  const summary: GeoSummary = {
    totalValue: Math.round(totalValue * 100) / 100,
    totalRows,
    territoryCount: territories.length,
    topTerritory: territories[0] ?? null,
    top3Concentration: Math.round(top3Concentration * 100) / 100,
    top5Concentration: Math.round(top5Concentration * 100) / 100,
    avgPerTerritory: territories.length > 0 ? Math.round((totalValue / territories.length) * 100) / 100 : 0,
    herfindahlIndex: Math.round(hhi),
  };

  const finalTerritories = topN > 0 ? territories.slice(0, topN) : territories;

  return {
    territories: finalTerritories,
    summary,
    ignoredRows,
  };
}
