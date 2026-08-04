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

export type CuratedImage = {
  /** Docker Hub `namespace/repo` used to fetch tags. Official library images live under `library/`
   * (e.g. `library/python`). */
  repo: string;
  /** Container `image` reference written into the algorithm config. Defaults to `repo`; set it for
   * official images so the reference stays bare (`python`, not `library/python`). */
  image?: string;
  /** Human label shown in the image dropdown. */
  label: string;
  /** One-line description shown under the label in the dropdown. */
  desc: string;
  /** Tags pinned to the top of the tag dropdown and used as the offline fallback when the live
   * Docker Hub fetch fails. */
  knownTags: string[];
};

// The container `image` reference for a curated entry (falls back to its Docker Hub repo path).
export function curatedImageRef(curated: CuratedImage): string {
  return curated.image ?? curated.repo;
}

// Blessed images offered as a dropdown in the Docker step so users can start a job without knowing
// image coordinates. Extend this list to add more images. Tags are fetched live from Docker Hub,
// with `knownTags` pinned first and used as the fallback if the fetch fails.
export const CURATED_IMAGES: CuratedImage[] = [
  {
    repo: 'oceanprotocol/c2d_examples',
    label: 'Predefined Docker images',
    desc: 'Curated image with common ML libraries preinstalled.',
    knownTags: ['py-general', 'js-general', 'py-lite'],
  },
  {
    repo: 'library/python',
    image: 'python',
    label: 'Python (Alpine)',
    desc: 'Official minimal Python image from Docker Hub. Pick with the Python language.',
    knownTags: ['alpine', '3.12-alpine', '3.11-alpine'],
  },
  {
    repo: 'library/node',
    image: 'node',
    label: 'Node (Alpine)',
    desc: 'Official minimal Node.js image from Docker Hub. Pick with the JavaScript language.',
    knownTags: ['alpine', '22-alpine', '20-alpine'],
  },
];

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
// How the container starts:
//  - 'algo' (default): the node injects the algorithm code as `$ALGO` and runs the language entrypoint.
//  - 'self': the image is self-contained; the user's own entrypoint runs code baked into the image, so
//    algorithm code is optional and an image checksum may be pinned.
export type EntryMode = 'algo' | 'self';

// Which container source the user picked in the authoring UI. '' = not yet chosen. Purely a UI/gating
// concern; buildContainerConfig derives the actual container from dockerfile/dockerImage.
export type ImageSource = '' | 'default' | 'custom' | 'dockerfile';

export type BuildContainerArgs = {
  language: AlgorithmLanguage;
  dockerfile?: string;
  additionalDockerFiles?: Record<string, string>;
  dockerImage?: string;
  dockerTag?: string;
  entryMode?: EntryMode;
  entrypoint?: string;
  checksum?: string;
};

export function buildContainerConfig({
  language,
  dockerfile,
  additionalDockerFiles,
  dockerImage,
  dockerTag,
  entryMode,
  entrypoint: customEntrypoint,
  checksum,
}: BuildContainerArgs): ExtendedMetadataAlgorithm['container'] {
  // A self-contained image runs its own entrypoint; otherwise the node runs `<lang> $ALGO`.
  const selfContained = entryMode === 'self' && !!customEntrypoint?.trim();
  const entrypoint = selfContained ? customEntrypoint!.trim() : ENTRYPOINT[language];
  const checksumValue = checksum?.trim() ?? '';

  const trimmedDockerfile = dockerfile?.trim();
  if (trimmedDockerfile) {
    return {
      image: '',
      tag: '',
      entrypoint,
      dockerfile: trimmedDockerfile,
      checksum: checksumValue,
      ...(additionalDockerFiles && Object.keys(additionalDockerFiles).length > 0 ? { additionalDockerFiles } : {}),
    };
  }
  const trimmedImage = dockerImage?.trim();
  if (trimmedImage) {
    return { image: trimmedImage, tag: dockerTag?.trim() || 'latest', entrypoint, checksum: checksumValue };
  }
  // Default image (oceanprotocol/c2d_examples): honor a chosen tag, else the per-language default.
  return { image: DEFAULT_IMAGE, tag: dockerTag?.trim() || DEFAULT_TAG[language], entrypoint, checksum: '' };
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
  additionalDockerFiles,
  code,
  dockerfile,
  dockerImage,
  dockerTag,
  entryMode,
  entrypoint,
  checksum,
  envVars,
  language,
}: {
  additionalDockerFiles?: Record<string, string>;
  code: string;
  dockerfile?: string;
  dockerImage?: string;
  dockerTag?: string;
  entryMode?: EntryMode;
  entrypoint?: string;
  checksum?: string;
  envVars: EnvVarEntry[];
  language: AlgorithmLanguage;
}): ComputeAlgorithm {
  const envs = serializeEnvVars(envVars);
  // rawcode may be empty for a self-contained image whose entrypoint runs baked-in code.
  return {
    meta: {
      rawcode: code,
      container: buildContainerConfig({
        language,
        dockerfile,
        additionalDockerFiles,
        dockerImage,
        dockerTag,
        entryMode,
        entrypoint,
        checksum,
      }),
    } as ExtendedMetadataAlgorithm,
    ...(Object.keys(envs).length > 0 ? { envs } : {}),
  };
}

function isIpfsCid(value: string): boolean {
  return value.startsWith('Qm') || /^b[a-z2-7]{50,}$/.test(value);
}

// Arweave tx ids are 43-char base64url strings.
function isArweaveTxId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function looksLikeDataset(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  return (
    value.startsWith('did:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    isIpfsCid(value) ||
    isArweaveTxId(value)
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

  if (isIpfsCid(value)) {
    return [{ fileObject: { type: FileObjectType.IPFS, hash: value } } as unknown as ComputeAsset];
  }

  if (isArweaveTxId(value)) {
    return [
      {
        fileObject: { type: FileObjectType.URL, url: `https://arweave.net/${value}`, method: 'GET' },
      } as unknown as ComputeAsset,
    ];
  }

  // Refuse rather than guess: a mis-routed dataset only fails after the job is paid and started.
  throw new Error('Unrecognized dataset format. Expected a DID, URL, IPFS CID, or Arweave transaction id.');
}
