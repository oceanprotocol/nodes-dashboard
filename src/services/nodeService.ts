import { signNodeCommandMessage } from '@/lib/sign-message';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { EscrowEvent } from '@/types/payment';
import { Multiaddr, multiaddr } from '@multiformats/multiaddr';
import {
  PROTOCOL_COMMANDS,
  ProviderInstance,
  type NodeLogsParams,
  type NodeP2P,
  type OceanNode,
  type PersistentStorageAccessList,
  type PersistentStorageBucket,
  type PersistentStorageDeleteFileResponse,
  type PersistentStorageFileEntry,
} from '@oceanprotocol/lib';

type NodeUri = OceanNode | string[];

function normalizeNodeUri(input: NodeUri): OceanNode {
  if (Array.isArray(input)) {
    return { multiaddress: input.map((a) => multiaddr(a)) } as NodeP2P;
  }
  return input;
}

export async function initializeP2P(bootstrapNodes: string[]): Promise<void> {
  await ProviderInstance.setupP2P({
    bootstrapPeers: bootstrapNodes,
    libp2p: {
      connectionGater: {
        denyDialMultiaddr: async (multiaddr: Multiaddr) => {
          const addr = multiaddr.toString();
          return !(addr.includes('/tls') || addr.includes('/wss'));
        },
      },
    },
  });
  console.log('P2P node set up');
}

export async function getNodeEnvs(nodeUri: NodeUri) {
  return ProviderInstance.getComputeEnvironments(normalizeNodeUri(nodeUri));
}

// Query a node's indexed escrow events. Nodes index ALL on-chain escrow events (not just their
// own), so this discovers every payee a payer has authorized without iterating compute envs.
// Not wrapped by ocean.js — hit the node HTTP route directly.
export async function getEscrowEvents(
  nodeHttpUrl: string,
  filters: {
    chainId?: number;
    eventType?: string;
    payer?: string;
    payee?: string;
    token?: string;
    jobId?: string;
    txId?: string;
    offset?: number;
    size?: number;
  }
): Promise<EscrowEvent[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  const url = `${nodeHttpUrl.replace(/\/$/, '')}/api/services/escrow/events?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch escrow events: ${response.status}`);
  }
  return (await response.json()) as EscrowEvent[];
}

export async function getNonce(nodeUri: NodeUri, consumerAddress: string): Promise<number> {
  return ProviderInstance.getNonce(normalizeNodeUri(nodeUri), consumerAddress);
}

export async function getComputeStatus(nodeUri: NodeUri, authToken: string, jobId: string) {
  return ProviderInstance.computeStatus(normalizeNodeUri(nodeUri), authToken, jobId);
}

export async function getComputeJobResult(nodeUri: NodeUri, authToken: string, jobId: string, index: number) {
  const stream = await ProviderInstance.getComputeResult(normalizeNodeUri(nodeUri), authToken, jobId, index);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function streamComputeResult(nodeUri: NodeUri, authToken: string, jobId: string, index: number) {
  return ProviderInstance.getComputeResult(normalizeNodeUri(nodeUri), authToken, jobId, index);
}

export async function createAuthToken({
  consumerAddress,
  nodeUri,
  signMessage,
  validUntil,
}: {
  consumerAddress: string;
  nodeUri: NodeUri;
  signMessage: SignMessageFn;
  validUntil?: number;
}): Promise<{ token: string }> {
  const incrementedNonce = (await getNonce(nodeUri, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.CREATE_AUTH_TOKEN,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  const token = await ProviderInstance.generateSignedAuthToken(
    consumerAddress,
    signature,
    incrementedNonce.toString(),
    normalizeNodeUri(nodeUri),
    validUntil
  );
  return { token };
}

export async function revokeAuthToken({
  consumerAddress,
  nodeUri,
  signMessage,
  token,
}: {
  consumerAddress: string;
  nodeUri: NodeUri;
  signMessage: SignMessageFn;
  token: string;
}): Promise<{ success: boolean }> {
  const incrementedNonce = (await getNonce(nodeUri, consumerAddress)) + 1;
  const signature = await signMessage(`${consumerAddress}${incrementedNonce}`);
  return ProviderInstance.invalidateAuthToken(
    {
      getAddress: async () => consumerAddress,
      signMessage: async () => signature,
    } as any,
    token,
    normalizeNodeUri(nodeUri)
  );
}

export async function initializeCompute(
  nodeUri: NodeUri,
  assets: any[],
  algorithm: any,
  computeEnv: string,
  token: string,
  validUntil: number,
  consumerAddress: string,
  resources: { id: string; amount: number }[],
  chainId: number
) {
  return ProviderInstance.initializeCompute(
    assets,
    algorithm,
    computeEnv,
    token,
    validUntil,
    normalizeNodeUri(nodeUri),
    consumerAddress,
    resources,
    chainId
  );
}

// --- Admin commands (keep fetchConfig/pushConfig -- custom signing with expiry) ---

export async function getNodeLogs({
  consumerAddress,
  nodeUri,
  params,
  signMessage,
}: {
  consumerAddress: string;
  nodeUri: NodeUri;
  params: NodeLogsParams;
  signMessage: SignMessageFn;
}) {
  const incrementedNonce = (await getNonce(nodeUri, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.GET_LOGS,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.downloadNodeLogs(
    normalizeNodeUri(nodeUri),
    { consumerAddress, nonce: incrementedNonce.toString(), signature },
    params.startTime ?? '',
    params.endTime ?? '',
    params.maxLogs,
    params.moduleName,
    params.level,
    params.page
  );
}

export async function fetchNodeConfig({
  consumerAddress,
  expiryTimestamp,
  nodeUri,
  signMessage,
}: {
  consumerAddress: string;
  expiryTimestamp: number;
  nodeUri: NodeUri;
  signMessage: SignMessageFn;
}) {
  const incrementedNonce = (await getNonce(nodeUri, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.FETCH_CONFIG,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.fetchConfig(normalizeNodeUri(nodeUri), {
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
  nodeUri,
  signMessage,
}: {
  consumerAddress: string;
  config: Record<string, any>;
  expiryTimestamp: number;
  nodeUri: NodeUri;
  signMessage: SignMessageFn;
}) {
  const incrementedNonce = (await getNonce(nodeUri, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.PUSH_CONFIG,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return ProviderInstance.pushConfig(normalizeNodeUri(nodeUri), {
    address: consumerAddress,
    config,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
  });
}

export async function getPeerMultiaddr(peerId: string): Promise<string> {
  return ProviderInstance.getMultiaddrFromPeerId(peerId);
}

export async function getNodeBuckets({
  authToken,
  nodeUri,
  ownerAddress,
}: {
  authToken: string;
  nodeUri: NodeUri;
  ownerAddress: string;
}): Promise<PersistentStorageBucket[]> {
  return ProviderInstance.getPersistentStorageBuckets(normalizeNodeUri(nodeUri), authToken, ownerAddress);
}

export async function createNodeBucket({
  accessLists,
  authToken,
  label,
  nodeUri,
}: {
  accessLists: PersistentStorageAccessList[];
  authToken: string;
  label?: string;
  nodeUri: NodeUri;
}): Promise<{
  bucketId: string;
  owner: string;
  accessList: PersistentStorageAccessList[];
  label?: string | null;
}> {
  return ProviderInstance.createPersistentStorageBucket(normalizeNodeUri(nodeUri), authToken, { accessLists, label });
}

export async function renameNodeBucket({
  authToken,
  bucketId,
  label,
  nodeUri,
}: {
  authToken: string;
  bucketId: string;
  label: string | null;
  nodeUri: NodeUri;
}): Promise<{ bucketId: string; label: string | null }> {
  return ProviderInstance.updatePersistentStorageBucket(normalizeNodeUri(nodeUri), authToken, bucketId, label);
}

export async function listBucketFiles({
  authToken,
  bucketId,
  nodeUri,
}: {
  authToken: string;
  bucketId: string;
  nodeUri: NodeUri;
}): Promise<PersistentStorageFileEntry[]> {
  return ProviderInstance.listPersistentStorageFiles(normalizeNodeUri(nodeUri), authToken, bucketId);
}

async function* fileToAsyncIterable(file: File): AsyncIterable<Uint8Array> {
  const reader = file.stream().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function uploadBucketFile({
  authToken,
  bucketId,
  file,
  nodeUri,
}: {
  authToken: string;
  bucketId: string;
  file: File;
  nodeUri: NodeUri;
}): Promise<PersistentStorageFileEntry> {
  return ProviderInstance.uploadPersistentStorageFile(
    normalizeNodeUri(nodeUri),
    authToken,
    bucketId,
    file.name,
    fileToAsyncIterable(file)
  );
}

export async function deleteBucketFile({
  authToken,
  bucketId,
  fileName,
  nodeUri,
}: {
  authToken: string;
  bucketId: string;
  fileName: string;
  nodeUri: NodeUri;
}): Promise<PersistentStorageDeleteFileResponse> {
  return ProviderInstance.deletePersistentStorageFile(normalizeNodeUri(nodeUri), authToken, bucketId, fileName);
}
