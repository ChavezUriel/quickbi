import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';

/**
 * Catálogo de herramientas de análisis.
 *
 * Un dataset no tiene una única lectura correcta: la misma tabla de ventas se
 * puede cruzar por categorías, resumir en una tabla dinámica o segmentar por
 * cliente. Cada una de esas lecturas es una herramienta, y todas comparten lo
 * mismo —el dataset ya tipado y las filas normalizadas— y se diferencian en
 * qué le piden al usuario y qué le enseñan.
 */

export type CompatibilityScore = 'recommended' | 'compatible' | 'incompatible';

export interface DatasetSemantics {
  hasCustomer: boolean;
  customerColumn: string | null;
  hasProduct: boolean;
  productColumn: string | null;
  hasOrder: boolean;
  orderColumn: string | null;
  hasGeo: boolean;
  geoColumn: string | null;
  hasInventory: boolean;
  inventoryColumn: string | null;
  hasFunnelStage: boolean;
  funnelColumn: string | null;
  hasPrice: boolean;
  priceColumn: string | null;
  hasVolume: boolean;
  volumeColumn: string | null;
  hasReconciliation: boolean;
  reconciliationColumns: string[];
}

/** Qué le pide una herramienta al dataset para poder funcionar. */
export interface DatasetCapabilities {
  rowCount: number;
  columnCount: number;
  /** Columnas de fecha: candidatas a eje temporal. */
  dates: number;
  /** Columnas de texto o booleanas: categorías por las que agrupar. */
  dimensions: number;
  /** Columnas numéricas: lo único que se puede agregar. */
  measures: number;
  /**
   * Dimensiones con cardinalidad alta: candidatas a identificar una entidad
   * (cliente, pedido, producto) y no a clasificarla.
   */
  identifiers: number;

  /** Nombres de columnas clasificadas */
  dateColumnNames: string[];
  dimensionNames: string[];
  measureNames: string[];
  identifierNames: string[];

  /** Detección semántica de entidades */
  semantics: DatasetSemantics;
}

/** Veredicto de si el dataset da para una herramienta, y por qué no. */
export interface ToolAvailability {
  available: boolean;
  score: CompatibilityScore;
  /** Qué falta cuando no está disponible, o por qué es recomendada cuando lo está. */
  reason: string | null;
  /** Nombres de columnas clave detectadas que encajan con la herramienta */
  matchedColumns?: string[];
}

export const AVAILABLE: ToolAvailability = {
  available: true,
  score: 'compatible',
  reason: null,
};

export function recommended(reason: string, matchedColumns?: string[]): ToolAvailability {
  return { available: true, score: 'recommended', reason, matchedColumns };
}

export function compatible(reason?: string | null, matchedColumns?: string[]): ToolAvailability {
  return { available: true, score: 'compatible', reason: reason ?? null, matchedColumns };
}

export function missing(reason: string): ToolAvailability {
  return { available: false, score: 'incompatible', reason };
}

/** Los dos paneles de una herramienta: su configuración y su resultado. */
export type ToolView = 'configuracion' | 'cuadro';

export interface ToolWorkspaceProps {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  /** Panel visible. El otro sigue montado, oculto, para no perder su estado. */
  view: ToolView;
  /** El cuadro de mando se clava a la altura de la ventana. */
  fill: boolean;
  /**
   * Comunica al asistente si la configuración basta para pintar el cuadro de
   * mando: es lo que habilita el botón de avanzar.
   */
  onReady: (ready: boolean) => void;
}

export type ToolCategory = 'general' | 'temporal' | 'clientes' | 'situacional';

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  general: 'Para cualquier tabla',
  temporal: 'Series de tiempo',
  clientes: 'Clientes y ventas',
  situacional: 'Herramientas situacionales',
};

export interface ToolDefinition {
  id: string;
  /** Nombre en la galería y en el indicador de pasos. */
  label: string;
  /** Una línea: qué contesta la herramienta. */
  tagline: string;
  /** Un párrafo corto: cómo lo contesta y para qué datos sirve. */
  description: string;
  icon: LucideIcon;
  category: ToolCategory;
  /** Qué necesita del dataset, dicho en la tarjeta antes de elegirla. */
  needs: string[];
  /**
   * `false` cuando la herramienta no tiene nada que preguntar: el asistente se
   * salta el paso de configuración en vez de enseñar una pantalla vacía.
   */
  hasSetup: boolean;
  /** El cuadro de mando quiere la ventana entera en pantallas anchas. */
  fill: boolean;
  requires: (capabilities: DatasetCapabilities) => ToolAvailability;
  Workspace: ComponentType<ToolWorkspaceProps>;
}
