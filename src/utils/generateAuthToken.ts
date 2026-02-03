import { createAuthToken, getNonce } from '@/services/nodeService';

export async function generateAuthTokenWithSmartAccount(
  peerId: string,
  address: string,
  signMessageAsync: any
): Promise<string> {
  const nonce = await getNonce(peerId, address);
  const incrementedNonce = (nonce + 1).toString();
  const messageToSign = address + incrementedNonce;
  const signedMessage = await signMessageAsync({
    message: messageToSign,
  });
  const response = await createAuthToken(peerId, address, signedMessage, incrementedNonce);
  return response.token;
}
