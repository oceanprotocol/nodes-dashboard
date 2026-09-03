import { InferenceFlowType } from '@/types/inference';
import { AppTemplate, isBundle } from '@/types/templates';

/**
 * Which of the four entry branches a user is in. `flowType` alone can't tell these apart: the
 * templates and services catalogues are the same `CataloguePage` under two configs, so both carry
 * `InferenceFlowType.Template` and only `isBundle` separates them. Every inference event carries
 * this so each branch gets its own funnel in PostHog.
 */
export type InferenceBranch = 'custom' | 'quickstart' | 'template' | 'service';

export const resolveInferenceBranch = (
  flowType: InferenceFlowType,
  template?: AppTemplate | null
): InferenceBranch => {
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
