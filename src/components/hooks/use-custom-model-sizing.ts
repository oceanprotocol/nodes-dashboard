import { fetchHuggingFaceModelConfig } from '@/services/huggingface-service';
import { CustomModelSizing, customModelSizing } from '@/services/vram-estimate';
import { HuggingFaceModel, HuggingFaceModelConfig, InferenceEngine, ModelParameters } from '@/types/huggingface';
import { useEffect, useMemo, useState } from 'react';

/**
 * The custom-model env picker's GPU constraints for one Hugging Face model: legal tensor-parallel widths
 * and an estimated per-width VRAM requirement, both hard filters, see customModelSizing.
 *
 * Fetches the model's config.json (heads, layers, KV shape) once per model/revision/token. The estimate
 * itself is recomputed from `params` and `contextTokens` on every change, so a context, dtype,
 * quantization or memory utilisation edit re-filters without another fetch. A config that can't be read (gated without a
 * token, offline) is not an error here: it only removes the checks it would have enabled, and the
 * sizing's notes say so.
 */
export default function useCustomModelSizing({
  enabled,
  model,
  engine,
  params,
  contextTokens,
  hfToken,
}: {
  /** Off for flows that already declare a requirement (templates, a package handoff). */
  enabled: boolean;
  model: HuggingFaceModel | undefined;
  engine: InferenceEngine;
  /** The launch settings already committed for the model, if any (back-navigation, package handoff). */
  params: ModelParameters | undefined;
  /** Context to size for (the picker's choice); null = `params.maxContext`, else the model's own. */
  contextTokens: number | null;
  hfToken: string;
}): {
  loading: boolean;
  sizing: CustomModelSizing | null;
  /** The model's own max context from its config; null when unknown or not loaded yet. */
  modelMaxContext: number | null;
} {
  const modelId = model?.id;
  const revision = params?.engine === 'vllm' && params.revision ? params.revision : undefined;
  const fetchKey = enabled && modelId ? `${modelId}\u0000${revision ?? ''}\u0000${hfToken}` : null;
  const [loaded, setLoaded] = useState<{ key: string; config: HuggingFaceModelConfig | null } | null>(null);

  useEffect(() => {
    if (!fetchKey || !modelId) {
      return;
    }
    let cancelled = false;
    fetchHuggingFaceModelConfig(modelId, hfToken || undefined, revision)
      .then((config) => {
        if (!cancelled) {
          setLoaded({ key: fetchKey, config });
        }
      })
      .catch((error) => {
        // Auth or network: size without the config (no width filter, notes explain).
        console.error('Failed to read the model config for GPU sizing:', error);
        if (!cancelled) {
          setLoaded({ key: fetchKey, config: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, modelId, hfToken, revision]);

  const ready = !!fetchKey && loaded?.key === fetchKey;
  const config = ready ? loaded.config : null;
  const sizing = useMemo(
    () => (ready && model ? customModelSizing({ model, config, params, engine, contextTokens }) : null),
    [ready, model, config, params, engine, contextTokens]
  );
  return { loading: !!fetchKey && !ready, sizing, modelMaxContext: config?.maxContext ?? null };
}
