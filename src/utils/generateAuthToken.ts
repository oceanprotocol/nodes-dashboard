import { createAuthToken, getNonce, type MultiaddrsOrPeerId } from '@/services/nodeService';

export async function generateAuthToken(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  address: string,
  signMessage: (message: string) => Promise<string>
) {
  const nonce = await getNonce(multiaddrsOrPeerId, address);
  const incrementedNonce = (nonce + 1).toString();
  const messageToSign = address + incrementedNonce;
  const signedMessage = await signMessage(messageToSign);
  const response = await createAuthToken(multiaddrsOrPeerId, address, signedMessage, incrementedNonce);
  return response.token;
}
