import { getSupportedTokens } from '@/constants/tokens';
import { RPC_URL } from '@/lib/constants';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';

/**
 * Fetches the symbol of a token from its address.
 * @param tokenAddress The address of the token.
 * @returns The symbol of the token or null if the token address is invalid.
 */
export const getTokenSymbol = async (tokenAddress: string | null | undefined): Promise<string | null> => {
  if (!tokenAddress) {
    return null;
  }

  const chainTokens = getSupportedTokens();
  const tokenSymbol = Object.keys(chainTokens).find(
    (key) => chainTokens[key as keyof typeof chainTokens] === tokenAddress
  );
  if (tokenSymbol) {
    return tokenSymbol as string;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });
  const token = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
  const symbol = await token.symbol();

  return symbol;
};

/**
 * Custom hook that fetches the symbol of a token from its address.
 * @param tokenAddress The address of the token.
 * @returns The symbol of the token or null if the token address is invalid.
 */
const useTokenSymbol = (tokenAddress: string | null | undefined) => {
  const [symbol, setSymbol] = useState<string | null>(null);

  useEffect(() => {
    getTokenSymbol(tokenAddress).then((symbol) => setSymbol(symbol));
  }, [tokenAddress]);

  return symbol;
};

export default useTokenSymbol;
