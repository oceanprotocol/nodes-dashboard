import { getCommonNavNode, isNavNodeId, NAV_TREE, NavNodeId } from '@/lib/navigation-tree';
import { createWalletAuthMessage, WalletAuth } from '@/types/wallet-auth';
import questions from './onboarding-questions.json';

export type Lane = 'maker' | 'builder';

export type ProfileOption = {
  id: string;
  lane: Lane | null;
  slide: string | null;
  subtitle: string;
  title: string;
};

export type GoalOption = {
  destination: NavNodeId;
  id: string;
  isNew?: boolean;
  logos?: string[];
  meta?: string[];
  slide: string | null;
  subtitle: string;
  title: string;
};

export type GoalTab = {
  id: Lane;
  label: string;
  options: GoalOption[];
};

export type SourceOption = {
  detail?: string;
  id: string;
  label: string;
};

type StepCopy = {
  label: string;
  lead: string;
  title: string;
  titleEmphasis: string;
};

export type OnboardingQuestions = {
  done: Omit<StepCopy, 'label'> & { cta: Record<Lane | 'default', string>; offer: string };
  goals: StepCopy & { max: number; min: number; tabs: GoalTab[] };
  profile: StepCopy & { options: ProfileOption[] };
  source: StepCopy & { detailPlaceholder: string; options: SourceOption[] };
};

export type OnboardingAnswers = {
  goals: string[];
  profile: string;
  source: string | null;
  sourceDetail: string | null;
};

export type OnboardingStatus = {
  destination: string | null;
  onboarded: boolean;
};

export const ONBOARDING_API_PATH = '/api/onboarding';
export const SOURCE_DETAIL_MAX_LENGTH = 200;

export const getOnboardingAuthMessage = createWalletAuthMessage('Ocean Network onboarding');

export const ONBOARDING_QUESTIONS = questions as OnboardingQuestions;

export const ALL_GOALS = ONBOARDING_QUESTIONS.goals.tabs.flatMap((tab) => tab.options);

export const findProfile = (id: string | null) => ONBOARDING_QUESTIONS.profile.options.find((p) => p.id === id);
export const findGoal = (id: string) => ALL_GOALS.find((g) => g.id === id);
export const findSource = (id: string | null) => ONBOARDING_QUESTIONS.source.options.find((s) => s.id === id);

export const getOnboardingDestination = (goals: string[]) => {
  const nodes = goals.map((id) => findGoal(id)?.destination).filter(isNavNodeId);
  return NAV_TREE[getCommonNavNode(nodes)].path;
};

const REQUEST_TIMEOUT_MS = 8000;

export class OnboardingRequestError extends Error {
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Onboarding request failed with ${status}`);
    this.name = 'OnboardingRequestError';
    this.body = body;
  }
}

const requestStatus = async (input: string, init?: RequestInit): Promise<OnboardingStatus> => {
  const response = await fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new OnboardingRequestError(response.status, await response.json().catch(() => null));
  }
  return response.json();
};

export const fetchOnboardingStatus = (address: string) =>
  requestStatus(`${ONBOARDING_API_PATH}?address=${encodeURIComponent(address)}`);

export const submitOnboardingAnswers = (
  address: string,
  answers: OnboardingAnswers,
  { expiryTimestamp, signature }: WalletAuth
) =>
  requestStatus(ONBOARDING_API_PATH, {
    body: JSON.stringify({ ...answers, address, expiryTimestamp, signature }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

export const parseAnswers = (input: unknown): OnboardingAnswers | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const { goals, profile, source, sourceDetail } = input as Record<string, unknown>;
  if (typeof profile !== 'string' || !findProfile(profile)) {
    return null;
  }
  const { max, min } = ONBOARDING_QUESTIONS.goals;
  if (
    !Array.isArray(goals) ||
    goals.length < min ||
    goals.length > max ||
    new Set(goals).size !== goals.length ||
    !goals.every((id) => typeof id === 'string' && findGoal(id))
  ) {
    return null;
  }
  if (source !== null && (typeof source !== 'string' || !findSource(source))) {
    return null;
  }
  if (sourceDetail !== null && (typeof sourceDetail !== 'string' || sourceDetail.length > SOURCE_DETAIL_MAX_LENGTH)) {
    return null;
  }
  const detail = findSource(source)?.detail && sourceDetail?.trim() ? sourceDetail.trim() : null;
  return { goals, profile, source, sourceDetail: detail };
};
