import { ComputeEnvFees, ComputeEnvironment, ProviderInstance } from '@oceanprotocol/lib';

import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

export class OceanProvider {
  private chainId: number;
  private provider: ethers.BrowserProvider;

  constructor(chainId: number, provider: ethers.BrowserProvider) {
    this.chainId = chainId;
    this.provider = provider;
  }

  private async getConfigByChainId(chainId: number): Promise<any> {
    const config = Object.values(Address).find((chainConfig) => chainConfig.chainId === chainId);
    if (!config) {
      throw new Error('No config found for chainId');
    }
    return config;
  }

  denominateNumber(number: string, decimals: number) {
    return new BigNumber(number).div(new BigNumber(10).pow(decimals)).toFixed(0);
  }

  static denominateNumber(number: string, decimals: number) {
    return new BigNumber(number).div(new BigNumber(10).pow(decimals)).toFixed(0);
  }

  private normalizeNumber(number: string, decimals: number) {
    return new BigNumber(number).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);
  }

  private async getEscrowContract(chainId: number) {
    const config = await this.getConfigByChainId(chainId);
    if (!config.Escrow) {
      throw new Error('No escrow found for chainId');
    }

    const escrow = new ethers.Contract(config.Escrow, Escrow.abi, await this.provider.getSigner());
    return escrow;
  }

  async getEnvironmentsByNode(nodeUrl: string): Promise<ComputeEnvironment[]> {
    try {
      const environments = await ProviderInstance.getComputeEnvironments(nodeUrl);
      if (!environments || environments.length === 0) {
        return [];
      }

      return environments;
    } catch {
      return [];
    }
  }

  async getNodeBalance(nodeUrl: string) {
    const environments = await this.getEnvironmentsByNode(nodeUrl);

    const res = new Map<string, Map<string, string>>();
    for (const env of environments) {
      const fees = this.getFeesByChainId(this.chainId, env);
      const balances = new Map<string, string>()
      for (const fee of fees) {
          const balance = await this.getBalance(fee.feeToken, env.consumerAddress);
          balances.set(fee.feeToken, balance)
      }

      res.set(env.id, balances);
    }

    return res;
  }

  getFeesByChainId(chainId: number, environment: ComputeEnvironment): ComputeEnvFees[] {
    if (!environment?.fees) {
      return [];
    }
    const config = Object.keys(environment.fees).find((chainConfig) => Number(chainConfig) === chainId);
    if (!config) {
      return [];
    }
    return environment.fees[config] as unknown as ComputeEnvFees[];
  }

  async getBalance(tokenAddress: string, address: string): Promise<string> {
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, this.provider);
    const balance = await token.balanceOf(address);
    const decimals = await token.decimals();
    const balanceString = this.denominateNumber(balance.toString(), decimals);
    return balanceString;
  }

  async getAuthorizations(tokenAddress: string, payer: string, payee: string) {
    const escrow = await this.getEscrowContract(this.chainId);
    const authorizations = await escrow.getAuthorizations(tokenAddress, payer, payee);
    if (!authorizations || authorizations.length === 0) {
      return null;
    }
    const splitValues = authorizations.toString().split(',');
    return {
      payee: splitValues[0],
      maxLockedAmount: this.denominateNumber(splitValues[1], 18),
      currentLockedAmount: this.denominateNumber(splitValues[2], 18),
      maxLockSeconds: splitValues[3],
      maxLockCounts: splitValues[4],
      currentLocks: splitValues[5],
    };
  }

  async getUserFunds(tokenAddress: string, address: string): Promise<number> {
    const escrow = await this.getEscrowContract(this.chainId);
    const funds = await escrow.getUserFunds(address, tokenAddress);
    const availableFunds = funds.available;
    const balanceString = this.denominateNumber(availableFunds.toString(), 18);
    return parseFloat(balanceString);
  }

  async authorizeTokens(
    tokenAddress: string,
    spender: string,
    maxLockedAmount: string,
    maxLockSeconds: string,
    maxLockCount: string
  ): Promise<any> {
    const escrow = await this.getEscrowContract(this.chainId);
    const normalizedMaxLockedAmount = this.normalizeNumber(maxLockedAmount, 18);
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

  async depositTokens(tokenAddress: string, amount: string): Promise<any> {
    const escrow = await this.getEscrowContract(this.chainId);
    const normalizedAmount = this.normalizeNumber(amount, 18);
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, await this.provider.getSigner());
    const approve = await token.approve(escrow.target, normalizedAmount);
    await approve.wait();
    const deposit = await escrow.deposit(tokenAddress, normalizedAmount);
    return deposit;
  }

  private async getEndpointByName(nodeUrl: string, name: string) {
    try {
      const providerEndpoints = await ProviderInstance.getEndpoints(nodeUrl);
      const serviceEndpoints = await ProviderInstance.getServiceEndpoints(nodeUrl, providerEndpoints);
      const endpoint = ProviderInstance.getEndpointURL(serviceEndpoints, name);
      return endpoint.urlPath;
    } catch {
      return '';
    }
  }

  async getNonce(address: string, nodeUrl: string): Promise<number> {
    const endpoint = await this.getEndpointByName(nodeUrl, 'nonce');
    const response = await axios.get(`${endpoint}?userAddress=${address}`);
    const nonce = response.data.nonce;
    return Number(nonce);
  }

  private getJWTStorageKey(address: string, nodeUrl: string): string {
    return `ocean_jwt_token_${address}_${nodeUrl}`;
  }

  private saveJWTToStorage(token: string, address: string, nodeUrl: string): void {
    if (typeof window === 'undefined') return;

    const key = this.getJWTStorageKey(address, nodeUrl);
    localStorage.setItem(key, token);
  }

  getJWTFromStorage(address: string, nodeUrl: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const key = this.getJWTStorageKey(address, nodeUrl);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return null;
      }

      return stored;
    } catch {
      return null;
    }
  }

  async generateAuthToken(address: string, nonce: number, signature: string, nodeUrl: string) {
    const endpoint = await this.getEndpointByName(nodeUrl, 'generateAuthToken');
    const response = await axios.post(endpoint, {
      address,
      signature,
      nonce: nonce.toString(),
    });

    const token = response.data.token;
    this.saveJWTToStorage(token, address, nodeUrl);

    return token;
  }
}
