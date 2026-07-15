import { SignMessageFn } from '@/lib/use-ocean-account';
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
  incrementedNonce,
  signMessage,
  issuerPeerId = '',
}: {
  command: string;
  consumerAddress: string;
  incrementedNonce: number;
  signMessage: SignMessageFn;
  /**
   *  The node's own peerId.
   * Since ocean-node next-4 the signed message is `address + nonce + command + issuerPeerId`.
   * It's only non-empty for  CREATE_AUTH_TOKEN (the node validates that command against its peerId)
   * Every other command is validated with an empty issuerPeerId, so the default '' keeps those signatures identical to the old format.
   */
  issuerPeerId?: string;
}): Promise<string> {
  const message = `${consumerAddress}${incrementedNonce}${command}${issuerPeerId}`;
  const signedMessage = await signMessage(message);
  return signedMessage;
}
