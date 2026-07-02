import { resolveDdo } from '@/services/nodeService';
import {
  type ComputeAlgorithm,
  type ComputeAsset,
  type ExtendedMetadataAlgorithm,
  FileObjectType,
  type OceanNode,
} from '@oceanprotocol/lib';

export type NodeUri = OceanNode | string[];

// Only py/js are supported as first-class languages; both map to a default c2d_examples image and a
// `$ALGO` entrypoint. A custom Dockerfile still relies on the same `$ALGO` entrypoint (the node
// injects the algorithm path), so language matters even when a Dockerfile is provided.
export type AlgorithmLanguage = 'py' | 'js';

export type EnvVarEntry = { key: string; value: string };

const ENTRYPOINT: Record<AlgorithmLanguage, string> = {
  py: 'python $ALGO',
  js: 'node $ALGO',
};

const DEFAULT_IMAGE = 'oceanprotocol/c2d_examples';
const DEFAULT_TAG: Record<AlgorithmLanguage, string> = {
  py: 'py-general',
  js: 'js-general',
};

export const LANGUAGE_BY_EXTENSION: Record<string, AlgorithmLanguage> = {
  py: 'py',
  js: 'js',
};

// Detect language from an uploaded filename. Returns null for unsupported extensions so the caller
// can leave the user's current selection untouched.
export function detectLanguageFromFilename(filename: string): AlgorithmLanguage | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? (LANGUAGE_BY_EXTENSION[ext] ?? null) : null;
}

// Build the container config. A non-empty Dockerfile is built by the node (empty image/tag);
// otherwise we fall back to the default c2d_examples image for the language.
export function buildContainerConfig(
  language: AlgorithmLanguage,
  dockerfile?: string
): ExtendedMetadataAlgorithm['container'] {
  const entrypoint = ENTRYPOINT[language];
  const trimmedDockerfile = dockerfile?.trim();
  if (trimmedDockerfile) {
    return { image: '', tag: '', entrypoint, dockerfile: trimmedDockerfile, checksum: '' };
  }
  return { image: DEFAULT_IMAGE, tag: DEFAULT_TAG[language], entrypoint, checksum: '' };
}

// Drop rows with an empty key; later duplicates win.
export function serializeEnvVars(entries: EnvVarEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of entries) {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      result[trimmedKey] = value;
    }
  }
  return result;
}

export function buildComputeAlgorithm({
  code,
  dockerfile,
  envVars,
  language,
}: {
  code: string;
  dockerfile?: string;
  envVars: EnvVarEntry[];
  language: AlgorithmLanguage;
}): ComputeAlgorithm {
  const envs = serializeEnvVars(envVars);
  return {
    meta: {
      rawcode: code,
      container: buildContainerConfig(language, dockerfile),
    } as ExtendedMetadataAlgorithm,
    ...(Object.keys(envs).length > 0 ? { envs } : {}),
  };
}

// Format-only check (browser-safe). A live reachability fetch the way the VS Code extension does it
// is unreliable cross-origin in the browser (CORS), so we only sanity-check the shape here and let
// the node verify real reachability at job start.
export function looksLikeDataset(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  return (
    value.startsWith('did:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('Qm') ||
    // Arweave tx ids are 43-char base64url strings.
    /^[A-Za-z0-9_-]{43}$/.test(value)
  );
}

// Turn a dataset string into the assets array computeStart expects. DID -> resolve DDO for its
// service id; URL/IPFS/Arweave -> a fileObject. Empty -> [] (dataset-less jobs are allowed).
// Mirrors the VS Code extension's getComputeAsset.
export async function resolveDatasetAssets(nodeUri: NodeUri, dataset?: string): Promise<ComputeAsset[]> {
  const value = dataset?.trim();
  if (!value) {
    return [];
  }

  if (value.startsWith('did:')) {
    const ddo = await resolveDdo(nodeUri, value);
    if (!ddo?.services?.length) {
      throw new Error('Could not resolve the dataset DID to a service');
    }
    return [{ documentId: value, serviceId: ddo.services[0].id } as ComputeAsset];
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return [{ fileObject: { type: FileObjectType.URL, url: value, method: 'GET' } } as unknown as ComputeAsset];
  }

  if (value.startsWith('Qm')) {
    return [{ fileObject: { type: FileObjectType.IPFS, hash: value } } as unknown as ComputeAsset];
  }

  // Fall back to treating it as an Arweave transaction id.
  return [
    {
      fileObject: { type: FileObjectType.URL, url: `https://arweave.net/${value}`, method: 'GET' },
    } as unknown as ComputeAsset,
  ];
}
