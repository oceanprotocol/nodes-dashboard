import { CHAIN_ID } from '@/constants/chains';
import { DEFAULT_NODE_URI } from '@/constants/default-node';
import { NodeUri } from '@/contexts/P2PContext';
import { AppTemplate } from '@/types/templates';
import { ServiceTemplatePublic } from '@oceanprotocol/lib';

/**
 * The node's public template getter (ProviderInstance.getServiceTemplates), as exposed by useP2P().
 * Kept as a param so callers pass the ready-gated hook version — this module stays hook-free.
 */
export type GetServiceTemplatesFn = (
  nodeUri: NodeUri,
  chainId?: number,
  signal?: AbortSignal
) => Promise<ServiceTemplatePublic[]>;

/**
 * Fetch the app templates advertised by the default node (getServiceTemplates), scoped to the active
 * chain. `AppTemplate` is `ServiceTemplatePublic`, so the payload is used as-is. Array-guarded so a
 * malformed response can't throw. Pass the caller's `useP2P().getServiceTemplates` (it throws until the
 * P2P node is ready, so gate on `isReady` before calling).
 */
export async function fetchTemplates(
  getServiceTemplates: GetServiceTemplatesFn,
  signal?: AbortSignal
): Promise<AppTemplate[]> {
  const result = await getServiceTemplates(DEFAULT_NODE_URI, CHAIN_ID, signal);
  return Array.isArray(result) ? result : [];
}

/** Look up one template by id (the `[templateId]` route param / URL hydration). */
export function findTemplateById(templates: AppTemplate[], id: string): AppTemplate | null {
  return templates.find((t) => t.id === id) ?? null;
}

/**
 * Match a running service back to the template it was launched from, by container image. Tag is
 * ignored on purpose: serviceRestart can't change the image anyway, so image alone identifies the app.
 */
export function findTemplateByImage(templates: AppTemplate[], image: string | undefined): AppTemplate | null {
  if (!image) {
    return null;
  }
  return templates.find((t) => t.image === image) ?? null;
}
