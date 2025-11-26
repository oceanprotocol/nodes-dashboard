import { CHAIN_ID } from '@/constants/chains';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ComputeEnvFees, ComputeEnvironment, ProviderInstance } from '@oceanprotocol/lib';
import { Provider } from '@reown/appkit-adapter-ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { BrowserProvider, Contract, ethers } from 'ethers';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type OceanContextType = {
  getNodeBalance: (nodeUrl: string) => Promise<Map<string, number>>;
  getSymbolByAddress: (tokenAddress: string) => Promise<string>;
};

const OceanContext = createContext<OceanContextType | undefined>(undefined);

export const OceanProvider = ({ children }: { children: ReactNode }) => {
  const { walletProvider } = useAppKitProvider<Provider>('eip155');

  const browserProvider = useMemo(() => {
    if (!walletProvider) {
      return null;
    }
    return new BrowserProvider(walletProvider, CHAIN_ID);
  }, [walletProvider]);

  const getConfigByChainId = async (chainId: number): Promise<any> => {
    const config = Object.values(Address).find((chainConfig) => chainConfig.chainId === chainId);
    if (!config) {
      throw new Error('No config found for chainId');
    }
    return config;
  };

  const denominateNumber = (number: string, decimals: number) => {
    return new BigNumber(number).div(new BigNumber(10).pow(decimals)).toFixed(0);
  };

  const normalizeNumber = (number: string, decimals: number) => {
    return new BigNumber(number).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);
  };

  const getEscrowContract = async (chainId: number) => {
    const config = await getConfigByChainId(chainId);
    if (!config.Escrow) {
      throw new Error('No escrow found for chainId');
    }
    const escrow = new ethers.Contract(config.Escrow, Escrow.abi, await browserProvider?.getSigner());
    return escrow;
  };

  const getEnvironmentsByNode = async (nodeUrl: string): Promise<ComputeEnvironment[]> => {
    try {
      const environments = await ProviderInstance.getComputeEnvironments(nodeUrl);
      if (!environments || environments.length === 0) {
        return [];
      }
      return environments;
    } catch {
      return [];
    }
  };

  const getNodeBalance = async (nodeUrl: string) => {
    const result = new Map<string, number>();
    try {
      const environments = await getEnvironmentsByNode(nodeUrl);
      const balancesMap = new Map<string, string[]>();
      for (const env of environments) {
        const fees = getFeesByChainId(CHAIN_ID, env);
        for (const fee of fees) {
          const { symbol, balance } = await getBalance(fee.feeToken, env.consumerAddress);
          if (balancesMap.has(symbol)) {
            const balances = balancesMap.get(symbol) || [];
            balances.push(balance);
            balancesMap.set(symbol, balances);
            continue;
          }
          balancesMap.set(symbol, [balance]);
        }
      }
      for (const [key, value] of balancesMap) {
        const sum = value.map((val) => new BigNumber(val)).reduce((acc, val) => acc.plus(val), new BigNumber(0));
        result.set(key, sum.toNumber());
      }
    } catch (error) {
      console.log(error);
    }
    return result;
  };

  const getFeesByChainId = (chainId: number, environment: ComputeEnvironment): ComputeEnvFees[] => {
    if (!environment?.fees) {
      return [];
    }
    const config = Object.keys(environment.fees).find((chainConfig) => Number(chainConfig) === chainId);
    if (!config) {
      return [];
    }
    return environment.fees[config] as unknown as ComputeEnvFees[];
  };

  const getContractByAddress = (tokenAddress: string): Contract => {
    const contract = new ethers.Contract(tokenAddress, ERC20Template.abi, browserProvider);
    return contract;
  };

  const getSymbolByAddress = async (tokenAddress: string): Promise<string> => {
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await browserProvider?.getSigner());
    const symbol = (await token.symbol()) || tokenAddress;
    return symbol;
  };

  const getBalance = async (tokenAddress: string, address: string): Promise<{ symbol: string; balance: string }> => {
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await browserProvider?.getSigner());
    const balance = await token.balanceOf(address);
    const symbol = (await token.symbol()) || tokenAddress;
    const decimals = await token.decimals();
    const balanceString = denominateNumber(balance.toString(), decimals);
    return { symbol, balance: balanceString };
  };

  const getAuthorizations = async (tokenAddress: string, payer: string, payee: string) => {
    const escrow = await getEscrowContract(CHAIN_ID);
    const authorizations = await escrow.getAuthorizations(tokenAddress, payer, payee);
    if (!authorizations || authorizations.length === 0) {
      return null;
    }
    const splitValues = authorizations.toString().split(',');
    return {
      payee: splitValues[0],
      maxLockedAmount: denominateNumber(splitValues[1], 18),
      currentLockedAmount: denominateNumber(splitValues[2], 18),
      maxLockSeconds: splitValues[3],
      maxLockCounts: splitValues[4],
      currentLocks: splitValues[5],
    };
  };

  const getUserFunds = async (tokenAddress: string, address: string): Promise<number> => {
    const escrow = await getEscrowContract(CHAIN_ID);
    const funds = await escrow.getUserFunds(address, tokenAddress);
    const availableFunds = funds.available;
    const balanceString = denominateNumber(availableFunds.toString(), 18);
    return parseFloat(balanceString);
  };

  const authorizeTokens = async (
    tokenAddress: string,
    spender: string,
    maxLockedAmount: string,
    maxLockSeconds: string,
    maxLockCount: string
  ): Promise<any> => {
    const escrow = await getEscrowContract(CHAIN_ID);
    const normalizedMaxLockedAmount = normalizeNumber(maxLockedAmount, 18);
    console.log({ normalizedMaxLockedAmount, maxLockSeconds, maxLockCount });
    const authorize = await escrow.authorize(
      tokenAddress,
      spender,
      normalizedMaxLockedAmount,
      maxLockSeconds,
      maxLockCount
    );
    return authorize;
  };

  const depositTokens = async (tokenAddress: string, amount: string): Promise<any> => {
    const escrow = await getEscrowContract(CHAIN_ID);
    const normalizedAmount = normalizeNumber(amount, 18);
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await browserProvider?.getSigner());
    const approve = await token.approve(escrow.target, normalizedAmount);
    await approve.wait();
    const deposit = await escrow.deposit(tokenAddress, normalizedAmount);
    return deposit;
  };

  const getEndpointByName = async (nodeUrl: string, name: string) => {
    try {
      const providerEndpoints = await ProviderInstance.getEndpoints(nodeUrl);
      const serviceEndpoints = await ProviderInstance.getServiceEndpoints(nodeUrl, providerEndpoints);
      const endpoint = ProviderInstance.getEndpointURL(serviceEndpoints, name);
      return endpoint.urlPath;
    } catch {
      return '';
    }
  };

  const getNonce = async (address: string, nodeUrl: string): Promise<number> => {
    const endpoint = await getEndpointByName(nodeUrl, 'nonce');
    const response = await axios.get(`${endpoint}?userAddress=${address}`);
    const nonce = response.data.nonce;
    return Number(nonce);
  };

  const getJWTStorageKey = (address: string, nodeUrl: string): string => {
    return `ocean_jwt_token_${address}_${nodeUrl}`;
  };

  const saveJWTToStorage = (token: string, address: string, nodeUrl: string): void => {
    if (typeof window === 'undefined') return;
    const key = getJWTStorageKey(address, nodeUrl);
    localStorage.setItem(key, token);
  };

  const getJWTFromStorage = (address: string, nodeUrl: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const key = getJWTStorageKey(address, nodeUrl);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return null;
      }
      return stored;
    } catch {
      return null;
    }
  };

  const generateAuthToken = async (address: string, nonce: number, signature: string, nodeUrl: string) => {
    const endpoint = await getEndpointByName(nodeUrl, 'generateAuthToken');
    const response = await axios.post(endpoint, {
      address,
      signature,
      nonce: nonce.toString(),
    });
    const token = response.data.token;
    saveJWTToStorage(token, address, nodeUrl);
    return token;
  };
  return (
    <OceanContext.Provider
      value={{
        getNodeBalance,
        getSymbolByAddress,
      }}
    >
      {children}
    </OceanContext.Provider>
  );
};

export const useOceanContext = () => {
  const context = useContext(OceanContext);
  if (!context) {
    throw new Error('useOceanContext must be used within a OceanProvider');
  }
  return context;
};
