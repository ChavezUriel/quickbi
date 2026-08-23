import { describe, expect, it } from 'vitest';
import { inferColumnSubtype } from './infer-subtype';

describe('inferColumnSubtype', () => {
  describe('number subtypes', () => {
    it('detects currency from column names', () => {
      expect(inferColumnSubtype({ name: 'precio_unitario', type: 'number' })).toBe('currency');
      expect(inferColumnSubtype({ name: 'total_ventas', type: 'number' })).toBe('currency');
      expect(inferColumnSubtype({ name: 'revenue', type: 'number' })).toBe('currency');
      expect(inferColumnSubtype({ name: 'costo', type: 'number' })).toBe('currency');
      expect(inferColumnSubtype({ name: 'importe', type: 'number' })).toBe('currency');
    });

    it('detects currency from sample symbols', () => {
      expect(inferColumnSubtype({ name: 'valor', type: 'number', samples: ['$10.00', '$20.00'] })).toBe('currency');
      expect(inferColumnSubtype({ name: 'monto', type: 'number', samples: ['15.00 €', '30.00 €'] })).toBe('currency');
    });

    it('detects percentages', () => {
      expect(inferColumnSubtype({ name: 'tasa_descuento', type: 'number' })).toBe('percentage');
      expect(inferColumnSubtype({ name: 'margen_pct', type: 'number' })).toBe('percentage');
      expect(inferColumnSubtype({ name: 'conversion_rate', type: 'number' })).toBe('percentage');
      expect(inferColumnSubtype({ name: 'share', type: 'number', samples: ['12%', '45%'] })).toBe('percentage');
    });

    it('detects duration and time intervals', () => {
      expect(inferColumnSubtype({ name: 'dias_entrega', type: 'number' })).toBe('duration');
      expect(inferColumnSubtype({ name: 'duracion_segundos', type: 'number' })).toBe('duration');
      expect(inferColumnSubtype({ name: 'dsi', type: 'number' })).toBe('duration');
      expect(inferColumnSubtype({ name: 'tenure_months', type: 'number' })).toBe('duration');
    });

    it('detects integer counts', () => {
      expect(inferColumnSubtype({ name: 'cantidad_articulos', type: 'number' })).toBe('integer');
      expect(inferColumnSubtype({ name: 'unidades_vendidas', type: 'number' })).toBe('integer');
      expect(inferColumnSubtype({ name: 'ranking', type: 'number' })).toBe('integer');
      expect(inferColumnSubtype({ name: 'num_items', type: 'number' })).toBe('integer');
      expect(inferColumnSubtype({ name: 'valor_entero', type: 'number', samples: ['1', '2', '3'] })).toBe('integer');
    });

    it('defaults to decimal for continuous numbers', () => {
      expect(inferColumnSubtype({ name: 'score', type: 'number', samples: ['1.25', '3.40'] })).toBe('decimal');
    });
  });

  describe('date subtypes', () => {
    it('detects datetime when samples contain timestamps', () => {
      expect(
        inferColumnSubtype({
          name: 'registro',
          type: 'date',
          samples: ['2026-08-22T14:30:00Z', '2026-08-22T15:00:00Z'],
        }),
      ).toBe('datetime');
      expect(inferColumnSubtype({ name: 'created_at', type: 'date' })).toBe('datetime');
    });

    it('detects period from period names', () => {
      expect(inferColumnSubtype({ name: 'trimestre_fiscal', type: 'date' })).toBe('period');
      expect(inferColumnSubtype({ name: 'mes_ano', type: 'date' })).toBe('period');
    });

    it('defaults to date for standard calendar dates', () => {
      expect(inferColumnSubtype({ name: 'fecha_pedido', type: 'date', samples: ['2026-08-22'] })).toBe('date');
    });
  });

  describe('text subtypes', () => {
    it('detects identifiers and codes', () => {
      expect(inferColumnSubtype({ name: 'id_cliente', type: 'text' })).toBe('identifier');
      expect(inferColumnSubtype({ name: 'sku_producto', type: 'text' })).toBe('identifier');
      expect(inferColumnSubtype({ name: 'order_uuid', type: 'text' })).toBe('identifier');
      expect(inferColumnSubtype({ name: 'nif', type: 'text' })).toBe('identifier');
    });

    it('detects customers and entities', () => {
      expect(inferColumnSubtype({ name: 'nombre_cliente', type: 'text' })).toBe('customer');
      expect(inferColumnSubtype({ name: 'email_usuario', type: 'text' })).toBe('customer');
      expect(inferColumnSubtype({ name: 'suscriptor', type: 'text' })).toBe('customer');
    });

    it('detects geographic entities', () => {
      expect(inferColumnSubtype({ name: 'pais_destino', type: 'text' })).toBe('geo');
      expect(inferColumnSubtype({ name: 'ciudad', type: 'text' })).toBe('geo');
      expect(inferColumnSubtype({ name: 'codigo_postal', type: 'text' })).toBe('geo');
      expect(inferColumnSubtype({ name: 'lugar', type: 'text', samples: ['Madrid', 'Barcelona'] })).toBe('geo');
    });

    it('detects product and catalog dimensions', () => {
      expect(inferColumnSubtype({ name: 'categoria_producto', type: 'text' })).toBe('product');
      expect(inferColumnSubtype({ name: 'marca_vehiculo', type: 'text' })).toBe('product');
      expect(inferColumnSubtype({ name: 'articulo', type: 'text' })).toBe('product');
    });

    it('detects funnel stages and statuses', () => {
      expect(inferColumnSubtype({ name: 'etapa_embudo', type: 'text' })).toBe('funnel_stage');
      expect(inferColumnSubtype({ name: 'estado_pedido', type: 'text' })).toBe('funnel_stage');
      expect(inferColumnSubtype({ name: 'lead_stage', type: 'text' })).toBe('funnel_stage');
    });

    it('defaults to standard text for general categorical dimensions', () => {
      expect(inferColumnSubtype({ name: 'observaciones', type: 'text' })).toBe('text');
    });
  });

  describe('boolean and empty', () => {
    it('returns boolean for boolean columns', () => {
      expect(inferColumnSubtype({ name: 'activo', type: 'boolean' })).toBe('boolean');
    });

    it('returns empty for empty columns', () => {
      expect(inferColumnSubtype({ name: 'desconocida', type: 'empty' })).toBe('empty');
    });
  });
});
