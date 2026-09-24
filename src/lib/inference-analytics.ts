import { InferenceFlowType } from '@/types/inference';
import { AppTemplate, isBundle } from '@/types/templates';
import posthog from 'posthog-js';

/**
 * Which of the four entry branches a user is in. `flowType` alone can't tell these apart: the
 * templates and services catalogues are the same `CataloguePage` under two configs, so both carry
 * `InferenceFlowType.Template` and only `isBundle` separates them. Every inference event carries
 * this so each branch gets its own funnel in PostHog.
 */
export type InferenceBranch = 'custom' | 'quickstart' | 'template' | 'service';

export const resolveInferenceBranch = (flowType: InferenceFlowType, template?: AppTemplate | null): InferenceBranch => {
  switch (flowType) {
    case InferenceFlowType.CustomModel:
      return 'custom';
    case InferenceFlowType.DefaultModel:
      return 'quickstart';
    case InferenceFlowType.Template:
      // Bundles ship their models inside the image; bare services don't.
      return template && isBundle(template) ? 'template' : 'service';
    default:
      return 'custom';
  }
};

/**
 * How the user got into a branch's funnel, sent as `entry` on `inference_flow_started`: the /inference
 * hub's cards (`index`), a shared/reloaded link that opened a details modal (`link`), or a catalogue
 * page reached any other way (`direct`).
 */
export type InferenceEntry = 'index' | 'link' | 'direct';

/**
 * How a details modal was opened, sent as `openedVia`: a card click, or the URL (shared link, reload,
 * Back/Forward). Not `source` — `inference_model_selected` already sends `source: 'custom'`.
 */
export type InferenceOpenedVia = 'click' | 'link';

// Per page load, not per session: module state survives client-side navigation but resets on a full
// load, and a full load of a shared link is a new entry into the funnel.
const startedBranches = new Set<InferenceBranch>();
const selectedItems = new Set<string>();

/** The funnel's first step. Fired by the hub's cards, and by ensureInferenceFlowStarted when they were skipped. */
export const trackInferenceFlowStarted = (branch: InferenceBranch, entry: InferenceEntry) => {
  startedBranches.add(branch);
  posthog.capture('inference_flow_started', { branch, entry });
};

/**
 * Keeps a branch's first pick behind its funnel's entry step: a shared link or a directly-opened
 * catalogue never passes through the hub, so `inference_flow_started` is fired here when this page
 * load hasn't fired it for the branch yet. Call right before capturing the pick.
 */
export const ensureInferenceFlowStarted = (branch: InferenceBranch, entry: Exclude<InferenceEntry, 'index'>) => {
  if (!startedBranches.has(branch)) {
    trackInferenceFlowStarted(branch, entry);
  }
};

/**
 * A catalogue pick (`inference_template_selected` / `inference_package_selected`), behind its entry
 * step (ensureInferenceFlowStarted). A URL-open of an item already picked in this page load (Back from
 * a later step, Forward) is the same pick shown again and is not re-counted; clicks always count, as
 * they did before.
 */
export const trackInferenceSelection = ({
  event,
  branch,
  itemId,
  openedVia,
  properties,
}: {
  event: 'inference_template_selected' | 'inference_package_selected';
  branch: InferenceBranch;
  itemId: string;
  openedVia: InferenceOpenedVia;
  properties: Record<string, unknown>;
}) => {
  const key = `${event}:${itemId}`;
  if (openedVia === 'link' && selectedItems.has(key)) {
    return;
  }
  ensureInferenceFlowStarted(branch, openedVia === 'link' ? 'link' : 'direct');
  selectedItems.add(key);
  posthog.capture(event, { ...properties, branch, openedVia });
};
