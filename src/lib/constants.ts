export const NODE_URL = 'https://compute1.oceanprotocol.com';
// TESTING PEER ID
// export const PEER_ID = "16Uiu2HAkwo74CJTUMHb8j7kv74GsuDB1hwLrCgDDM9pLsbx8BYA9"
export const PEER_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';

const BASE_RPC_URLS = [
  'https://base.llamarpc.com',
  'https://base.gateway.tenderly.co',
  'https://base-mainnet.public.blastapi.io',
  'https://base.drpc.org',
  'https://base-rpc.publicnode.com',
];

export function getRpc(): string {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    return BASE_RPC_URLS[Math.floor(Math.random() * BASE_RPC_URLS.length)];
  }
  return 'https://sepolia.drpc.org';
}
