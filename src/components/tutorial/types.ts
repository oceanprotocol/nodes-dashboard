// Shared tutorial types. Each feature tour is a TutorialConfig registered in
// registry.ts. Pages are free-form string keys scoped to a single tutorial.

export type TutorialId = 'run-job-flow' | 'run-node-flow' | 'owner-profile-flow' | 'consumer-profile-flow';

// A page key within a tutorial (e.g. 'environments', 'setup'). Kept as a string
// so each tutorial can define its own page keys without a central enum.
export type TutorialPage = string;

export type StepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type AdvanceTrigger =
  | { type: 'next' }
  | { type: 'click' }
  | { type: 'change'; pollMs?: number }
  | { type: 'value'; pollMs?: number }
  | { type: 'navigate' }
  | { type: 'auth' };

export type TutorialStep = {
  id: string;
  page: TutorialPage;
  target?: string;
  title: string;
  description: string;
  placement?: StepPlacement;
  advance: AdvanceTrigger;
  requireEnabled?: boolean;
};

export type TutorialConfig = {
  id: TutorialId;
  steps: TutorialStep[];
};
