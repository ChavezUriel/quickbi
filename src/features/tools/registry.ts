import { anomaliesTool } from './anomalies/tool';
import { basketTool } from './basket/tool';
import { builderTool } from './builder/tool';
import { churnTool } from './churn/tool';
import { clvTool } from './clv/tool';
import { cohortsTool } from './cohorts/tool';
import { concentrationTool } from './concentration/tool';
import { correlationsTool } from './correlations/tool';
import { crossTool } from './cross/tool';
import { distributionsTool } from './distributions/tool';
import { executiveTool } from './executive/tool';
import { forecastTool } from './forecast/tool';
import { funnelTool } from './funnel/tool';
import { geoMapTool } from './geo_map/tool';
import { inventoryTool } from './inventory/tool';
import { paretoTool } from './pareto/tool';
import { pivotTool } from './pivot/tool';
import { priceVolumeTool } from './price_volume/tool';
import { profileTool } from './profile/tool';
import { reconciliationTool } from './reconciliation/tool';
import { rfmTool } from './rfm/tool';
import { seasonalityTool } from './seasonality/tool';
import { segmentsTool } from './segments/tool';
import { spcTool } from './spc/tool';
import type { DatasetCapabilities, ToolAvailability, ToolDefinition } from './types';
import { waterfallTool } from './waterfall/tool';

/**
 * Las herramientas disponibles, en el orden en que se ofrecen.
 *
 * El orden no es alfabético ni cronológico: va de lo que sirve para cualquier
 * tabla a lo que exige un dataset concreto. Quien llega con un fichero
 * cualquiera encuentra primero lo que seguro puede usar, y quien trae ventas
 * con clientes reconoce enseguida lo suyo más abajo.
 */
export const TOOLS: ToolDefinition[] = [
  // Tier A — Universal (Para cualquier tabla)
  profileTool,
  builderTool,
  pivotTool,
  correlationsTool,
  distributionsTool,
  segmentsTool,
  paretoTool,
  executiveTool,

  // Tier B — Series temporales
  crossTool,
  seasonalityTool,
  forecastTool,
  waterfallTool,
  spcTool,
  anomaliesTool,

  // Tier C — Clientes y ventas
  rfmTool,
  clvTool,
  cohortsTool,
  churnTool,
  basketTool,
  concentrationTool,
  priceVolumeTool,

  // Tier D — Herramientas situacionales
  funnelTool,
  geoMapTool,
  inventoryTool,
  reconciliationTool,
];

export function getTool(id: string | null): ToolDefinition | null {
  if (id === null) return null;
  return TOOLS.find((tool) => tool.id === id) ?? null;
}

export function availabilityOf(
  tool: ToolDefinition,
  capabilities: DatasetCapabilities,
): ToolAvailability {
  return tool.requires(capabilities);
}
