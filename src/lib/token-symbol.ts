import { RPC_URL } from '@/lib/constants';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';

/**
 * Fetches the symbol of a token from its address.
 * @param tokenAddress The address of the token.
 * @returns The symbol of the token.
 */
export const getTokenSymbol = async (tokenAddress: string): Promise<string> => {
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });
  const token = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
  return token.symbol();
};

/**
 * Custom hook that fetches the symbol of a token from its address.
 * @param tokenAddress The address of the token.
 * @returns The symbol of the token.
 */
const useTokenSymbol = (tokenAddress: string) => {
  const [symbol, setSymbol] = useState<string | null>(null);

  useEffect(() => {
    getTokenSymbol(tokenAddress).then((symbol) => setSymbol(symbol));
  }, [tokenAddress]);

  return symbol;
};

export default useTokenSymbol;
