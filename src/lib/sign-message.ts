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
  issuerPeerId = '',
  signMessage,
}: {
  command: string;
  consumerAddress: string;
  incrementedNonce: number;
  /**
   * The target node's peerId. 
   * Non-empty only for CREATE_AUTH_TOKEN; 
   * every other command validates against issuerPeerId = '' node-side, 
   * so the default keeps them byte-identical to the old format.
   * See ocean-node nonceHandler.verifyConsumerSignature and ocean.js BaseProvider.getSignature —
   * message = address + nonce + command + issuerPeerId.
   */
  issuerPeerId?: string;
  signMessage: SignMessageFn;
}): Promise<string> {
  const message = `${consumerAddress}${incrementedNonce}${command}${issuerPeerId}`;
  const signedMessage = await signMessage(message);
  return signedMessage;
}
