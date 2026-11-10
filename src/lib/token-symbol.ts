import { isUsdc, USDC } from '@/constants/tokens';
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

  if (isUsdc(tokenAddress)) {
    return USDC.symbol;
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
  if (isUsdc(tokenAddress)) return USDC.decimals;

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
