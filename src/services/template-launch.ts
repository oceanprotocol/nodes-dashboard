import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { buildGpuRequests, resourceId } from '@/services/inference-launch';
import { AppTemplate } from '@/types/templates';
import { ComputeResourceRequest, ServiceRestartParams, ServiceStartParams } from '@oceanprotocol/lib';

/** Whole CPU/RAM/disk allocation for the service (from useInferenceAllocation). */
type Allocation = {
  cpu: number;
  ram: number;
  disk: number;
};

/**
 * Container env vars for a template launch, sent as plaintext userData (ocean.js ECIES-encrypts before
 * transit) from the user-supplied values for the template's `userConfigurableEnvVars` — only keys the
 * user actually filled are emitted. Operator-fixed launch config is not env: it rides in the template's
 * `command`, which the node forwards to the container verbatim (dockerCmd), so nothing to merge here.
 */
export function buildTemplateUserData(template: AppTemplate, envValues: Record<string, string>): Record<string, string> {
  const userData: Record<string, string> = {};
  for (const spec of template.userConfigurableEnvVars ?? []) {
    const value = envValues[spec.key];
    if (value) {
      userData[spec.key] = value;
    }
  }
  return userData;
}

/**
 * Build the ServiceStartParams to launch an app template on the chosen environment. Mirrors
 * buildInferenceStartParams, but sources image/tag/ports/command from the template instead of the
 * engine map, and userData from the template's env vars instead of vLLM/llama.cpp params. The env's
 * cpu/ram/disk/gpu request comes from the resolved allocation + gpu selection (same as inference).
 */
export function buildTemplateStartParams({
  template,
  selectedEnv,
  gpuSelection,
  allocation,
  durationSeconds,
  tokenAddress,
  envValues,
}: {
  template: AppTemplate;
  selectedEnv: SelectedInferenceEnv;
  /** Resolved per-type GPU units to request — pass the allocation hook's selectedByKey. */
  gpuSelection?: GpuSelection;
  allocation: Allocation;
  durationSeconds: number;
  tokenAddress: string;
  envValues: Record<string, string>;
}): ServiceStartParams {
  const envResources = selectedEnv.environment.resources ?? [];

  // Exactly one image reference: tag or checksum (dockerfile builds are gated node-side and not offered here).
  const imageRef = template.tag ? { tag: template.tag } : template.checksum ? { checksum: template.checksum } : {};

  const resources: ComputeResourceRequest[] = [
    { id: resourceId(envResources, 'cpu'), amount: allocation.cpu },
    { id: resourceId(envResources, 'ram'), amount: allocation.ram },
    { id: resourceId(envResources, 'disk'), amount: allocation.disk },
    ...buildGpuRequests(envResources, gpuSelection ?? selectedEnv.gpuSelection),
  ];

  return {
    environment: selectedEnv.environment.id,
    image: template.image,
    ...imageRef,
    exposedPorts: template.exposedPorts,
    ...(template.command && template.command.length > 0 ? { dockerCmd: template.command } : {}),
    ...(template.entrypoint && template.entrypoint.length > 0 ? { dockerEntrypoint: template.entrypoint } : {}),
    userData: buildTemplateUserData(template, envValues),
    resources,
    duration: durationSeconds,
    payment: { chainId: CHAIN_ID, token: tokenAddress },
  };
}

/**
 * Build the ServiceRestartParams to relaunch a running service ONTO a (possibly different) template,
 * in place. As of next.6 serviceRestart can pull a new image, so this carries the target template's
 * image/tag/checksum + launch command + configured env vars — letting an Edit switch apps without a
 * stop+start (serviceId, host port and paid window are preserved). Unlike buildTemplateStartParams
 * there is no environment/resources/ports/duration/payment: the node reuses the running service's
 * allocation and never re-allocates ports on restart (a template needing different ports/hardware
 * needs a fresh start instead).
 */
export function buildTemplateRestartParams(
  template: AppTemplate,
  envValues: Record<string, string>
): ServiceRestartParams {
  // Exactly one image reference: tag or checksum (dockerfile builds are gated node-side and not offered here).
  const imageRef = template.tag ? { tag: template.tag } : template.checksum ? { checksum: template.checksum } : {};
  return {
    image: template.image,
    ...imageRef,
    ...(template.command && template.command.length > 0 ? { dockerCmd: template.command } : {}),
    ...(template.entrypoint && template.entrypoint.length > 0 ? { dockerEntrypoint: template.entrypoint } : {}),
    userData: buildTemplateUserData(template, envValues),
  };
}

/** The port serving the template's primary web UI (first exposed port) — for the "Open" link. */
export function templatePrimaryPort(template: AppTemplate): number | undefined {
  return template.exposedPorts?.[0];
}
