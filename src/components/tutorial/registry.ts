import { TutorialConfig, TutorialId } from './types';
import { runJobFlowConfig } from './tutorials/run-job';
import { runNodeFlowConfig } from './tutorials/run-node';
import { ownerProfileFlowConfig } from './tutorials/owner-profile';
import { consumerProfileFlowConfig } from './tutorials/consumer-profile';

const TUTORIALS: Record<TutorialId, TutorialConfig> = {
  'run-job-flow': runJobFlowConfig,
  'run-node-flow': runNodeFlowConfig,
  'owner-profile-flow': ownerProfileFlowConfig,
  'consumer-profile-flow': consumerProfileFlowConfig,
};

export const getTutorialConfig = (id: TutorialId): TutorialConfig => TUTORIALS[id] ?? { id, steps: [] };

// Which tutorial + page key is active for a given route. The overlay uses this
// to know the current page; the page itself mounts a <TutorialButton/> to start.
export type RouteTutorial = { tutorialId: TutorialId; page: string };

export const ROUTE_TUTORIAL_MAP: Record<string, RouteTutorial> = {
  '/run-job/environments': { tutorialId: 'run-job-flow', page: 'environments' },
  '/run-job/resources': { tutorialId: 'run-job-flow', page: 'resources' },
  '/run-job/payment': { tutorialId: 'run-job-flow', page: 'payment' },
  '/run-job/summary': { tutorialId: 'run-job-flow', page: 'summary' },
  '/run-node/setup': { tutorialId: 'run-node-flow', page: 'setup' },
  '/run-node/configure': { tutorialId: 'run-node-flow', page: 'configure' },
  '/profile/owner': { tutorialId: 'owner-profile-flow', page: 'owner' },
  '/profile/consumer': { tutorialId: 'consumer-profile-flow', page: 'consumer' },
};

export const getRouteTutorial = (pathname: string): RouteTutorial | undefined => ROUTE_TUTORIAL_MAP[pathname];
