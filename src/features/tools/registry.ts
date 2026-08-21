import { builderTool } from './builder/tool';
import { crossTool } from './cross/tool';
import { pivotTool } from './pivot/tool';
import { profileTool } from './profile/tool';
import { rfmTool } from './rfm/tool';
import type { DatasetCapabilities, ToolAvailability, ToolDefinition } from './types';

/**
 * Las herramientas disponibles, en el orden en que se ofrecen.
 *
 * El orden no es alfabético ni cronológico: va de lo que sirve para cualquier
 * tabla a lo que exige un dataset concreto. Quien llega con un fichero
 * cualquiera encuentra primero lo que seguro puede usar, y quien trae ventas
 * con clientes reconoce enseguida lo suyo más abajo.
 */
export const TOOLS: ToolDefinition[] = [
  profileTool,
  builderTool,
  pivotTool,
  crossTool,
  rfmTool,
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
