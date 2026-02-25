import { SignMessageFn } from '@/lib/use-ocean-account';
import { Command } from '@/types/commands';
import { getBytes, JsonRpcSigner, keccak256, Signer, toUtf8Bytes } from 'ethers';

export async function signMessage(message: string, signer: Signer): Promise<string> {
  try {
    const consumerMessage = keccak256(toUtf8Bytes(message));
    const messageHashBytes = getBytes(consumerMessage);

    return await signer.signMessage(messageHashBytes);
  } catch (error) {
    const network = await signer?.provider?.getNetwork();
    const chainId = Number(network?.chainId);
    if (chainId === 8996) {
      return await (signer as JsonRpcSigner)._legacySignMessage(message);
    }
    throw error;
  }
}

export async function signNodeCommandMessage({
  command,
  consumerAddress,
  nonce,
  signMessage,
}: {
  command: Command;
  consumerAddress: string;
  nonce: number;
  signMessage: SignMessageFn;
}): Promise<string> {
  const message = `${consumerAddress}${nonce + 1}${command}`;
  const signedMessage = await signMessage(message);
  return signedMessage;
}
