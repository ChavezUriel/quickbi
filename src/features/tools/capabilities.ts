import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import { sampleMatchesGeoEntities } from '@/features/dataset/lib/infer-subtype';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import type { DatasetCapabilities, DatasetSemantics } from './types';

/**
 * A partir de cuántos valores distintos una columna de texto deja de parecer
 * una clasificación y empieza a parecer un identificador.
 */
const IDENTIFIER_MIN_DISTINCT = 5;

export function isIdentifierCandidate(column: ColumnProfile): boolean {
  return column.distinctCount >= IDENTIFIER_MIN_DISTINCT;
}

/** Minúsculas, sin acentos ni espacios residuales para comparaciones coherentes. */
export function normalizeKeyword(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Comprueba si el nombre de una columna coincide o contiene palabras clave semánticas por tokens completos o frases. */
export function matchesKeyword(name: string, keywords: readonly string[]): boolean {
  const norm = normalizeKeyword(name);
  const words = norm.split(/[\s_\-./\\,;:()\[\]{}|<>]+/).filter(Boolean);

  return keywords.some((kw) => {
    const normKw = normalizeKeyword(kw);
    if (norm === normKw) return true;
    if (normKw.includes(' ') || normKw.includes('_')) {
      const phrase = normKw.replace(/_/g, ' ');
      const normPhrase = norm.replace(/_/g, ' ');
      if (normPhrase === phrase || normPhrase.includes(phrase)) return true;
    }
    if (words.includes(normKw)) return true;
    return false;
  });
}

/** Comprueba si alguna muestra de datos contiene valores representativos de una entidad por tokens completos. */
export function matchesSample(samples: readonly string[], keywords: readonly string[]): boolean {
  if (!samples || samples.length === 0) return false;
  return samples.some((sample) => {
    if (!sample) return false;
    const normSample = normalizeKeyword(sample);
    const tokens = normSample.split(/[\s_\-./\\,;:()\[\]{}|<>]+/).filter(Boolean);

    return keywords.some((kw) => {
      const normKw = normalizeKeyword(kw);
      return normSample === normKw || tokens.includes(normKw);
    });
  });
}

// ---------------------------------------------------------------------------
// Diccionarios de detección semántica
// ---------------------------------------------------------------------------

const CUSTOMER_KEYWORDS = [
  'cliente', 'customer', 'usuario', 'user', 'id_cliente', 'id_customer',
  'customer_id', 'client_id', 'user_id', 'client', 'cuenta', 'account',
  'email', 'correo', 'buyer', 'comprador', 'socio', 'contacto', 'contact',
  'titular', 'suscriptor', 'subscriber', 'member', 'paciente', 'alumno',
] as const;

const PRODUCT_KEYWORDS = [
  'producto', 'product', 'item', 'articulo', 'sku', 'servicio', 'service',
  'concepto', 'modelo', 'model', 'referencia', 'ref', 'nombre_producto',
  'item_name', 'product_name', 'item_id', 'product_id', 'catalogo',
] as const;

const ORDER_KEYWORDS = [
  'pedido', 'order', 'order_id', 'id_pedido', 'ticket', 'ticket_id',
  'id_ticket', 'factura', 'invoice', 'transaccion', 'transaction_id',
  'id_transaccion', 'recibo', 'receipt', 'cart_id', 'carrito', 'compra_id',
  'folio', 'operacion', 'basket_id', 'num_pedido', 'n_pedido',
] as const;

const GEO_KEYWORDS = [
  'pais', 'country', 'nacion', 'nation', 'region', 'provincia', 'province',
  'ciudad', 'city', 'municipio', 'poblacion', 'comunidad', 'ccaa',
  'territorio', 'territory', 'distrito', 'codigo_postal', 'postal_code',
  'zip_code', 'continente', 'continent', 'pais_destino', 'pais_origen',
  'pais_cliente', 'billing_country', 'shipping_country', 'country_code',
  'estado_provincia', 'state_province', 'zona_geografica', 'region_geografica',
] as const;

const GEO_DISQUALIFY_KEYWORDS = [
  'estado_civil', 'estado_cuenta', 'estado_pago', 'estado_factura', 'estado_solicitud',
  'estado_pedido', 'estado_transaccion', 'estado_ticket', 'estado_proceso',
  'estado_financiero', 'estado_animo', 'calle', 'avenida', 'street', 'address',
  'domicilio', 'direccion', 'ip_address', 'ip', 'mac_address', 'email_address',
  'zona_horaria', 'time_zone', 'timezone', 'cuenta_origen', 'cuenta_destino',
  'banco_origen', 'banco_destino', 'almacen_origen', 'almacen_destino',
] as const;

const INVENTORY_KEYWORDS = [
  'stock', 'existencias', 'almacen', 'almacenes', 'inventario', 'disponible',
  'unidades_stock', 'coste_stock', 'valor_inventario', 'dsi', 'warehouse',
  'qty_on_hand', 'reorder_level', 'bodega', 'rotacion', 'stock_minimo',
  'stock_maximo', 'dias_stock', 'dias_almacen', 'dias_inventario',
] as const;

const FUNNEL_KEYWORDS = [
  'etapa', 'fase', 'step', 'stage', 'funnel', 'pipeline', 'proceso',
  'conversion', 'nivel', 'paso', 'embudo', 'lead_status', 'lead_stage',
  'deal_stage', 'estado_proceso', 'journey_step', 'estado_pedido',
] as const;

const FUNNEL_SAMPLE_ENTITIES = [
  'lead', 'prospect', 'visita', 'registro', 'contacto', 'oportunidad',
  'propuesta', 'negociacion', 'ganado', 'perdido', 'checkout', 'pago',
  'carrito', 'iniciado', 'completado',
] as const;

const PRICE_KEYWORDS = [
  'precio', 'price', 'unit_price', 'precio_unitario', 'pvp', 'coste',
  'costo', 'cost', 'tarifa', 'valor_unitario', 'ticket_medio', 'rate',
  'fee', 'unit_cost', 'precio_venta',
] as const;

const VOLUME_KEYWORDS = [
  'cantidad', 'cant', 'qty', 'quantity', 'unidades', 'units', 'volumen',
  'volume', 'piezas', 'unids', 'numero_items', 'num_items', 'count',
] as const;

const RECONCILIATION_KEYWORDS = [
  'importe_a', 'importe_b', 'fuente_a', 'fuente_b', 'banco', 'contabilidad',
  'libro', 'sistema_1', 'sistema_2', 'saldo_banco', 'saldo_extracto',
  'debito', 'credito', 'total_esperado', 'total_real', 'diferencia',
  'diff', 'discrepancia', 'descuadre', 'cuadre', 'reconciliacion',
] as const;

/** Detecta la presencia de conceptos de negocio a partir de columnas y muestras. */
export function detectSemantics(mapping: ColumnMappingState): DatasetSemantics {
  const dimensions = mapping.dimensions;
  const measures = mapping.measures;

  // 1. Cliente (prioriza subtipo 'customer' o coincidencia de keywords)
  const explicitCustomer = dimensions.find((c) => c.subtype === 'customer');
  const fallbackCustomer = dimensions.find(
    (c) => c.subtype === undefined && matchesKeyword(c.name, CUSTOMER_KEYWORDS),
  );
  const candidateCustomer = dimensions.find(
    (c) => c.subtype === undefined && isIdentifierCandidate(c),
  );
  const customerCol = explicitCustomer ?? fallbackCustomer ?? candidateCustomer ?? null;

  // 2. Producto / SKU (prioriza subtipo 'product')
  const explicitProduct = dimensions.find((c) => c.subtype === 'product');
  const fallbackProduct = dimensions.find(
    (c) => c.subtype === undefined && matchesKeyword(c.name, PRODUCT_KEYWORDS),
  );
  const productCol = explicitProduct ?? fallbackProduct ?? null;

  // 3. Pedido / Transacción
  const orderCol = dimensions.find((c) => matchesKeyword(c.name, ORDER_KEYWORDS)) ?? null;

  // 4. Geografía (prioriza subtipo 'geo' ajustado por el usuario o detectado inteligentemente)
  const explicitGeo = dimensions.find((c) => c.subtype === 'geo');
  const fallbackGeo = dimensions.find(
    (c) =>
      c.subtype === undefined &&
      !matchesKeyword(c.name, GEO_DISQUALIFY_KEYWORDS) &&
      (matchesKeyword(c.name, GEO_KEYWORDS) || sampleMatchesGeoEntities(c.samples)),
  );
  const geoCol = explicitGeo ?? fallbackGeo ?? null;

  // 5. Inventario
  const invMeasure = measures.find((c) => matchesKeyword(c.name, INVENTORY_KEYWORDS));
  const invDim = dimensions.find((c) => matchesKeyword(c.name, INVENTORY_KEYWORDS));
  const inventoryCol = invMeasure?.name ?? invDim?.name ?? null;

  // 6. Embudo / Etapas
  const explicitFunnel = dimensions.find((c) => c.subtype === 'funnel_stage');
  const fallbackFunnel = dimensions.find(
    (c) =>
      c.subtype === undefined &&
      (matchesKeyword(c.name, FUNNEL_KEYWORDS) ||
        (c.distinctCount >= 2 && c.distinctCount <= 15 && matchesSample(c.samples, FUNNEL_SAMPLE_ENTITIES))),
  );
  const funnelCol = explicitFunnel ?? fallbackFunnel ?? null;

  // 7. Precio / Moneda
  const explicitPrice = measures.find((c) => c.subtype === 'currency');
  const fallbackPrice = measures.find(
    (c) => c.subtype === undefined && matchesKeyword(c.name, PRICE_KEYWORDS),
  );
  const priceCol = explicitPrice ?? fallbackPrice ?? null;

  // 8. Volumen / Cantidad
  const explicitVolume = measures.find((c) => c.subtype === 'integer');
  const fallbackVolume = measures.find(
    (c) => c.subtype === undefined && matchesKeyword(c.name, VOLUME_KEYWORDS),
  );
  const volumeCol = explicitVolume ?? fallbackVolume ?? null;

  // 9. Conciliación
  const reconMeasures = measures.filter((c) => matchesKeyword(c.name, RECONCILIATION_KEYWORDS));
  const hasReconciliation = reconMeasures.length >= 2 || (measures.length >= 2 && dimensions.some(isIdentifierCandidate));
  const reconciliationColumns = reconMeasures.map((c) => c.name);

  return {
    hasCustomer: customerCol !== null,
    customerColumn: customerCol?.name ?? null,
    hasProduct: productCol !== null,
    productColumn: productCol?.name ?? null,
    hasOrder: orderCol !== null,
    orderColumn: orderCol?.name ?? null,
    hasGeo: geoCol !== null,
    geoColumn: geoCol?.name ?? null,
    hasInventory: inventoryCol !== null,
    inventoryColumn: inventoryCol,
    hasFunnelStage: funnelCol !== null,
    funnelColumn: funnelCol?.name ?? null,
    hasPrice: priceCol !== null,
    priceColumn: priceCol?.name ?? null,
    hasVolume: volumeCol !== null,
    volumeColumn: volumeCol?.name ?? null,
    hasReconciliation,
    reconciliationColumns,
  };
}

/** Qué ofrece el dataset, resumido y analizado semánticamente para decidir qué herramientas caben. */
export function datasetCapabilities(mapping: ColumnMappingState): DatasetCapabilities {
  const rows = mapping.effectiveRowCount;
  const identifiers = mapping.dimensions.filter(isIdentifierCandidate);

  return {
    rowCount: rows,
    columnCount: mapping.columns.length,
    dates: mapping.dateColumns.length,
    dimensions: mapping.dimensions.length,
    measures: mapping.measures.length,
    identifiers: identifiers.length,

    dateColumnNames: mapping.dateColumns.map((c) => c.name),
    dimensionNames: mapping.dimensions.map((c) => c.name),
    measureNames: mapping.measures.map((c) => c.name),
    identifierNames: identifiers.map((c) => c.name),

    semantics: detectSemantics(mapping),
  };
}

