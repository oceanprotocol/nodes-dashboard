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
  if (!tokenAddress || typeof tokenAddress !== 'string') {
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
 * Fetches the symbols of tokens from their addresses.
 * @param tokenAddresses The addresses of the tokens.
 * @returns The symbols of the tokens in a map where the key is the token address and the value is the symbol.
 */
export const getTokensSymbols = async (tokenAddresses: string[]): Promise<Record<string, string | null>> => {
  const symbols = await Promise.all(tokenAddresses.map((tokenAddress) => getTokenSymbol(tokenAddress)));
  const symbolsMap = Object.fromEntries(tokenAddresses.map((tokenAddress, index) => [tokenAddress, symbols[index]]));
  return symbolsMap;
};

/**
 * Custom hook that fetches the symbol of a token from its address.
 * @param tokenAddress The address of the token.
 * @returns The symbol of the token or null if the token address is invalid.
 */
export const useTokenSymbol = (tokenAddress: string | null | undefined) => {
  const [symbol, setSymbol] = useState<string | null>(null);

  useEffect(() => {
    getTokenSymbol(tokenAddress).then((symbol) => setSymbol(symbol));
  }, [tokenAddress]);

  return symbol;
};

export const useTokensSymbols = (tokenAddresses: string[]) => {
  const [symbols, setSymbols] = useState<Record<string, string | null>>({});

  useEffect(() => {
    getTokensSymbols(tokenAddresses).then((symbols) => setSymbols(symbols));
  }, [tokenAddresses]);

  return symbols;
};
