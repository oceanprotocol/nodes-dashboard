import { CHAIN_ID } from '@/constants/chains';
import { Authorizations } from '@/types/payment';
import { proxyFetch } from '@/utils/proxy-fetch';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ComputeEnvFees, ComputeEnvironment, ComputeResourceRequest, ProviderInstance } from '@oceanprotocol/lib';
import { Provider } from '@reown/appkit-adapter-ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import BigNumber from 'bignumber.js';
import { BrowserProvider, ethers } from 'ethers';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type OceanContextType = {
  authorizeTokens: (
    tokenAddress: string,
    spender: string,
    maxLockedAmount: string,
    maxLockSeconds: string,
    maxLockCount: string
  ) => Promise<any>;
  depositTokens: (tokenAddress: string, amount: string) => Promise<any>;
  getAuthorizations: (tokenAddress: string, payer: string, payee: string) => Promise<any>;
  getBalance: (tokenAddress: string, address: string) => Promise<{ symbol: string; balance: string }>;
  getFeesByChainId: (chainId: number, environment: ComputeEnvironment) => Promise<ComputeEnvFees[]>;
  getNodeBalance: (nodeUrl: string) => Promise<Map<string, number>>;
  getSymbolByAddress: (tokenAddress: string) => Promise<string>;
  getUserFunds: (tokenAddress: string, address: string) => Promise<number>;
};

const OceanContext = createContext<OceanContextType | undefined>(undefined);

export const OceanProvider = ({ children }: { children: ReactNode }) => {
  const { walletProvider } = useAppKitProvider<Provider>('eip155');

  const provider = useMemo(() => {
    if (!walletProvider) {
      return null;
    }
    return new BrowserProvider(walletProvider, CHAIN_ID);
  }, [walletProvider]);

  async function getConfigByChainId(chainId: number): Promise<any> {
    const config = Object.values(Address).find((chainConfig) => chainConfig.chainId === chainId);
    if (!config) {
      throw new Error('No config found for chainId');
    }
    return config;
  }

  function denominateNumber(number: string, decimals: number) {
    return new BigNumber(number).div(new BigNumber(10).pow(decimals));
    // .toFixed(0);
  }

  function normalizeNumber(number: string, decimals: number) {
    return new BigNumber(number).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);
  }

  async function getEscrowContract(chainId: number) {
    const config = await getConfigByChainId(chainId);
    if (!config.Escrow) {
      throw new Error('No escrow found for chainId');
    }

    const escrow = new ethers.Contract(config.Escrow, Escrow.abi, await provider?.getSigner());
    return escrow;
  }

  async function getEnvironmentsByNode(nodeUrl: string): Promise<ComputeEnvironment[]> {
    try {
      const response = await proxyFetch(`${nodeUrl}/api/services/computeEnvironments`);
      const data = await response.json();
      return data;
    } catch {
      return [];
    }
  }

  const getNodeBalance = async (nodeUrl: string) => {
    const result = new Map<string, number>();
    try {
      const environments = await getEnvironmentsByNode(nodeUrl);
      const balancesMap = new Map<string, string[]>();
      for (const env of environments) {
        const fees = await getFeesByChainId(CHAIN_ID, env);
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

  async function getFeesByChainId(chainId: number, environment: ComputeEnvironment): Promise<ComputeEnvFees[]> {
    if (!environment?.fees) {
      return [];
    }
    const config = Object.keys(environment.fees).find((chainConfig) => Number(chainConfig) === chainId);
    if (!config) {
      return [];
    }
    return environment.fees[config] as unknown as ComputeEnvFees[];
  }

  async function getSymbolByAddress(tokenAddress: string): Promise<string> {
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await provider?.getSigner());
    const symbol = (await token.symbol()) || tokenAddress;
    return symbol;
  }

  async function getBalance(tokenAddress: string, address: string): Promise<{ symbol: string; balance: string }> {
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await provider?.getSigner());
    const balance = await token.balanceOf(address);
    console.log(balance);
    const symbol = (await token.symbol()) || tokenAddress;
    const decimals = await token.decimals();
    const balanceString = denominateNumber(balance.toString(), decimals);
    return { symbol, balance: balanceString };
  }

  async function getAuthorizations(tokenAddress: string, payer: string, payee: string): Promise<Authorizations | null> {
    const escrow = await getEscrowContract(CHAIN_ID);
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
    const authorizations = await escrow.getAuthorizations(tokenAddress, payer, payee);
    if (!authorizations || authorizations.length === 0) {
      return null;
    }
    const splitValues = authorizations.toString().split(',');
    return {
      payee: splitValues[0],
      maxLockedAmount: denominateNumber(splitValues[1], tokenDecimals),
      currentLockedAmount: denominateNumber(splitValues[2], tokenDecimals),
      maxLockSeconds: splitValues[3],
      maxLockCounts: splitValues[4],
      currentLocks: splitValues[5],
    };
  }

  async function getUserFunds(tokenAddress: string, address: string): Promise<number> {
    const escrow = await getEscrowContract(CHAIN_ID);
    const funds = await escrow.getUserFunds(address, tokenAddress);
    const availableFunds = funds.available;
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
    const balanceString = denominateNumber(availableFunds.toString(), tokenDecimals);
    return parseFloat(balanceString);
  }

  async function authorizeTokens(
    tokenAddress: string,
    spender: string,
    maxLockedAmount: string,
    maxLockSeconds: string,
    maxLockCount: string
  ): Promise<any> {
    const escrow = await getEscrowContract(CHAIN_ID);
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
    const normalizedMaxLockedAmount = normalizeNumber(maxLockedAmount, tokenDecimals);
    console.log({ normalizedMaxLockedAmount, maxLockSeconds, maxLockCount });
    const authorize = await escrow.authorize(
      tokenAddress,
      spender,
      normalizedMaxLockedAmount,
      maxLockSeconds,
      maxLockCount
    );
    return authorize;
  }

  async function depositTokens(tokenAddress: string, amount: string): Promise<any> {
    const escrow = await getEscrowContract(CHAIN_ID);
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
    const normalizedAmount = normalizeNumber(amount, tokenDecimals);
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await provider?.getSigner());
    const approve = await token.approve(escrow.target, normalizedAmount);
    await approve.wait();
    const deposit = await escrow.deposit(tokenAddress, normalizedAmount);
    return deposit;
  }

  async function getEndpointByName(nodeUrl: string, name: string) {
    try {
      const providerEndpointsResponse = await proxyFetch(nodeUrl);
      const providerEndpoints = await providerEndpointsResponse.json();
      console.log({ providerEndpoints });
      const serviceEndpoints = await ProviderInstance.getServiceEndpoints(nodeUrl, providerEndpoints);
      const endpoint = ProviderInstance.getEndpointURL(serviceEndpoints, name);
      return endpoint.urlPath;
    } catch {
      return '';
    }
  }

  async function getNonce(address: string, nodeUrl: string): Promise<number> {
    const endpoint = await getEndpointByName(nodeUrl, 'nonce');
    const response = await proxyFetch(`${endpoint}?userAddress=${address}`);
    const data = await response.json();
    const nonce = data.nonce;
    return Number(nonce);
  }

  function getJWTStorageKey(address: string, nodeUrl: string): string {
    return `ocean_jwt_token_${address}_${nodeUrl}`;
  }

  function saveJWTToStorage(token: string, address: string, nodeUrl: string): void {
    if (typeof window === 'undefined') return;

    const key = getJWTStorageKey(address, nodeUrl);
    localStorage.setItem(key, token);
  }

  function getJWTFromStorage(address: string, nodeUrl: string): string | null {
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
  }

  async function generateAuthToken(address: string, nonce: number, signature: string, nodeUrl: string) {
    const endpoint = await getEndpointByName(nodeUrl, 'generateAuthToken');
    const response = await proxyFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        signature,
        nonce: nonce.toString(),
      }),
    });

    const data = await response.json();
    const token = data.token;
    saveJWTToStorage(token, address, nodeUrl);

    return token;
  }

  async function initializeCompute(
    environment: ComputeEnvironment,
    tokenAddress: string,
    validUntil: number,
    nodeUrl: string,
    address: string,
    resources: ComputeResourceRequest[]
  ): Promise<any> {
    const endpoint = await getEndpointByName(nodeUrl, 'initializeCompute');
    const response = await proxyFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasets: [],
        algorithm: { meta: { rawcode: 'rawcode' } },
        environment: environment.id,
        payment: {
          chainId: CHAIN_ID,
          token: tokenAddress,
          resources,
        },
        maxJobDuration: validUntil,
        consumerAddress: address,
        signature: '',
      }),
    });

    const data = await response.json();
    const cost = data.payment.amount;
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
    const denominatedCost = denominateNumber(cost, tokenDecimals);

    return denominatedCost;
  }

  async function updateConfiguration(
    authToken: string,
    address: string,
    nodeUrl: string,
    isFreeCompute: boolean,
    environmentId: string,
    feeToken: string,
    jobDuration: number,
    resources: ComputeResourceRequest[],
    ide: string
  ) {
    const extensionUrl = `${ide}://oceanprotocol.ocean-protocol-vscode-extension/updateConfiguration`;
    const url = new URL(extensionUrl);
    url.searchParams.set('authToken', authToken);
    url.searchParams.set('nodeUrl', nodeUrl);
    url.searchParams.set('isFreeCompute', isFreeCompute.toString());
    url.searchParams.set('environmentId', environmentId);
    url.searchParams.set('feeToken', feeToken);
    url.searchParams.set('jobDuration', jobDuration.toString());
    url.searchParams.set('resources', JSON.stringify(resources));
    url.searchParams.set('address', address);
    url.searchParams.set('chainId', CHAIN_ID.toString());

    if (typeof window !== 'undefined') {
      window.open(url.toString(), '_self');
    }
  }

  return (
    <OceanContext.Provider
      value={{
        authorizeTokens,
        depositTokens,
        getAuthorizations,
        getBalance,
        getFeesByChainId,
        getNodeBalance,
        getSymbolByAddress,
        getUserFunds,
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
