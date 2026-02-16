import { createAuthToken, getNonce } from '@/services/nodeService';

export async function generateAuthToken(
  peerId: string,
  address: string,
  signMessage: (message: string) => Promise<string>
) {
  const nonce = await getNonce(peerId, address);
  const incrementedNonce = (nonce + 1).toString();
  const messageToSign = address + incrementedNonce;
  const signedMessage = await signMessage(messageToSign);
  const response = await createAuthToken(peerId, address, signedMessage, incrementedNonce);
  return response.token;
}
