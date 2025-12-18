import { getBytes, keccak256, Signer, toUtf8Bytes } from 'ethers';

export async function signMessage(message: string, signer: Signer): Promise<string> {
  const consumerMessage = keccak256(toUtf8Bytes(message));
  const messageHashBytes = getBytes(consumerMessage);
  return await signer.signMessage(messageHashBytes);
}
