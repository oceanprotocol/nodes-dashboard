import { signNodeCommandMessage } from '@/lib/sign-message';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { Multiaddr, multiaddr } from '@multiformats/multiaddr';
import { PROTOCOL_COMMANDS, ProviderInstance, type NodeLogsParams } from '@oceanprotocol/lib';

type NodeUri = string[] | string;

function toNodeUri(input: NodeUri) {
  if (Array.isArray(input)) return input.map((a) => multiaddr(a));
  return input;
}

export async function initializeP2P(bootstrapNodes: string[]): Promise<void> {
  await ProviderInstance.setupP2P({
    bootstrapPeers: bootstrapNodes,
    libp2p: {
      config: {
        connectionGater: {
          denyDialMultiaddr: async (multiaddr: Multiaddr) => {
            const addr = multiaddr.toString();
            return !(addr.includes('/tls') || addr.includes('/wss'));
          },
        },
      },
    },
  });
}

export async function getNodeEnvs(nodeUri: NodeUri) {
  return ProviderInstance.getComputeEnvironments(toNodeUri(nodeUri));
}

export async function getNonce(nodeUri: NodeUri, consumerAddress: string): Promise<number> {
  return ProviderInstance.getNonce(toNodeUri(nodeUri), consumerAddress);
}

export async function getComputeStatus(nodeUri: NodeUri, authToken: string, jobId: string) {
  return ProviderInstance.computeStatus(toNodeUri(nodeUri), authToken, jobId);
}

export async function getComputeJobResult(nodeUri: NodeUri, authToken: string, jobId: string, index: number) {
  const stream = await ProviderInstance.getComputeResult(toNodeUri(nodeUri), authToken, jobId, index);
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
  return ProviderInstance.getComputeResult(toNodeUri(nodeUri), authToken, jobId, index);
}

export async function getComputeStreamableLogs(nodeUri: NodeUri, authToken: string, jobId: string) {
  return ProviderInstance.computeStreamableLogs(toNodeUri(nodeUri), authToken, jobId);
}

export async function createAuthToken({
  consumerAddress,
  nodeUri,
  signMessage,
}: {
  consumerAddress: string;
  nodeUri: NodeUri;
  signMessage: SignMessageFn;
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
    toNodeUri(nodeUri)
  );
  return { token };
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
    toNodeUri(nodeUri),
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
  return ProviderInstance.fetchNodeLogs(
    toNodeUri(nodeUri),
    consumerAddress,
    signature,
    incrementedNonce.toString(),
    params
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
  return ProviderInstance.fetchConfig(toNodeUri(nodeUri), {
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
  return ProviderInstance.pushConfig(toNodeUri(nodeUri), {
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
