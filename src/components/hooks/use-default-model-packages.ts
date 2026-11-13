import { CHAIN_ID } from '@/constants/chains';
import { useP2P } from '@/contexts/P2PContext';
import { normalizeNodeUri } from '@/services/nodeService';
import { InferencePackage } from '@/types/inference';
import { isGpuRequirement } from '@/utils/env-resources';
import { useEffect, useState } from 'react';

/** How long a node's template list is reused across mounts (the payment page, details, grid). */
const TEMPLATES_TTL_MS = 5 * 60_000;
/** A shared read has no caller to abort it, so it times out on its own instead of caching a hang. */
const TEMPLATES_TIMEOUT_MS = 30_000;

/**
 * Template lists per node and chain, shared by every mount: each page using the packages used to pull
 * every configured node again. Failed reads are evicted so the next mount retries.
 */
const templatesCache = new Map<string, { at: number; promise: Promise<unknown> }>();

function cachedTemplates(key: string, fetch: () => Promise<unknown>): Promise<unknown> {
  const hit = templatesCache.get(key);
  if (hit && Date.now() - hit.at < TEMPLATES_TTL_MS) {
    return hit.promise;
  }
  const promise = fetch();
  templatesCache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (templatesCache.get(key)?.promise === promise) {
      templatesCache.delete(key);
    }
  });
  return promise;
}

/**
 * A node template as a package, or null when it can't be sized. Curated packages get their GPU layouts
 * from withGpuLayouts; a node template is supposed to carry them already (the node schema requires
 * them), so a GPU entry without layouts is pinned here to the template's own tensor-parallel width —
 * otherwise the planner finds no candidate and the package lists no environment at all. A template
 * without `recommendedResources` (the pre-VRAM `requiredResources` shape) is dropped: it declares no
 * GPU the planner can read, and would book one unchecked card.
 */
function nodePackageOf(template: InferencePackage): InferencePackage | null {
  if (!Array.isArray(template.recommendedResources)) {
    return null;
  }
  const tp = template.params?.engine === 'vllm' ? (template.params.tensorParallelSize ?? 1) : 1;
  return {
    ...template,
    recommendedResources: template.recommendedResources.map((r) => {
      if (!isGpuRequirement(r) || r.recommended <= 0 || (Array.isArray(r.layouts) && r.layouts.length > 0)) {
        return r;
      }
      return { ...r, layouts: tp <= 1 ? [{ gpuCount: 1 }] : [{ gpuCount: tp, vramPerGpu: r.recommended / tp }] };
    }),
  };
}

/**
 * Nodes whose service templates seed the quick-start packages, from NEXT_PUBLIC_DEFAULT_MODEL_PEER_IDS
 * (comma-separated peer ids). Empty/whitespace entries are dropped; duplicates collapse.
 */
function getDefaultModelPeerIds(): string[] {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_MODEL_PEER_IDS ?? '';
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

type DefaultModelPackages = {
  packages: InferencePackage[];
  loading: boolean;
  /** Set only when EVERY listed node failed to return templates (nothing to show). */
  error: string | null;
};

/**
 * Load the quick-start packages by pulling each configured node's advertised service templates
 * (getServiceTemplates), scoped to the active chain. The node JSON is already shaped like an
 * InferencePackage (model + params + pinned env + recommendedResources), so templates are used as-is
 * (bar a GPU entry missing its layouts, see nodePackageOf) —
 * one package per template. Each node is queried independently: one unreachable node just drops its
 * packages instead of blanking the grid. Packages are deduped by id (first node wins on a clash).
 */
const useDefaultModelPackages = (): DefaultModelPackages => {
  const { isReady, getServiceTemplates } = useP2P();
  const [packages, setPackages] = useState<InferencePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    let cancelled = false;
    const peerIds = getDefaultModelPeerIds();

    async function load() {
      setLoading(true);
      setError(null);

      // if (peerIds.length === 0) {
      //   if (!cancelled) {
      //     setPackages([]);
      //     setError('No nodes configured for quick-start packages.');
      //     setLoading(false);
      //   }
      //   return;
      // }

      // Per-node fetch, fully isolated: a node that fails (unreachable, timeout, malformed payload)
      // just contributes nothing — never blocks the packages that did come back.
      // Shared across mounts (see cachedTemplates), so no per-mount abort signal: unmounting just
      // ignores the answer below.
      const results = await Promise.allSettled(
        peerIds.map((peerId) =>
          cachedTemplates(`${peerId}\u0000${CHAIN_ID}`, () =>
            getServiceTemplates(normalizeNodeUri(peerId), CHAIN_ID, AbortSignal.timeout(TEMPLATES_TIMEOUT_MS))
          )
        )
      );

      if (cancelled) {
        return;
      }

      // Node templates are authored to match the InferencePackage shape (model + params + env), so
      // treat each returned template as a package. Dedupe by id — first listed node wins on a clash.
      const byId = new Map<string, InferencePackage>();
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
          console.error(`Failed to fetch service templates from ${peerIds[index]}:`, result.reason);
          return;
        }
        // Guard a non-array / malformed payload so one bad node can't throw and lose the rest.
        const templates = Array.isArray(result.value) ? (result.value as unknown as InferencePackage[]) : [];
        for (const template of templates) {
          if (template.type === 'quickstart' && template?.id && !byId.has(template.id)) {
            const pkg = nodePackageOf(template);
            if (!pkg) {
              console.warn(`Skipping template ${template.id} from ${peerIds[index]}: no recommendedResources`);
              continue;
            }
            // Stamp the source node so the details page knows whose environments to list — the
            // template JSON itself carries no peer id.
            byId.set(template.id, { ...pkg, sourcePeerIds: [peerIds[index]] });
          }
        }
      });

      // Always render whatever resolved — partial or empty. Failures are logged, not surfaced as a
      // page error (the empty-state message covers the "nothing came back" case).
      setPackages(Array.from(byId.values()));
      setError(null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isReady, getServiceTemplates]);

  return { packages, loading, error };
};

export default useDefaultModelPackages;
