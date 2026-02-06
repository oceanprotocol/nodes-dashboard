export type GrantDetails = {
  email: string;
  goal: string;
  handle: string;
  hardware: string[];
  name: string;
  os: string;
  role: string;
  walletAddress: string;
};

export type GrantWithStatus = GrantDetails & {
  applicationDate: Date;
  redeemDate: Date | null;
  status: GrantStatus;
};

export enum GrantStatus {
  NOT_REDEEMED = 'not-redeemed',
  REDEEMED = 'redeemed',
}

export const GRANT_ROLE_CHOICES = [
  { label: 'AI developer', value: 'ai_developer' },
  { label: 'Data scientist', value: 'data_scientist' },
  { label: 'Student/ Researcher', value: 'student_researcher' },
  { label: 'Node operator/ Miner', value: 'node_operator' },
  { label: 'Web3 builder/ Founder', value: 'web3_builder' },
  { label: 'Crypto investor/ Trader', value: 'crypto_investor' },
];

export const GRANT_HARDWARE_CHOICES = [
  { label: 'Ultra high-end gaming PC (NVIDIA GPU 4090/5090)', value: 'highend_gaming_pc' },
  { label: 'Lightweight gaming PC', value: 'lightweight_gaming_pc' },
  { label: 'Apple (MacBook M1 - M5)', value: 'apple' },
  { label: 'Enterprise/ Data center GPU (eg. H100/ A100)', value: 'enterprise_data_center_gpu' },
  { label: 'Standard laptop/ CPU only', value: 'standard_laptop_cpu_only' },
  { label: 'None/ Cloud resources only', value: 'none_cloud_resources_only' },
];

export const GRANT_OS_CHOICES = [
  { label: 'Windows', value: 'windows' },
  { label: 'MacOS', value: 'macos' },
  { label: 'Linux', value: 'linux' },
];

export const GRANT_GOAL_CHOICES = [
  {
    description: 'I need affordable compute to train or fine-tune my own models',
    label: 'Train AI models',
    value: 'train_ai_models',
  },
  {
    description: 'I want to run autonomous bots for trading, predictions, or automation',
    label: 'Deploy AI agents',
    value: 'deploy_ai_agents',
  },
  {
    description: 'I am a developer building an App that would benefit from an out-of-the-box decentralized AI backend',
    label: 'Build an application',
    value: 'build_an_application',
  },
  {
    description: 'I am conducting research and need privacy-preserving infrastructure',
    label: 'Academic/ Private research',
    value: 'academic_private_research',
  },
  {
    description: 'I want to earn revenue by renting out my GPU/CPU power',
    label: 'Monetize idle hardware',
    value: 'monetize_idle_hardware',
  },
];
