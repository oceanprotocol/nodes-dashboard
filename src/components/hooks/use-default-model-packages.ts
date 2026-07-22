import { useP2P } from '@/contexts/P2PContext';
import { normalizeNodeUri } from '@/services/nodeService';
import { CHAIN_ID } from '@/constants/chains';
import { InferencePackage } from '@/types/inference';
import { useEffect, useState } from 'react';
import { MOCK_INFERENCE_PACKAGES } from '@/mock/inference-packages';

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
 * InferencePackage (model + params + pinned env + requiredResources), so templates are used as-is —
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
    const controller = new AbortController();
    const peerIds = getDefaultModelPeerIds();

    async function load() {
      setLoading(true);
      setError(null);

      if (peerIds.length === 0) {
        if (!cancelled) {
          setPackages([]);
          setError('No nodes configured for quick-start packages.');
          setLoading(false);
        }
        return;
      }

      // Per-node fetch, fully isolated: a node that fails (unreachable, timeout, malformed payload)
      // just contributes nothing — never blocks the packages that did come back.
      const results = await Promise.allSettled(
        peerIds.map((peerId) => getServiceTemplates(normalizeNodeUri(peerId), CHAIN_ID, controller.signal))
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
            byId.set(template.id, template);
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
      controller.abort();
    };
  }, [isReady, getServiceTemplates]);

  return {
    // TODO remove mock inference packages from list
    packages: [...packages, ...MOCK_INFERENCE_PACKAGES],
    loading,
    error
  };
};

export default useDefaultModelPackages;
