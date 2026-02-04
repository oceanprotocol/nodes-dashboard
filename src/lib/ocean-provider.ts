import { directNodeCommand } from '@/lib/direct-node-command';
import { getTokenSymbol } from '@/lib/token-symbol';
import { ComputeEnvironment } from '@/types/environments';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ComputeEnvFees, ComputeResourceRequest } from '@oceanprotocol/lib';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

export class OceanProvider {
  private chainId: number;
  private provider: ethers.BrowserProvider | ethers.JsonRpcProvider;

  constructor(chainId: number, provider: ethers.BrowserProvider | ethers.JsonRpcProvider) {
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
    const decimalsNumber = Number(decimals);
    return new BigNumber(number).div(new BigNumber(10).pow(decimalsNumber)).decimalPlaces(decimalsNumber).toString();
  }

  static denominateNumber(number: string, decimals: number) {
    const decimalsNumber = Number(decimals);
    return new BigNumber(number).div(new BigNumber(10).pow(decimalsNumber)).decimalPlaces(decimalsNumber).toString();
  }

  private normalizeNumber(number: string, decimals: number) {
    return new BigNumber(number).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);
  }

  private async getEscrowContract(chainId: number) {
    const config = await this.getConfigByChainId(chainId);
    if (!config.Escrow) {
      throw new Error('No escrow found for chainId');
    }

    const escrow = new ethers.Contract(config.Escrow, Escrow.abi, this.provider);
    return escrow;
  }

  async getNodeBalance(environments: ComputeEnvironment[]) {
    const result = [];
    try {
      const balancesMap = new Map<string, string[]>();
      const addressMap = new Map<string, string>();
      for (const env of environments) {
        const fees = await this.getFeesByChainId(this.chainId, env);
        for (const fee of fees) {
          const balance = await this.getBalance(fee.feeToken, env.consumerAddress);
          const symbol = await getTokenSymbol(fee.feeToken);
          if (symbol) {
            if (!addressMap.has(symbol)) {
              addressMap.set(symbol, fee.feeToken);
            }
            if (balancesMap.has(symbol)) {
              const balances = balancesMap.get(symbol) || [];
              balances.push(balance);
              balancesMap.set(symbol, balances);
              continue;
            }
            balancesMap.set(symbol, [balance]);
          }
        }
      }

      for (const [key, value] of balancesMap) {
        const sum = value.map((val) => new BigNumber(val)).reduce((acc, val) => acc.plus(val), new BigNumber(0));
        result.push({ token: key, address: addressMap.get(key) || '', amount: sum.toNumber() });
      }
    } catch (error) {
      console.log(error);
    }
    return result;
  }

  async getFeesByChainId(chainId: number, environment: ComputeEnvironment): Promise<ComputeEnvFees[]> {
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
    if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(payer) || !ethers.isAddress(payee)) {
      console.error('Invalid address passed to getAuthorizations', { tokenAddress, payer, payee });
      return null;
    }
    const escrow = await this.getEscrowContract(this.chainId);
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, this.provider).decimals();
    const authorizations = await escrow.getAuthorizations(tokenAddress, payer, payee);
    if (!authorizations || authorizations.length === 0) {
      return null;
    }
    const splitValues = authorizations.toString().split(',');
    return {
      payee: splitValues[0],
      maxLockedAmount: this.denominateNumber(splitValues[1], tokenDecimals),
      currentLockedAmount: this.denominateNumber(splitValues[2], tokenDecimals),
      maxLockSeconds: splitValues[3],
      maxLockCounts: splitValues[4],
      currentLocks: splitValues[5],
    };
  }

  async getUserFunds(tokenAddress: string, address: string): Promise<number> {
    const escrow = await this.getEscrowContract(this.chainId);
    const funds = await escrow.getUserFunds(address, tokenAddress);
    const availableFunds = funds.available;
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, this.provider).decimals();
    const balanceString = this.denominateNumber(availableFunds.toString(), tokenDecimals);
    return parseFloat(balanceString);
  }

  async authorizeTokensEoa({
    tokenAddress,
    spender,
    maxLockedAmount,
    maxLockSeconds,
    maxLockCount,
  }: {
    tokenAddress: string;
    spender: string;
    maxLockedAmount: string;
    maxLockSeconds: string;
    maxLockCount: string;
  }): Promise<any> {
    if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spender)) {
      console.error('Invalid address passed to authorizeTokensEoa', { tokenAddress, spender });
      throw new Error('Invalid address');
    }
    const escrow = await this.getEscrowContract(this.chainId);
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, this.provider).decimals();
    const normalizedMaxLockedAmount = this.normalizeNumber(maxLockedAmount, tokenDecimals);
    const signer = await this.provider.getSigner();
    const escrowWithSigner = escrow.connect(signer) as ethers.Contract;
    const authorize = await escrowWithSigner.authorize(
      tokenAddress,
      spender,
      normalizedMaxLockedAmount,
      maxLockSeconds,
      maxLockCount
    );
    return authorize;
  }

  async depositTokensEoa({ tokenAddress, amount }: { tokenAddress: string; amount: string }): Promise<any> {
    if (!ethers.isAddress(tokenAddress)) {
      console.error('Invalid address passed to depositTokensEoa', { tokenAddress });
      throw new Error('Invalid address');
    }
    const escrow = await this.getEscrowContract(this.chainId);
    const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, this.provider).decimals();
    const normalizedAmount = this.normalizeNumber(amount, tokenDecimals);
    const signer = await this.provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20Template.abi, signer);
    const approve = await token.approve(escrow.target, normalizedAmount);
    await approve.wait();
    const escrowWithSigner = escrow.connect(signer) as ethers.Contract;
    const deposit = await escrowWithSigner.deposit(tokenAddress, normalizedAmount);
    return deposit;
  }

  async withdrawTokensEoa({ tokenAddresses, amounts }: { tokenAddresses: string[]; amounts: string[] }): Promise<any> {
    if (!tokenAddresses.every((addr) => ethers.isAddress(addr))) {
      console.error('Invalid address passed to withdrawTokensEoa', { tokenAddresses });
      throw new Error('Invalid address');
    }
    const escrow = await this.getEscrowContract(this.chainId);
    const signer = await this.provider.getSigner();
    const escrowWithSigner = escrow.connect(signer) as ethers.Contract;
    const normalizedAmounts = await Promise.all(
      tokenAddresses.map(async (tokenAddress, index) => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20Template.abi, this.provider);
        const tokenDecimals = await tokenContract.decimals();
        return this.normalizeNumber(amounts[index], tokenDecimals);
      })
    );
    const withdraw = await escrowWithSigner.withdraw(tokenAddresses, normalizedAmounts);
    return withdraw;
  }

  async getNonce(address: string, peerId: string): Promise<number> {
    const response = await directNodeCommand('nonce', peerId, { address });
    const data = await response.json();
    return Number(data);
  }

  async generateAuthToken(address: string, nonce: number, signature: string, peerId: string) {
    const response = await directNodeCommand('createAuthToken', peerId, {
      address,
      signature,
      nonce: nonce.toString(),
    });
    const data = await response.json();
    const token = data.token;

    return token;
  }

  async updateConfiguration(
    authToken: string,
    address: string,
    peerId: string,
    peerMultiaddr: string,
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
    url.searchParams.set('peerId', peerId);
    url.searchParams.set('multiaddresses', peerMultiaddr);
    url.searchParams.set('isFreeCompute', isFreeCompute.toString());
    url.searchParams.set('environmentId', environmentId);
    url.searchParams.set('feeToken', feeToken);
    url.searchParams.set('jobDuration', jobDuration.toString());
    url.searchParams.set('resources', JSON.stringify(resources));
    url.searchParams.set('address', address);
    url.searchParams.set('chainId', this.chainId.toString());

    if (typeof window !== 'undefined') {
      window.open(url.toString(), '_self');
    }
  }
}
