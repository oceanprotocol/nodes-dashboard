import { CHAIN_ID } from '@/constants/chains';
import { formatChainLabel } from '@/utils/formatters';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HubIcon from '@mui/icons-material/Hub';
import KeyIcon from '@mui/icons-material/Key';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PersonIcon from '@mui/icons-material/Person';
import RedeemIcon from '@mui/icons-material/Redeem';
import StorageIcon from '@mui/icons-material/Storage';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { ReactNode } from 'react';

/** Sections rendered inside the account layout. */
export type AccountSectionKey = 'owner' | 'consumer' | 'escrow' | 'compy' | 'access-lists' | 'storage' | 'tokens';

/** Every entry in the account menu, including the ones that link out of the layout. */
export type AccountItemKey = AccountSectionKey | 'claim';

export type AccountGroupKey = 'activity' | 'funds' | 'access';

/**
 * Gate an item on account state the menu can only know at render time.
 * `provider` — the wallet exposes a provider (access lists need on-chain writes).
 * `grant-unclaimed` — the complimentary credits grant has not been claimed yet.
 */
export type AccountItemRequirement = 'provider' | 'grant-unclaimed';

export type AccountItem = {
  /** Subtitle under the page title. Empty for items that link out of the layout. */
  description: string;
  group: AccountGroupKey;
  href: string;
  icon: ReactNode;
  key: AccountItemKey;
  /** Menu label. */
  label: string;
  /** Leaves the account layout instead of swapping the section. */
  linksOut?: boolean;
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
    description: 'Deposit and withdraw escrow funds, and manage the spending authorizations that pay for compute jobs.',
    group: 'funds',
    href: '/account/escrow',
    icon: <AccountBalanceWalletIcon />,
    key: 'escrow',
    label: 'Escrow',
    title: 'Escrow',
  },
  {
    description: 'Convert your USDC to COMPY.',
    group: 'funds',
    href: '/account/compy',
    icon: <SwapHorizIcon />,
    key: 'compy',
    label: 'Get COMPY',
    title: 'Get COMPY',
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
  {
    description: '',
    group: 'funds',
    href: '/grant/details',
    icon: <RedeemIcon />,
    key: 'claim',
    label: 'Claim credits',
    linksOut: true,
    requires: 'grant-unclaimed',
    title: '',
  },
];

export const DEFAULT_ACCOUNT_SECTION: AccountSectionKey = 'consumer';

const SECTION_KEYS = ACCOUNT_SECTIONS.filter((item) => !item.linksOut).map((item) => item.key);

export const isAccountSectionKey = (value: string | undefined): value is AccountSectionKey => {
  if (!value) {
    return false;
  }
  return SECTION_KEYS.includes(value as AccountItemKey);
};

export const getAccountSection = (key: AccountSectionKey): AccountItem =>
  ACCOUNT_SECTIONS.find((item) => item.key === key) as AccountItem;
