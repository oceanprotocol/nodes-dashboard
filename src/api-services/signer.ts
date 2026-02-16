import { RPC_URL } from '@/lib/constants';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';

export async function signFaucetMessage({
  amount,
  faucetAddress,
  faucetPrivateKey,
  nonce,
  tokenAddress,
  walletAddress,
}: {
  amount: string;
  faucetAddress: string;
  faucetPrivateKey: string;
  nonce: number;
  tokenAddress: string;
  walletAddress: string;
}) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(faucetPrivateKey, provider);

  const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
  const amountBigInt = ethers.parseUnits(amount, tokenDecimals);

  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint256', 'uint256'],
    [faucetAddress, walletAddress, nonce, amountBigInt]
  );
  const messageHash = ethers.keccak256(encoded);

  const signedMessage = await wallet.signMessage(ethers.getBytes(messageHash));

  return {
    signature: signedMessage,
    amount: amountBigInt.toString(),
  };
}
