import { ServiceContainerSpec } from '@oceanprotocol/lib';

/**
 * Request https for `ports`. TLS only: the template's own gate still checks the password.
 * No ports → `params` unchanged, because an empty `secureTls` on a restart turns TLS off.
 */
export function withSecureTls<T extends ServiceContainerSpec>(params: T, ports: number[], enabled: boolean): T {
  if (!enabled || ports.length === 0) {
    return params;
  }
  return { ...params, secureTls: ports };
}
