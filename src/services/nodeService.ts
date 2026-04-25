import { signNodeCommandMessage } from '@/lib/sign-message';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { Multiaddr, multiaddr } from '@multiformats/multiaddr';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import {
  AccessListContract,
  AccesslistFactory,
  PROTOCOL_COMMANDS,
  ProviderInstance,
  type NodeLogsParams,
  type PersistentStorageAccessList,
  type PersistentStorageBucket,
  type PersistentStorageDeleteFileResponse,
  type PersistentStorageFileEntry,
} from '@oceanprotocol/lib';
import { Signer } from 'ethers';

type NodeUri = string[] | string;

function toNodeUri(input: NodeUri) {
  if (Array.isArray(input)) return input.map((a) => multiaddr(a));
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

export async function getNodeBuckets({
  authToken,
  nodeUri,
  ownerAddress,
}: {
  authToken: string;
  nodeUri: NodeUri;
  ownerAddress: string;
}): Promise<PersistentStorageBucket[]> {
  return ProviderInstance.getPersistentStorageBuckets(toNodeUri(nodeUri), authToken, ownerAddress);
}

export async function deployAccessList({
  chainId,
  owner,
  signer,
  wallets,
}: {
  chainId: number;
  owner: string;
  signer: Signer;
  wallets: string[];
}): Promise<string> {
  const config = Object.values(Address).find((c) => c.chainId === chainId);
  if (!config || !('AccessListFactory' in config)) {
    throw new Error(`No AccessListFactory deployed on chain ${chainId}`);
  }
  const factoryAddress = (config as any).AccessListFactory as string;
  const factory = new AccesslistFactory(factoryAddress, signer);
  const address = await factory.deployAccessListContract(
    'BucketAccessList',
    'BAL',
    wallets.map(() => ''),
    false,
    owner,
    wallets
  );
  if (!address) {
    throw new Error('Failed to deploy access list contract');
  }
  return address;
}

export async function createNodeBucket({
  accessLists,
  authToken,
  nodeUri,
}: {
  accessLists: PersistentStorageAccessList[];
  authToken: string;
  nodeUri: NodeUri;
}): Promise<{ bucketId: string; owner: string; accessList: PersistentStorageAccessList[] }> {
  return ProviderInstance.createPersistentStorageBucket(toNodeUri(nodeUri), authToken, { accessLists });
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
  return ProviderInstance.listPersistentStorageFiles(toNodeUri(nodeUri), authToken, bucketId);
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
    toNodeUri(nodeUri),
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
  return ProviderInstance.deletePersistentStorageFile(toNodeUri(nodeUri), authToken, bucketId, fileName);
}

export async function getAccessListAddresses({
  contractAddress,
  signer,
}: {
  contractAddress: string;
  signer: Signer;
}): Promise<string[]> {
  const contract = new AccessListContract(contractAddress, signer);
  const totalSupply = Number(await contract.contract.totalSupply());
  const addresses: string[] = [];
  for (let i = 0; i < totalSupply; i++) {
    const tokenId = await contract.contract.tokenByIndex(i);
    const owner: string = await contract.contract.ownerOf(tokenId);
    addresses.push(owner);
  }
  return addresses;
}

export async function addToAccessList({
  contractAddress,
  signer,
  wallet,
}: {
  contractAddress: string;
  signer: Signer;
  wallet: string;
}): Promise<void> {
  const contract = new AccessListContract(contractAddress, signer);
  await contract.mint(wallet, '');
}

export async function removeFromAccessList({
  contractAddress,
  signer,
  wallet,
}: {
  contractAddress: string;
  signer: Signer;
  wallet: string;
}): Promise<void> {
  const contract = new AccessListContract(contractAddress, signer);
  const totalSupply = Number(await contract.contract.totalSupply());
  for (let i = 0; i < totalSupply; i++) {
    const tokenId = await contract.contract.tokenByIndex(i);
    const owner: string = await contract.contract.ownerOf(tokenId);
    if (owner.toLowerCase() === wallet.toLowerCase()) {
      await contract.burn(Number(tokenId));
      return;
    }
  }
  throw new Error(`Wallet ${wallet} not found in access list`);
}
