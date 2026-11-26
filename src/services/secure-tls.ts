import { ServiceContainerSpec } from '@oceanprotocol/lib';

/**
 * Request https for `ports`. TLS only: the template's own gate still checks the password.
 * When enabled, always sends the list, `[]` included: an Edit can swap in a template with no
 * https ports, and an omitted `secureTls` on restart keeps the previous template's list.
 */
export function withSecureTls<T extends ServiceContainerSpec>(params: T, ports: number[], enabled: boolean): T {
  return enabled ? { ...params, secureTls: ports } : params;
}
