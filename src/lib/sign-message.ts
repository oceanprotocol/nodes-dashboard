import { JsonRpcSigner, Signer } from 'ethers';

export async function signMessage(message: string, signer: Signer): Promise<string> {
  try {
    return await signer.signMessage(message);
  } catch (error) {
    const network = await signer?.provider?.getNetwork();
    const chainId = Number(network?.chainId);
    if (chainId === 8996) {
      return await (signer as JsonRpcSigner)._legacySignMessage(message);
    }
    throw error;
  }
}
