import { getSupportedTokens } from '@/constants/tokens';
import { getRpc } from '@/lib/constants';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';

const symbolCache = new Map<string, string>();
const decimalsCache = new Map<string, number>();

export const getTokenSymbol = async (tokenAddress: string | null | undefined): Promise<string | null> => {
  if (!tokenAddress || typeof tokenAddress !== 'string') {
    return null;
  }

  const chainTokens = getSupportedTokens();
  const tokenSymbol = Object.keys(chainTokens).find(
    (key) => chainTokens[key as keyof typeof chainTokens].address === tokenAddress
  );
  if (tokenSymbol) {
    return tokenSymbol as string;
  }

  const addr = tokenAddress.toLowerCase();
  if (symbolCache.has(addr)) return symbolCache.get(addr)!;

  const provider = new ethers.JsonRpcProvider(getRpc(), undefined, { batchMaxCount: 3 });
  const token = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
  const symbol = await token.symbol();
  symbolCache.set(addr, symbol);

  return symbol;
};

export const getTokenDecimals = async (tokenAddress: string): Promise<number> => {
  const chainTokens = getSupportedTokens();
  const token = Object.values(chainTokens).find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase());
  if (token) return token.decimals;

  const addr = tokenAddress.toLowerCase();
  if (decimalsCache.has(addr)) return decimalsCache.get(addr)!;

  const provider = new ethers.JsonRpcProvider(getRpc(), undefined, { batchMaxCount: 3 });
  const contract = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
  const decimals = Number(await contract.decimals());
  decimalsCache.set(addr, decimals);

  return decimals;
};


export const getTokensSymbols = async (tokenAddresses: string[]): Promise<Record<string, string | null>> => {
  const symbols = await Promise.all(tokenAddresses.map((tokenAddress) => getTokenSymbol(tokenAddress)));
  const symbolsMap = Object.fromEntries(tokenAddresses.map((tokenAddress, index) => [tokenAddress, symbols[index]]));
  return symbolsMap;
};


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
