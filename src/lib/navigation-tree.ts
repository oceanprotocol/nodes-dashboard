import { getRoutes } from '@/config';
import { INFERENCE_PATHS } from '@/services/inference-url';

export type NavNodeId =
  | 'home'
  | 'inference'
  | 'inferenceTemplates'
  | 'inferenceServices'
  | 'inferenceDefaultModels'
  | 'inferenceCustomModels'
  | 'compute'
  | 'runJob'
  | 'runNode';

type NavNode = {
  parent: NavNodeId | null;
  path: string;
};

const routes = getRoutes();

export const NAV_TREE: Record<NavNodeId, NavNode> = {
  home: { parent: null, path: routes.home.path },
  inference: { parent: 'home', path: routes.inference.path },
  inferenceTemplates: { parent: 'inference', path: INFERENCE_PATHS.templates },
  inferenceServices: { parent: 'inference', path: INFERENCE_PATHS.services },
  inferenceDefaultModels: { parent: 'inference', path: INFERENCE_PATHS.packages },
  inferenceCustomModels: { parent: 'inference', path: INFERENCE_PATHS.customModels },
  compute: { parent: 'home', path: routes.compute.path },
  runJob: { parent: 'compute', path: routes.runJob.path },
  runNode: { parent: 'compute', path: routes.runNode.path },
};

export const isNavNodeId = (value: unknown): value is NavNodeId =>
  typeof value === 'string' && Object.hasOwn(NAV_TREE, value);

const getLineage = (id: NavNodeId) => {
  const lineage: NavNodeId[] = [];
  for (let node: NavNodeId | null = id; node; node = NAV_TREE[node].parent) {
    lineage.unshift(node);
  }
  return lineage;
};

export const getCommonNavNode = (ids: NavNodeId[]): NavNodeId => {
  if (ids.length === 0) {
    return 'home';
  }
  const lineages = ids.map(getLineage);
  let common: NavNodeId = 'home';
  for (let depth = 0; depth < lineages[0].length; depth++) {
    const node = lineages[0][depth];
    if (!lineages.every((lineage) => lineage[depth] === node)) {
      break;
    }
    common = node;
  }
  return common;
};
