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

// Función auxiliar para normalizar claves sin acentos ni espacios residuales
function normalizeGeoKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Diccionario offline para normalización y asignación de zonas geográficas (claves normalizadas sin acentos)
const GEO_DICTIONARY: Record<string, { normalized: string; zone: string }> = {
  // España y Comunidades Autónomas
  es: { normalized: 'España', zone: 'España' },
  esp: { normalized: 'España', zone: 'España' },
  spain: { normalized: 'España', zone: 'España' },
  espana: { normalized: 'España', zone: 'España' },
  madrid: { normalized: 'Comunidad de Madrid', zone: 'España (Centro)' },
  'comunidad de madrid': { normalized: 'Comunidad de Madrid', zone: 'España (Centro)' },
  cataluna: { normalized: 'Cataluña', zone: 'España (Noreste)' },
  catalunya: { normalized: 'Cataluña', zone: 'España (Noreste)' },
  barcelona: { normalized: 'Barcelona', zone: 'España (Noreste)' },
  girona: { normalized: 'Girona', zone: 'España (Noreste)' },
  tarragona: { normalized: 'Tarragona', zone: 'España (Noreste)' },
  lleida: { normalized: 'Lleida', zone: 'España (Noreste)' },
  andalucia: { normalized: 'Andalucía', zone: 'España (Sur)' },
  sevilla: { normalized: 'Sevilla', zone: 'España (Sur)' },
  malaga: { normalized: 'Málaga', zone: 'España (Sur)' },
  granada: { normalized: 'Granada', zone: 'España (Sur)' },
  cordoba: { normalized: 'Córdoba', zone: 'España (Sur)' },
  cadiz: { normalized: 'Cádiz', zone: 'España (Sur)' },
  almeria: { normalized: 'Almería', zone: 'España (Sur)' },
  jaen: { normalized: 'Jaén', zone: 'España (Sur)' },
  huelva: { normalized: 'Huelva', zone: 'España (Sur)' },
  valencia: { normalized: 'Comunidad Valenciana', zone: 'España (Este)' },
  'comunidad valenciana': { normalized: 'Comunidad Valenciana', zone: 'España (Este)' },
  alicante: { normalized: 'Alicante', zone: 'España (Este)' },
  castellon: { normalized: 'Castellón', zone: 'España (Este)' },
  galicia: { normalized: 'Galicia', zone: 'España (Noroeste)' },
  'a coruna': { normalized: 'A Coruña', zone: 'España (Noroeste)' },
  coruna: { normalized: 'A Coruña', zone: 'España (Noroeste)' },
  pontevedra: { normalized: 'Pontevedra', zone: 'España (Noroeste)' },
  vigo: { normalized: 'Vigo', zone: 'España (Noroeste)' },
  lugo: { normalized: 'Lugo', zone: 'España (Noroeste)' },
  ourense: { normalized: 'Ourense', zone: 'España (Noroeste)' },
  'pais vasco': { normalized: 'País Vasco', zone: 'España (Norte)' },
  euskadi: { normalized: 'País Vasco', zone: 'España (Norte)' },
  bilbao: { normalized: 'Bilbao', zone: 'España (Norte)' },
  bizkaia: { normalized: 'Bizkaia', zone: 'España (Norte)' },
  vizcaya: { normalized: 'Bizkaia', zone: 'España (Norte)' },
  gipuzkoa: { normalized: 'Gipuzkoa', zone: 'España (Norte)' },
  guipuzcoa: { normalized: 'Gipuzkoa', zone: 'España (Norte)' },
  'san sebastian': { normalized: 'Donostia-San Sebastián', zone: 'España (Norte)' },
  alava: { normalized: 'Álava', zone: 'España (Norte)' },
  vitoria: { normalized: 'Vitoria-Gasteiz', zone: 'España (Norte)' },
  castilla: { normalized: 'Castilla y León', zone: 'España (Centro)' },
  'castilla y leon': { normalized: 'Castilla y León', zone: 'España (Centro)' },
  valladolid: { normalized: 'Valladolid', zone: 'España (Centro)' },
  burgos: { normalized: 'Burgos', zone: 'España (Centro)' },
  salamanca: { normalized: 'Salamanca', zone: 'España (Centro)' },
  leon: { normalized: 'León', zone: 'España (Centro)' },
  'castilla la mancha': { normalized: 'Castilla-La Mancha', zone: 'España (Centro)' },
  'castilla-la mancha': { normalized: 'Castilla-La Mancha', zone: 'España (Centro)' },
  toledo: { normalized: 'Toledo', zone: 'España (Centro)' },
  albacete: { normalized: 'Albacete', zone: 'España (Centro)' },
  canarias: { normalized: 'Canarias', zone: 'España (Islas)' },
  'las palmas': { normalized: 'Las Palmas', zone: 'España (Islas)' },
  tenerife: { normalized: 'Santa Cruz de Tenerife', zone: 'España (Islas)' },
  'santa cruz de tenerife': { normalized: 'Santa Cruz de Tenerife', zone: 'España (Islas)' },
  baleares: { normalized: 'Illes Balears', zone: 'España (Islas)' },
  'illes balears': { normalized: 'Illes Balears', zone: 'España (Islas)' },
  'islas baleares': { normalized: 'Illes Balears', zone: 'España (Islas)' },
  mallorca: { normalized: 'Mallorca', zone: 'España (Islas)' },
  palma: { normalized: 'Palma de Mallorca', zone: 'España (Islas)' },
  aragon: { normalized: 'Aragón', zone: 'España (Noreste)' },
  zaragoza: { normalized: 'Zaragoza', zone: 'España (Noreste)' },
  murcia: { normalized: 'Región de Murcia', zone: 'España (Este)' },
  'region de murcia': { normalized: 'Región de Murcia', zone: 'España (Este)' },
  asturias: { normalized: 'Asturias', zone: 'España (Norte)' },
  oviedo: { normalized: 'Oviedo', zone: 'España (Norte)' },
  gijon: { normalized: 'Gijón', zone: 'España (Norte)' },
  navarra: { normalized: 'Navarra', zone: 'España (Norte)' },
  pamplona: { normalized: 'Pamplona', zone: 'España (Norte)' },
  extremadura: { normalized: 'Extremadura', zone: 'España (Oeste)' },
  badajoz: { normalized: 'Badajoz', zone: 'España (Oeste)' },
  caceres: { normalized: 'Cáceres', zone: 'España (Oeste)' },
  cantabria: { normalized: 'Cantabria', zone: 'España (Norte)' },
  santander: { normalized: 'Santander', zone: 'España (Norte)' },
  'la rioja': { normalized: 'La Rioja', zone: 'España (Norte)' },
  logrono: { normalized: 'Logroño', zone: 'España (Norte)' },
  ceuta: { normalized: 'Ceuta', zone: 'España (Norte de África)' },
  melilla: { normalized: 'Melilla', zone: 'España (Norte de África)' },

  // Países de América Latina
  mx: { normalized: 'México', zone: 'América Latina' },
  mex: { normalized: 'México', zone: 'América Latina' },
  mexico: { normalized: 'México', zone: 'América Latina' },
  cdmx: { normalized: 'Ciudad de México', zone: 'México' },
  'ciudad de mexico': { normalized: 'Ciudad de México', zone: 'México' },
  df: { normalized: 'Ciudad de México', zone: 'México' },
  jalisco: { normalized: 'Jalisco', zone: 'México' },
  'nuevo leon': { normalized: 'Nuevo León', zone: 'México' },
  monterrey: { normalized: 'Monterrey', zone: 'México' },
  puebla: { normalized: 'Puebla', zone: 'México' },
  co: { normalized: 'Colombia', zone: 'América Latina' },
  col: { normalized: 'Colombia', zone: 'América Latina' },
  colombia: { normalized: 'Colombia', zone: 'América Latina' },
  bogota: { normalized: 'Bogotá', zone: 'Colombia' },
  medellin: { normalized: 'Medellín', zone: 'Colombia' },
  antioquia: { normalized: 'Antioquia', zone: 'Colombia' },
  cali: { normalized: 'Cali', zone: 'Colombia' },
  ar: { normalized: 'Argentina', zone: 'América Latina' },
  arg: { normalized: 'Argentina', zone: 'América Latina' },
  argentina: { normalized: 'Argentina', zone: 'América Latina' },
  'buenos aires': { normalized: 'Buenos Aires', zone: 'Argentina' },
  caba: { normalized: 'Buenos Aires', zone: 'Argentina' },
  rosario: { normalized: 'Rosario', zone: 'Argentina' },
  cl: { normalized: 'Chile', zone: 'América Latina' },
  chl: { normalized: 'Chile', zone: 'América Latina' },
  chile: { normalized: 'Chile', zone: 'América Latina' },
  santiago: { normalized: 'Santiago', zone: 'Chile' },
  valparaiso: { normalized: 'Valparaíso', zone: 'Chile' },
  pe: { normalized: 'Perú', zone: 'América Latina' },
  per: { normalized: 'Perú', zone: 'América Latina' },
  peru: { normalized: 'Perú', zone: 'América Latina' },
  lima: { normalized: 'Lima', zone: 'Perú' },
  arequipa: { normalized: 'Arequipa', zone: 'Perú' },
  br: { normalized: 'Brasil', zone: 'América Latina' },
  bra: { normalized: 'Brasil', zone: 'América Latina' },
  brasil: { normalized: 'Brasil', zone: 'América Latina' },
  brazil: { normalized: 'Brasil', zone: 'América Latina' },
  'sao paulo': { normalized: 'São Paulo', zone: 'Brasil' },
  'rio de janeiro': { normalized: 'Río de Janeiro', zone: 'Brasil' },
  ec: { normalized: 'Ecuador', zone: 'América Latina' },
  ecu: { normalized: 'Ecuador', zone: 'América Latina' },
  ecuador: { normalized: 'Ecuador', zone: 'América Latina' },
  quito: { normalized: 'Quito', zone: 'Ecuador' },
  guayaquil: { normalized: 'Guayaquil', zone: 'Ecuador' },
  ve: { normalized: 'Venezuela', zone: 'América Latina' },
  ven: { normalized: 'Venezuela', zone: 'América Latina' },
  venezuela: { normalized: 'Venezuela', zone: 'América Latina' },
  caracas: { normalized: 'Caracas', zone: 'Venezuela' },
  uy: { normalized: 'Uruguay', zone: 'América Latina' },
  ury: { normalized: 'Uruguay', zone: 'América Latina' },
  uruguay: { normalized: 'Uruguay', zone: 'América Latina' },
  montevideo: { normalized: 'Montevideo', zone: 'Uruguay' },
  py: { normalized: 'Paraguay', zone: 'América Latina' },
  pry: { normalized: 'Paraguay', zone: 'América Latina' },
  paraguay: { normalized: 'Paraguay', zone: 'América Latina' },
  asuncion: { normalized: 'Asunción', zone: 'Paraguay' },
  bo: { normalized: 'Bolivia', zone: 'América Latina' },
  bol: { normalized: 'Bolivia', zone: 'América Latina' },
  bolivia: { normalized: 'Bolivia', zone: 'América Latina' },
  'la paz': { normalized: 'La Paz', zone: 'Bolivia' },
  'santa cruz': { normalized: 'Santa Cruz', zone: 'Bolivia' },
  pa: { normalized: 'Panamá', zone: 'América Latina' },
  pan: { normalized: 'Panamá', zone: 'América Latina' },
  panama: { normalized: 'Panamá', zone: 'América Latina' },
  cr: { normalized: 'Costa Rica', zone: 'América Latina' },
  cri: { normalized: 'Costa Rica', zone: 'América Latina' },
  'costa rica': { normalized: 'Costa Rica', zone: 'América Latina' },
  gt: { normalized: 'Guatemala', zone: 'América Latina' },
  gtm: { normalized: 'Guatemala', zone: 'América Latina' },
  guatemala: { normalized: 'Guatemala', zone: 'América Latina' },
  hn: { normalized: 'Honduras', zone: 'América Latina' },
  hnd: { normalized: 'Honduras', zone: 'América Latina' },
  honduras: { normalized: 'Honduras', zone: 'América Latina' },
  sv: { normalized: 'El Salvador', zone: 'América Latina' },
  slv: { normalized: 'El Salvador', zone: 'América Latina' },
  'el salvador': { normalized: 'El Salvador', zone: 'América Latina' },
  ni: { normalized: 'Nicaragua', zone: 'América Latina' },
  nic: { normalized: 'Nicaragua', zone: 'América Latina' },
  nicaragua: { normalized: 'Nicaragua', zone: 'América Latina' },
  do: { normalized: 'República Dominicana', zone: 'América Latina' },
  dom: { normalized: 'República Dominicana', zone: 'América Latina' },
  'republica dominicana': { normalized: 'República Dominicana', zone: 'América Latina' },
  'dominican republic': { normalized: 'República Dominicana', zone: 'América Latina' },
  pr: { normalized: 'Puerto Rico', zone: 'América Latina' },
  pri: { normalized: 'Puerto Rico', zone: 'América Latina' },
  'puerto rico': { normalized: 'Puerto Rico', zone: 'América Latina' },
  cu: { normalized: 'Cuba', zone: 'América Latina' },
  cub: { normalized: 'Cuba', zone: 'América Latina' },
  cuba: { normalized: 'Cuba', zone: 'América Latina' },

  // Países de Europa & Norteamérica
  us: { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  usa: { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  eeuu: { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  'ee.uu.': { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  'ee uu': { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  'united states': { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  'estados unidos': { normalized: 'Estados Unidos', zone: 'Norteamérica' },
  ca: { normalized: 'Canadá', zone: 'Norteamérica' },
  can: { normalized: 'Canadá', zone: 'Norteamérica' },
  canada: { normalized: 'Canadá', zone: 'Norteamérica' },
  uk: { normalized: 'Reino Unido', zone: 'Europa' },
  gbr: { normalized: 'Reino Unido', zone: 'Europa' },
  gb: { normalized: 'Reino Unido', zone: 'Europa' },
  'united kingdom': { normalized: 'Reino Unido', zone: 'Europa' },
  'reino unido': { normalized: 'Reino Unido', zone: 'Europa' },
  'gran bretana': { normalized: 'Reino Unido', zone: 'Europa' },
  'great britain': { normalized: 'Reino Unido', zone: 'Europa' },
  england: { normalized: 'Inglaterra', zone: 'Europa' },
  inglaterra: { normalized: 'Inglaterra', zone: 'Europa' },
  scotland: { normalized: 'Escocia', zone: 'Europa' },
  escocia: { normalized: 'Escocia', zone: 'Europa' },
  fr: { normalized: 'Francia', zone: 'Europa' },
  fra: { normalized: 'Francia', zone: 'Europa' },
  france: { normalized: 'Francia', zone: 'Europa' },
  francia: { normalized: 'Francia', zone: 'Europa' },
  paris: { normalized: 'París', zone: 'Francia' },
  de: { normalized: 'Alemania', zone: 'Europa' },
  deu: { normalized: 'Alemania', zone: 'Europa' },
  germany: { normalized: 'Alemania', zone: 'Europa' },
  alemania: { normalized: 'Alemania', zone: 'Europa' },
  deutschland: { normalized: 'Alemania', zone: 'Europa' },
  berlin: { normalized: 'Berlín', zone: 'Alemania' },
  it: { normalized: 'Italia', zone: 'Europa' },
  ita: { normalized: 'Italia', zone: 'Europa' },
  italy: { normalized: 'Italia', zone: 'Europa' },
  italia: { normalized: 'Italia', zone: 'Europa' },
  roma: { normalized: 'Roma', zone: 'Italia' },
  milan: { normalized: 'Milán', zone: 'Italia' },
  pt: { normalized: 'Portugal', zone: 'Europa' },
  prt: { normalized: 'Portugal', zone: 'Europa' },
  portugal: { normalized: 'Portugal', zone: 'Europa' },
  lisboa: { normalized: 'Lisboa', zone: 'Portugal' },
  lisbon: { normalized: 'Lisboa', zone: 'Portugal' },
  porto: { normalized: 'Oporto', zone: 'Portugal' },
  nl: { normalized: 'Países Bajos', zone: 'Europa' },
  nld: { normalized: 'Países Bajos', zone: 'Europa' },
  netherlands: { normalized: 'Países Bajos', zone: 'Europa' },
  'paises bajos': { normalized: 'Países Bajos', zone: 'Europa' },
  holanda: { normalized: 'Países Bajos', zone: 'Europa' },
  amsterdam: { normalized: 'Ámsterdam', zone: 'Países Bajos' },
  be: { normalized: 'Bélgica', zone: 'Europa' },
  bel: { normalized: 'Bélgica', zone: 'Europa' },
  belgium: { normalized: 'Bélgica', zone: 'Europa' },
  belgica: { normalized: 'Bélgica', zone: 'Europa' },
  bruselas: { normalized: 'Bruselas', zone: 'Bélgica' },
  ch: { normalized: 'Suiza', zone: 'Europa' },
  che: { normalized: 'Suiza', zone: 'Europa' },
  switzerland: { normalized: 'Suiza', zone: 'Europa' },
  suiza: { normalized: 'Suiza', zone: 'Europa' },
  at: { normalized: 'Austria', zone: 'Europa' },
  aut: { normalized: 'Austria', zone: 'Europa' },
  austria: { normalized: 'Austria', zone: 'Europa' },
  viena: { normalized: 'Viena', zone: 'Austria' },
  se: { normalized: 'Suecia', zone: 'Europa' },
  swe: { normalized: 'Suecia', zone: 'Europa' },
  sweden: { normalized: 'Suecia', zone: 'Europa' },
  suecia: { normalized: 'Suecia', zone: 'Europa' },
  no: { normalized: 'Noruega', zone: 'Europa' },
  nor: { normalized: 'Noruega', zone: 'Europa' },
  norway: { normalized: 'Noruega', zone: 'Europa' },
  noruega: { normalized: 'Noruega', zone: 'Europa' },
  dk: { normalized: 'Dinamarca', zone: 'Europa' },
  dnk: { normalized: 'Dinamarca', zone: 'Europa' },
  denmark: { normalized: 'Dinamarca', zone: 'Europa' },
  dinamarca: { normalized: 'Dinamarca', zone: 'Europa' },
  fi: { normalized: 'Finlandia', zone: 'Europa' },
  fin: { normalized: 'Finlandia', zone: 'Europa' },
  finland: { normalized: 'Finlandia', zone: 'Europa' },
  finlandia: { normalized: 'Finlandia', zone: 'Europa' },
  ie: { normalized: 'Irlanda', zone: 'Europa' },
  irl: { normalized: 'Irlanda', zone: 'Europa' },
  ireland: { normalized: 'Irlanda', zone: 'Europa' },
  irlanda: { normalized: 'Irlanda', zone: 'Europa' },
  pl: { normalized: 'Polonia', zone: 'Europa' },
  pol: { normalized: 'Polonia', zone: 'Europa' },
  poland: { normalized: 'Polonia', zone: 'Europa' },
  polonia: { normalized: 'Polonia', zone: 'Europa' },
  gr: { normalized: 'Grecia', zone: 'Europa' },
  grc: { normalized: 'Grecia', zone: 'Europa' },
  greece: { normalized: 'Grecia', zone: 'Europa' },
  grecia: { normalized: 'Grecia', zone: 'Europa' },
  cz: { normalized: 'República Checa', zone: 'Europa' },
  cze: { normalized: 'República Checa', zone: 'Europa' },
  czechia: { normalized: 'República Checa', zone: 'Europa' },
  'republica checa': { normalized: 'República Checa', zone: 'Europa' },

  // Asia-Pacífico y Resto del Mundo
  cn: { normalized: 'China', zone: 'Asia-Pacífico' },
  chn: { normalized: 'China', zone: 'Asia-Pacífico' },
  china: { normalized: 'China', zone: 'Asia-Pacífico' },
  jp: { normalized: 'Japón', zone: 'Asia-Pacífico' },
  jpn: { normalized: 'Japón', zone: 'Asia-Pacífico' },
  japan: { normalized: 'Japón', zone: 'Asia-Pacífico' },
  japon: { normalized: 'Japón', zone: 'Asia-Pacífico' },
  tokyo: { normalized: 'Tokio', zone: 'Japón' },
  in: { normalized: 'India', zone: 'Asia-Pacífico' },
  ind: { normalized: 'India', zone: 'Asia-Pacífico' },
  india: { normalized: 'India', zone: 'Asia-Pacífico' },
  au: { normalized: 'Australia', zone: 'Asia-Pacífico' },
  aus: { normalized: 'Australia', zone: 'Asia-Pacífico' },
  australia: { normalized: 'Australia', zone: 'Asia-Pacífico' },
  sydney: { normalized: 'Sídney', zone: 'Australia' },
  nz: { normalized: 'Nueva Zelanda', zone: 'Asia-Pacífico' },
  nzl: { normalized: 'Nueva Zelanda', zone: 'Asia-Pacífico' },
  'new zealand': { normalized: 'Nueva Zelanda', zone: 'Asia-Pacífico' },
  'nueva zelanda': { normalized: 'Nueva Zelanda', zone: 'Asia-Pacífico' },
  kr: { normalized: 'Corea del Sur', zone: 'Asia-Pacífico' },
  kor: { normalized: 'Corea del Sur', zone: 'Asia-Pacífico' },
  'south korea': { normalized: 'Corea del Sur', zone: 'Asia-Pacífico' },
  'corea del sur': { normalized: 'Corea del Sur', zone: 'Asia-Pacífico' },
  sg: { normalized: 'Singapur', zone: 'Asia-Pacífico' },
  sgp: { normalized: 'Singapur', zone: 'Asia-Pacífico' },
  singapore: { normalized: 'Singapur', zone: 'Asia-Pacífico' },
  singapur: { normalized: 'Singapur', zone: 'Asia-Pacífico' },
  za: { normalized: 'Sudáfrica', zone: 'África y Oriente Medio' },
  zaf: { normalized: 'Sudáfrica', zone: 'África y Oriente Medio' },
  'south africa': { normalized: 'Sudáfrica', zone: 'África y Oriente Medio' },
  sudafrica: { normalized: 'Sudáfrica', zone: 'África y Oriente Medio' },
  ae: { normalized: 'Emiratos Árabes Unidos', zone: 'África y Oriente Medio' },
  are: { normalized: 'Emiratos Árabes Unidos', zone: 'África y Oriente Medio' },
  uae: { normalized: 'Emiratos Árabes Unidos', zone: 'África y Oriente Medio' },
  'emiratos arabes unidos': { normalized: 'Emiratos Árabes Unidos', zone: 'África y Oriente Medio' },
  dubai: { normalized: 'Dubái', zone: 'Emiratos Árabes Unidos' },
  sa: { normalized: 'Arabia Saudita', zone: 'África y Oriente Medio' },
  sau: { normalized: 'Arabia Saudita', zone: 'África y Oriente Medio' },
  'saudi arabia': { normalized: 'Arabia Saudita', zone: 'África y Oriente Medio' },
  'arabia saudi': { normalized: 'Arabia Saudita', zone: 'África y Oriente Medio' },
  il: { normalized: 'Israel', zone: 'África y Oriente Medio' },
  isr: { normalized: 'Israel', zone: 'África y Oriente Medio' },
  israel: { normalized: 'Israel', zone: 'África y Oriente Medio' },
  ma: { normalized: 'Marruecos', zone: 'África y Oriente Medio' },
  mar: { normalized: 'Marruecos', zone: 'África y Oriente Medio' },
  morocco: { normalized: 'Marruecos', zone: 'África y Oriente Medio' },
  marruecos: { normalized: 'Marruecos', zone: 'África y Oriente Medio' },
};

export function lookupGeo(name: string): { normalized: string; zone: string } {
  const key = normalizeGeoKey(name);
  const match = GEO_DICTIONARY[key];
  if (match) return match;

  // Si no está en el diccionario, capitalizar y asignar a zona 'Territorio general'
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
    const groupKey = normalizeGeoKey(geoInfo.normalized);

    const val = metricColumn ? (row.values[metricColumn] ?? 0) : 0;
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

  const totalValue = rawList.reduce((acc, item) => acc + item.value, 0);
  const totalPositive = rawList.reduce((acc, item) => acc + (item.value > 0 ? item.value : 0), 0);
  const baseValue = totalPositive > 0 ? totalPositive : (totalValue > 0 ? totalValue : 0);
  const totalRows = rawList.reduce((acc, item) => acc + item.rowCount, 0);

  // 3. Asignar shares, acumulados y ranking
  let runningShare = 0;
  let hhi = 0;

  const territories: GeoTerritory[] = rawList.map((item, index) => {
    const share = baseValue > 0 ? Math.max(0, (item.value / baseValue) * 100) : 0;
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
