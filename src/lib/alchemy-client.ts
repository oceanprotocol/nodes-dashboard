import { CHAIN_ID, BASE_CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';
import { Alchemy, Network } from 'alchemy-sdk';

const getAlchemyNetwork = (): Network => {
  if (CHAIN_ID === ETH_SEPOLIA_CHAIN_ID) return Network.ETH_SEPOLIA;
  if (CHAIN_ID === BASE_CHAIN_ID) return Network.BASE_MAINNET;
  return Network.ETH_MAINNET;
};

export const alchemyClient = new Alchemy({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: getAlchemyNetwork(),
});
