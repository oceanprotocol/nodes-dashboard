import { CHAIN_ID } from '@/constants/chains';
import { formatChainLabel } from '@/utils/formatters';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HubIcon from '@mui/icons-material/Hub';
import KeyIcon from '@mui/icons-material/Key';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PersonIcon from '@mui/icons-material/Person';
import RedeemIcon from '@mui/icons-material/Redeem';
import StorageIcon from '@mui/icons-material/Storage';
import { ReactNode } from 'react';

/** Sections rendered inside the account layout. */
export type AccountSectionKey = 'owner' | 'consumer' | 'escrow' | 'subsidy' | 'access-lists' | 'storage' | 'tokens';

export type AccountGroupKey = 'activity' | 'funds' | 'access';

/**
 * Gate an item on account state the menu can only know at render time.
 * `provider` — the wallet exposes a provider (access lists need on-chain writes).
 */
export type AccountItemRequirement = 'provider';

export type AccountItem = {
  /** Subtitle under the page title. */
  description: string;
  group: AccountGroupKey;
  href: string;
  icon: ReactNode;
  key: AccountSectionKey;
  /** Menu label. */
  label: string;
  requires?: AccountItemRequirement;
  /** Page title shown above the section. */
  title: string;
};

export const ACCOUNT_GROUPS: { key: AccountGroupKey; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'funds', label: 'Funds' },
  { key: 'access', label: 'Access' },
];

export const ACCOUNT_SECTIONS: AccountItem[] = [
  {
    description: 'Your token balance, transfers, and the compute jobs you have run.',
    group: 'activity',
    href: '/account/consumer',
    icon: <PersonIcon />,
    key: 'consumer',
    label: 'Consumer profile',
    title: 'Compute consumer',
  },
  {
    description: 'The nodes you run, what they earned, and how many are eligible for rewards.',
    group: 'activity',
    href: '/account/owner',
    icon: <HubIcon />,
    key: 'owner',
    label: 'Node owner profile',
    title: 'Node owner',
  },
  {
    description:
      'Deposit and withdraw escrow funds, manage the spending authorizations that pay for compute jobs, and review your escrow history.',
    group: 'funds',
    href: '/account/escrow',
    icon: <AccountBalanceWalletIcon />,
    key: 'escrow',
    label: 'Escrow',
    title: 'Escrow',
  },
  {
    description: 'Your subsidy and how much of it is left.',
    group: 'funds',
    href: '/account/subsidy',
    icon: <RedeemIcon />,
    key: 'subsidy',
    label: 'Subsidy',
    title: 'Subsidy',
  },
  {
    description: `Create and manage AccessList contracts on ${formatChainLabel(CHAIN_ID)}.`,
    group: 'access',
    href: '/account/access-lists',
    icon: <ListAltIcon />,
    key: 'access-lists',
    label: 'Access lists',
    requires: 'provider',
    title: 'Access lists',
  },
  {
    description: 'Storage buckets you own on Ocean nodes. Nodes you hold an auth token for are listed automatically.',
    group: 'access',
    href: '/account/storage',
    icon: <StorageIcon />,
    key: 'storage',
    label: 'Remote storage',
    title: 'Remote storage',
  },
  {
    description: 'Auth tokens for the nodes you ran jobs on. Stored on this device for your connected wallet.',
    group: 'access',
    href: '/account/tokens',
    icon: <KeyIcon />,
    key: 'tokens',
    label: 'Node auth tokens',
    title: 'Node auth tokens',
  },
];

export const DEFAULT_ACCOUNT_SECTION: AccountSectionKey = 'consumer';

const SECTION_KEYS = ACCOUNT_SECTIONS.map((item) => item.key);

export const isAccountSectionKey = (value: string | undefined): value is AccountSectionKey => {
  if (!value) {
    return false;
  }
  return SECTION_KEYS.includes(value as AccountSectionKey);
};

export const getAccountSection = (key: AccountSectionKey): AccountItem =>
  ACCOUNT_SECTIONS.find((item) => item.key === key) as AccountItem;
