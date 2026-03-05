export const NODE_URL = 'https://compute1.oceanprotocol.com';
// TESTING PEER ID
// export const PEER_ID = "16Uiu2HAkwo74CJTUMHb8j7kv74GsuDB1hwLrCgDDM9pLsbx8BYA9"
export const PEER_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';

export function getRpc(): string {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/rpc`;
    }
    // server-side (e.g. signer.ts): use the key directly
    return process.env.ALCHEMY_RPC_URL ?? '';
  }
  return 'https://sepolia.drpc.org';
}
