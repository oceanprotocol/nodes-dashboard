import { signNodeCommandMessage } from '@/lib/sign-message';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { PROTOCOL_COMMANDS, ProviderInstance } from '@oceanprotocol/lib';

export async function initializeP2P(bootstrapNodes: string[]): Promise<void> {
  await ProviderInstance.setupP2P({ bootstrapPeers: bootstrapNodes });
}

export async function getNodeEnvs(peerId: string) {
  return ProviderInstance.getComputeEnvironments(peerId);
}

export async function getNonce(peerId: string, consumerAddress: string): Promise<number> {
  return ProviderInstance.getNonce(peerId, consumerAddress);
}

export async function getComputeStatus(peerId: string, jobId: string, consumerAddress: string) {
  return ProviderInstance.fetchConfig(peerId, {
    command: PROTOCOL_COMMANDS.COMPUTE_GET_STATUS,
    jobId,
    consumerAddress,
  });
}

export async function getComputeJobResult(
  peerId: string,
  jobId: string,
  index: number,
  authToken: string,
  address: string
) {
  return ProviderInstance.fetchConfig(peerId, {
    command: PROTOCOL_COMMANDS.COMPUTE_GET_RESULT,
    jobId,
    index,
    consumerAddress: address,
    authorization: authToken,
  });
}

export async function getComputeStreamableLogs(peerId: string, jobId: string, authToken: any) {
  return ProviderInstance.fetchConfig(peerId, {
    command: PROTOCOL_COMMANDS.COMPUTE_GET_STREAMABLE_LOGS,
    jobId,
    authorization: authToken?.token ?? authToken,
  });
}

export async function createAuthToken({
  consumerAddress,
  peerId,
  signMessage,
}: {
  consumerAddress: string;
  peerId: string;
  signMessage: SignMessageFn;
}): Promise<{ token: string }> {
  const incrementedNonce = (await getNonce(peerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.CREATE_AUTH_TOKEN,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.fetchConfig(peerId, {
    address: consumerAddress,
    command: PROTOCOL_COMMANDS.CREATE_AUTH_TOKEN,
    nonce: incrementedNonce,
    signature,
  });
}

export async function getNodeLogs({
  consumerAddress,
  expiryTimestamp,
  peerId,
  params,
  signMessage,
}: {
  consumerAddress: string;
  expiryTimestamp: number;
  peerId: string;
  params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
  signMessage: SignMessageFn;
}) {
  const incrementedNonce = (await getNonce(peerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.GET_LOGS,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.fetchConfig(peerId, {
    address: consumerAddress,
    command: PROTOCOL_COMMANDS.GET_LOGS,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
    ...params,
  });
}

export async function fetchNodeConfig({
  consumerAddress,
  expiryTimestamp,
  peerId,
  signMessage,
}: {
  consumerAddress: string;
  expiryTimestamp: number;
  peerId: string;
  signMessage: SignMessageFn;
}) {
  const incrementedNonce = (await getNonce(peerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.FETCH_CONFIG,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.fetchConfig(peerId, {
    address: consumerAddress,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
  });
}

export async function pushNodeConfig({
  config,
  consumerAddress,
  expiryTimestamp,
  peerId,
  signMessage,
}: {
  consumerAddress: string;
  config: Record<string, any>;
  expiryTimestamp: number;
  peerId: string;
  signMessage: SignMessageFn;
}) {
  const incrementedNonce = (await getNonce(peerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.PUSH_CONFIG,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.pushConfig(peerId, {
    address: consumerAddress,
    config,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
  });
}

export async function initializeCompute(
  peerId: string,
  body: Record<string, unknown>
): Promise<{ payment: { amount: string; minLockSeconds: number }; status?: { httpStatus: number; error?: string } }> {
  return ProviderInstance.fetchConfig(peerId, {
    command: PROTOCOL_COMMANDS.COMPUTE_INITIALIZE,
    ...body,
  });
}

/**
 * Returns the peer identifier for use as a connection reference (e.g. VSCode extension).
 */
export async function getPeerMultiaddr(peerId: string): Promise<string> {
  try {
    console.log('🔍 getPeerMultiaddr: Getting multiaddr for peerId:', peerId);
    const multiaddr = await ProviderInstance.getMultiaddrFromPeerId(peerId);
    console.log('🔍 getPeerMultiaddr: Multiaddr:', multiaddr);
    return multiaddr;
  } catch (error) {
    throw new Error('Failed to get peer multiaddr');
  }
}
