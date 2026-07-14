import { NODE_URL } from '@/lib/constants';
import { signNodeCommandMessage } from '@/lib/sign-message';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { EscrowEvent } from '@/types/payment';
import { Multiaddr, multiaddr } from '@multiformats/multiaddr';
import {
  PROTOCOL_COMMANDS,
  ProviderInstance,
  type ComputeAlgorithm,
  type ComputeAsset,
  type ComputeJob,
  type ComputeJobMetadata,
  type ComputeResourceRequest,
  type NodeLogsParams,
  type NodeP2P,
  type OceanNode,
  type PersistentStorageAccessList,
  type PersistentStorageBucket,
  type PersistentStorageDeleteFileResponse,
  type PersistentStorageFileEntry,
  type ServiceJob,
  type ServicePayment,
  type ServiceStartParams,
  type SignerOrAuthTokenOrSignature,
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
export async function getEscrowEvents(filters: {
  chainId?: number;
  eventType?: string;
  payer?: string;
  payee?: string;
  token?: string;
  jobId?: string;
  txId?: string;
  offset?: number;
  size?: number;
}): Promise<EscrowEvent[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  const url = `${NODE_URL}/api/services/escrow/events?${params.toString()}`;
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

export async function streamComputeLogs(
  nodeUri: NodeUri,
  authToken: string,
  jobId: string,
  signal?: AbortSignal
): Promise<AsyncIterable<Uint8Array>> {
  return ProviderInstance.computeStreamableLogs(normalizeNodeUri(nodeUri), authToken, jobId, signal);
}

export async function createAuthToken({
  consumerAddress,
  nodeUri,
  signMessage,
  validUntil,
  issuerPeerId,
}: {
  consumerAddress: string;
  nodeUri: NodeUri;
  signMessage: SignMessageFn;
  // Epoch-ms instant the token expires. Omitted (or undefined) means the node stores it with no
  // expiry — valid forever until explicitly invalidated (a deliberate choice for the user-facing
  // token generator). Callers that cache tokens should pass a bounded value (see node-auth-context).
  validUntil?: number;
  // The target node's own peerId. Required by ocean-node (next-4) to validate
  // the CREATE_AUTH_TOKEN signature (`address + nonce + command + issuerPeerId`).
  // Pass it when the caller already has it (avoids a round-trip); otherwise it's
  // resolved from the node STATUS here.
  issuerPeerId?: string;
}): Promise<{ token: string; validUntil?: number }> {
  const resolvedNode = normalizeNodeUri(nodeUri);
  const peerId = issuerPeerId ?? (await ProviderInstance.getNodeStatus(resolvedNode))?.id;
  if (!peerId) {
    throw new Error('Could not resolve node peerId for auth token signature.');
  }
  const incrementedNonce = (await getNonce(nodeUri, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command: PROTOCOL_COMMANDS.CREATE_AUTH_TOKEN,
    consumerAddress,
    incrementedNonce,
    issuerPeerId: peerId,
    signMessage,
  });
  const token = await ProviderInstance.generateSignedAuthToken(
    consumerAddress,
    signature,
    incrementedNonce.toString(),
    normalizeNodeUri(nodeUri),
    validUntil
  );
  return { token, validUntil };
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

// Resolve a published dataset DDO by DID (P2P GET_DDO). Used to turn a dataset DID into the
// { documentId, serviceId } pair that computeStart expects.
export async function resolveDdo(nodeUri: NodeUri, did: string) {
  return ProviderInstance.resolveDdo(normalizeNodeUri(nodeUri), did);
}

// Start a paid compute job. signerOrAuthToken accepts the consumer's auth token string.
export async function startCompute({
  algorithm,
  authToken,
  chainId,
  computeEnv,
  datasets,
  maxJobDuration,
  metadata,
  nodeUri,
  outputBucketId,
  resources,
  token,
}: {
  algorithm: ComputeAlgorithm;
  authToken: string;
  chainId: number;
  computeEnv: string;
  datasets: ComputeAsset[];
  maxJobDuration: number;
  metadata?: ComputeJobMetadata;
  nodeUri: NodeUri;
  outputBucketId?: string;
  resources: ComputeResourceRequest[];
  token: string;
}): Promise<ComputeJob | ComputeJob[]> {
  return ProviderInstance.computeStart(
    normalizeNodeUri(nodeUri),
    authToken,
    computeEnv,
    datasets,
    algorithm,
    maxJobDuration,
    token,
    resources,
    chainId,
    metadata,
    undefined, // additionalViewers
    undefined, // output
    undefined, // policyServer
    undefined, // signal
    undefined, // queueMaxWaitTime
    undefined, // dockerRegistryAuth
    outputBucketId
  );
}

// Start a free compute job.
export async function startFreeCompute({
  algorithm,
  authToken,
  computeEnv,
  datasets,
  metadata,
  nodeUri,
  outputBucketId,
  resources,
}: {
  algorithm: ComputeAlgorithm;
  authToken: string;
  computeEnv: string;
  datasets: ComputeAsset[];
  metadata?: ComputeJobMetadata;
  nodeUri: NodeUri;
  outputBucketId?: string;
  resources: ComputeResourceRequest[];
}): Promise<ComputeJob | ComputeJob[]> {
  return ProviderInstance.freeComputeStart(
    normalizeNodeUri(nodeUri),
    authToken,
    computeEnv,
    datasets,
    algorithm,
    resources,
    metadata,
    undefined, // additionalViewers
    undefined, // output
    undefined, // policyServer
    undefined, // signal
    undefined, // queueMaxWaitTime
    undefined, // dockerRegistryAuth
    outputBucketId
  );
}

// --- Service on Demand (long-lived containers, e.g. vLLM inference) ---

/**
 * Start a service-on-demand container on the node. `params.userData` is passed plaintext —
 * ocean.js ECIES-encrypts it to the node public key before sending. The node responds
 * immediately with a job in `Starting` state (no endpoints yet); poll getServiceStatus until
 * it reaches `Running` to read `endpoints`. `signerOrAuthToken` is a JWT auth token string
 * (from createAuthToken), a Signer, or a pre-computed signature.
 */
export async function serviceStart(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  params: ServiceStartParams
): Promise<ServiceJob[]> {
  return ProviderInstance.serviceStart(normalizeNodeUri(nodeUri), signerOrAuthToken, params);
}

/**
 * Fetch the caller's service jobs. Pass a serviceId to scope to one service, or omit to list
 * all of the authenticated owner's services. Endpoints are only populated once a service is Running.
 */
export async function getServiceStatus(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  serviceId?: string
): Promise<ServiceJob[]> {
  return ProviderInstance.getServiceStatus(normalizeNodeUri(nodeUri), signerOrAuthToken, serviceId);
}

/**
 * Fetch a running service's container logs, collected into a single string. `since` optionally
 * bounds the lower time (Unix seconds, or a relative duration like '30s'/'2h'). Returns '' when the
 * node has no log stream (e.g. logs route not implemented). Useful for diagnosing a container that
 * started then exited (vLLM crash, bad args).
 *
 * The node streams Docker logs with `follow: true` — the stream never ends on its own. We therefore
 * bound collection: resolve after `idleMs` with no new chunk (the container has flushed its output),
 * or after a hard `maxMs` cap, and abort the underlying stream so it doesn't leak.
 */
// The P2P transport yields byte data in assorted shapes (Uint8Array — possibly cross-realm so
// `instanceof` fails — ArrayBuffer, plain `number[]`, or a JSON `{type:'Buffer',data:[...]}`).
// Reduce each to raw bytes.
function serviceLogChunkToBytes(chunk: unknown): Uint8Array | null {
  if (chunk == null) {
    return null;
  }
  if (typeof chunk === 'string') {
    return new TextEncoder().encode(chunk);
  }
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }
  // Node Buffer serialized to JSON: { type: 'Buffer', data: [...] }.
  const data = (chunk as any).data;
  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }
  // Array-like of byte values (plain array, or a cross-realm typed array `instanceof` missed).
  if (typeof (chunk as any).length === 'number') {
    return Uint8Array.from(chunk as ArrayLike<number>);
  }
  return null;
}

// `serviceGetStreamableLogs` ships in the next @oceanprotocol/lib release; the pinned
// 9.0.0-next.1 doesn't type it yet. Cast to reach the method — callers guard the runtime case
// where the resolved lib doesn't implement it. Drop the cast once a release that includes it is
// pinned.
function serviceStreamableLogsProvider() {
  return ProviderInstance as unknown as {
    serviceGetStreamableLogs(
      nodeUri: OceanNode,
      signerOrAuthToken: SignerOrAuthTokenOrSignature,
      serviceId: string,
      since?: string,
      signal?: AbortSignal
    ): Promise<AsyncIterable<Uint8Array> | null | undefined>;
  };
}

/**
 * Live-tail a running service container's logs. The node streams Docker logs with `follow: true`,
 * so this generator yields raw byte chunks until the caller aborts via `signal` (or the stream ends
 * on its own when the container exits). The bytes are Docker-muxed — accumulate them and run
 * {@link demuxDockerLogs} over the full buffer to get text (headers can straddle chunk boundaries,
 * so per-chunk demux is unsafe).
 */
export async function* streamServiceLogs(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  serviceId: string,
  signal?: AbortSignal,
  since?: string
): AsyncGenerator<Uint8Array> {
  let stream;
  try {
    stream = await serviceStreamableLogsProvider().serviceGetStreamableLogs(
      normalizeNodeUri(nodeUri),
      signerOrAuthToken,
      serviceId,
      since,
      signal
    );
  } catch (error) {
    console.warn('serviceGetStreamableLogs failed:', error);
    return;
  }
  if (!stream) {
    return;
  }
  for await (const chunk of stream) {
    if (signal?.aborted) {
      return;
    }
    const bytes = serviceLogChunkToBytes(chunk);
    if (bytes && bytes.length > 0) {
      yield bytes;
    }
  }
}

export async function getServiceLogs(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  serviceId: string,
  since?: string,
  { idleMs = 1500, maxMs = 15000 }: { idleMs?: number; maxMs?: number } = {}
): Promise<string> {
  const controller = new AbortController();
  let stream;
  try {
    stream = await serviceStreamableLogsProvider().serviceGetStreamableLogs(
      normalizeNodeUri(nodeUri),
      signerOrAuthToken,
      serviceId,
      since,
      controller.signal
    );
  } catch (error) {
    // The P2P command can time out (e.g. an old node still streaming with follow:true, or no
    // response). Surface nothing rather than crashing the panel — the caller shows a friendly state.
    console.warn('serviceGetStreamableLogs failed:', error);
    return '';
  }
  if (!stream) {
    return '';
  }
  const toBytes = serviceLogChunkToBytes;

  const parts: Uint8Array[] = [];

  // Drain the (never-ending) follow stream until it goes idle or hits the hard cap, then abort it.
  // The idle timer only arms AFTER the first chunk — the initial P2P round-trip + node-side stream
  // setup can take several seconds, so starting the idle clock upfront would abort with nothing.
  await new Promise<void>((resolve) => {
    let settled = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      controller.abort();
      resolve();
    };
    // Hard ceiling — always fires even if no chunk ever arrives (empty/hung stream).
    const maxTimer = setTimeout(finish, maxMs);

    (async () => {
      try {
        for await (const chunk of stream) {
          if (settled) {
            break;
          }
          const bytes = toBytes(chunk);
          if (bytes && bytes.length > 0) {
            parts.push(bytes);
          }
          // Arm/reset the idle window only once output has started flowing.
          clearTimeout(idleTimer);
          idleTimer = setTimeout(finish, idleMs);
        }
        // Stream ended on its own (not following) — we have everything.
        finish();
      } catch {
        // Abort (or transport error) ends iteration — return whatever was collected.
        finish();
      }
    })();
  });

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    merged.set(p, offset);
    offset += p.length;
  }
  return demuxDockerLogs(merged);
}

/**
 * Decode a Docker container-log byte stream to text. `docker logs` on a container without a TTY is
 * multiplexed: repeated 8-byte headers `[streamType, 0,0,0, size(uint32 BE)]` followed by `size`
 * payload bytes (streamType 1=stdout, 2=stderr). Strip the headers and concatenate the payloads.
 * Falls back to a plain UTF-8 decode when the data isn't muxed (no valid header at the cursor).
 */
export function demuxDockerLogs(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  let out = '';
  let i = 0;
  while (i + 8 <= bytes.length) {
    const streamType = bytes[i];
    // A valid header has streamType 0-2 and bytes[i+1..3] === 0; otherwise it's not muxed.
    if (streamType > 2 || bytes[i + 1] !== 0 || bytes[i + 2] !== 0 || bytes[i + 3] !== 0) {
      return decoder.decode(bytes);
    }
    const size = (bytes[i + 4] << 24) | (bytes[i + 5] << 16) | (bytes[i + 6] << 8) | bytes[i + 7];
    const start = i + 8;
    const end = Math.min(start + size, bytes.length);
    out += decoder.decode(bytes.subarray(start, end), { stream: true });
    i = end;
  }
  out += decoder.decode();
  // Nothing consumed as frames → not muxed; decode raw.
  return out || decoder.decode(bytes);
}

/**
 * Extend a running service's lifetime by `additionalDuration` seconds. The node charges the extra
 * runtime against the same escrow flow as the initial start and records it in `extendPayments`.
 */
export async function serviceExtend(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  serviceId: string,
  additionalDuration: number,
  payment: ServicePayment
): Promise<ServiceJob[]> {
  return ProviderInstance.serviceExtend(
    normalizeNodeUri(nodeUri),
    signerOrAuthToken,
    serviceId,
    additionalDuration,
    payment
  );
}

/**
 * Restart a running service's container, keeping the SAME serviceId, host port and expiry
 * (elapsed/paid runtime is preserved — the node reuses the allocated ports and never touches
 * `expiresAt`; see ocean-node `restartService`). Optionally pass fresh `userData` (container env
 * vars) and/or a new `dockerCmd`/`dockerEntrypoint` — each, when supplied, REPLACES the stored
 * value; omitted ones are reused. This is what an Edit-with-relaunch wants: swap the model/launch
 * command in place instead of stop+start (which mints a new serviceId, port and resets the timer).
 */
export async function serviceRestart(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  serviceId: string,
  userData?: Record<string, unknown>,
  dockerCmd?: string[],
  dockerEntrypoint?: string[]
): Promise<ServiceJob[]> {
  return ProviderInstance.serviceRestart(
    normalizeNodeUri(nodeUri),
    signerOrAuthToken,
    serviceId,
    userData,
    dockerCmd,
    dockerEntrypoint
  );
}

/** Stop a running service. Resolves to the updated job(s) in `Stopped` state. */
export async function serviceStop(
  nodeUri: NodeUri,
  signerOrAuthToken: SignerOrAuthTokenOrSignature,
  serviceId: string
): Promise<ServiceJob[]> {
  return ProviderInstance.serviceStop(normalizeNodeUri(nodeUri), signerOrAuthToken, serviceId);
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
